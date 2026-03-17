import Foundation
import SwiftUI
import AppKit

// MARK: - PTY 终端控制器
// 使用 forkpty 创建真实的 PTY，连接 Shell 进程
class NativeTerminalController: ObservableObject {
    @Published var outputBuffer: NSAttributedString = NSAttributedString(string: "")
    
    private var masterFd: Int32 = -1
    private var childPid: pid_t = -1
    private var readThread: Thread?
    
    weak var textView: NSTextView?
    
    func start() {
        var winsize = winsize()
        winsize.ws_col = 220
        winsize.ws_row = 50

        let pid = forkpty(&masterFd, nil, nil, &winsize)

        if pid < 0 {
            appendText("Failed to create PTY\n", color: .red)
            return
        }

        if pid == 0 {
            // 子进程：执行 Shell（用 execvp 避免 nil 变参问题）
            let shell = ProcessInfo.processInfo.environment["SHELL"] ?? "/bin/zsh"
            let home = FileManager.default.homeDirectoryForCurrentUser.path
            setenv("TERM", "xterm-256color", 1)
            setenv("HOME", home, 1)
            chdir(home)
            // execvp 接受 [UnsafeMutablePointer<CChar>?] 数组，末尾 nil 明确类型
            var args: [UnsafeMutablePointer<CChar>?] = [
                strdup(shell),
                strdup("--login"),
                nil
            ]
            execvp(shell, &args)
            exit(1)
        }

        // 父进程
        childPid = pid
        startReading()
    }
    
    private func startReading() {
        let fd = masterFd
        readThread = Thread {
            var buf = [UInt8](repeating: 0, count: 4096)
            while true {
                let n = read(fd, &buf, buf.count)
                if n <= 0 { break }
                let data = Data(buf[0..<n])
                if let text = String(bytes: data, encoding: .utf8) ?? String(bytes: data, encoding: .isoLatin1) {
                    DispatchQueue.main.async { [weak self] in
                        self?.appendAnsi(text)
                    }
                }
            }
        }
        readThread?.start()
    }
    
    func sendInput(_ text: String) {
        guard masterFd >= 0, let data = text.data(using: .utf8) else { return }
        data.withUnsafeBytes { ptr in
            if let base = ptr.baseAddress {
                _ = write(masterFd, base, data.count)
            }
        }
    }
    
    func stop() {
        if childPid > 0 { kill(childPid, SIGTERM) }
        if masterFd >= 0 { close(masterFd) }
    }
    
    // 简单的 ANSI 解析：去除转义序列，保留文字
    private func appendAnsi(_ raw: String) {
        // 过滤 ANSI 转义序列
        let ansiRegex = try? NSRegularExpression(pattern: #"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])"#)
        let range = NSRange(raw.startIndex..., in: raw)
        let clean = ansiRegex?.stringByReplacingMatches(in: raw, range: range, withTemplate: "") ?? raw
        appendText(clean, color: .white)
    }
    
    private func appendText(_ text: String, color: NSColor) {
        guard let tv = textView else { return }
        let attrs: [NSAttributedString.Key: Any] = [
            .foregroundColor: color,
            .font: NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
        ]
        let attrStr = NSAttributedString(string: text, attributes: attrs)
        tv.textStorage?.append(attrStr)
        tv.scrollToEndOfDocument(nil)
    }
}

// MARK: - NSViewRepresentable 封装（不使用 Metal）
struct NativeTerminalView: NSViewRepresentable {
    @ObservedObject var controller: NativeTerminalController
    
    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSTextView.scrollableTextView()
        guard let tv = scrollView.documentView as? NSTextView else { return scrollView }
        
        tv.isEditable = false
        tv.isSelectable = true
        tv.backgroundColor = NSColor(red: 0.06, green: 0.07, blue: 0.09, alpha: 1.0)
        tv.textContainerInset = NSSize(width: 12, height: 8)
        tv.font = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
        tv.delegate = context.coordinator
        
        context.coordinator.textView = tv
        controller.textView = tv
        context.coordinator.controller = controller
        
        // 监听键盘输入
        NotificationCenter.default.addObserver(
            context.coordinator,
            selector: #selector(Coordinator.didBecomeActive),
            name: NSApplication.didBecomeActiveNotification,
            object: nil
        )
        
        return scrollView
    }
    
    func updateNSView(_ nsView: NSScrollView, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    class Coordinator: NSObject, NSTextViewDelegate {
        weak var textView: NSTextView?
        var controller: NativeTerminalController?
        
        @objc func didBecomeActive() {}
        
        func textView(_ textView: NSTextView, shouldChangeTextIn affectedCharRange: NSRange, replacementString: String?) -> Bool {
            return false
        }
    }
}

// MARK: - 带输入框的完整终端容器
struct NativeTerminalContainer: View {
    @StateObject private var controller = NativeTerminalController()
    @State private var inputText = ""
    @State private var commandHistory: [String] = []
    
    var body: some View {
        VStack(spacing: 0) {
            // 标签栏
            HStack {
                HStack(spacing: 16) {
                    TerminalTabLabel(title: "TERMINAL", isActive: true)
                    TerminalTabLabel(title: "OUTPUT", isActive: false)
                }
                Spacer()
                Image(systemName: "xmark")
                    .font(.system(size: 11))
                    .foregroundColor(.gray)
                    .padding(.trailing, 4)
            }
            .padding(.horizontal, 16)
            .frame(height: 32)
            .background(Color(NSColor.windowBackgroundColor).opacity(0.6))
            .overlay(Rectangle().frame(height: 1).foregroundColor(.white.opacity(0.06)), alignment: .bottom)
            
            // 终端输出区
            NativeTerminalView(controller: controller)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            
            // 输入框
            HStack(spacing: 8) {
                Text("❯")
                    .foregroundColor(.green)
                    .font(.system(size: 12, design: .monospaced))
                TextField("", text: $inputText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundColor(.white)
                    .onSubmit {
                        let cmd = inputText + "\n"
                        controller.sendInput(cmd)
                        commandHistory.append(inputText)
                        inputText = ""
                    }
            }
            .padding(.horizontal, 12)
            .frame(height: 30)
            .background(Color.black.opacity(0.3))
            .overlay(Rectangle().frame(height: 1).foregroundColor(.white.opacity(0.06)), alignment: .top)
        }
        .background(Color(red: 0.06, green: 0.07, blue: 0.09))
        .onAppear { controller.start() }
        .onDisappear { controller.stop() }
    }
}

private struct TerminalTabLabel: View {
    let title: String
    let isActive: Bool
    
    var body: some View {
        Text(title)
            .font(.system(size: 10, weight: .bold))
            .tracking(1.0)
            .foregroundColor(isActive ? .white : .gray)
            .padding(.bottom, 2)
            .overlay(
                isActive ? Rectangle().frame(height: 1).foregroundColor(.white) : nil,
                alignment: .bottom
            )
    }
}
