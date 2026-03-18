import SwiftUI

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // 强制将应用设置为标准运行模式并夺取焦点
        NSApp.setActivationPolicy(.regular)
        
        // 延迟执行：避开 Xcode 启动时的焦点争夺，并确保窗口已完成渲染
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            NSRunningApplication.current.activate(options: [.activateIgnoringOtherApps, .activateAllWindows])
            // 仅将主应用窗口带到最前面，避免误触系统幽灵窗口（由 forEach 导致的问题）
            NSApp.windows.first(where: { $0.title != "" })?.makeKeyAndOrderFront(nil)
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }
}

@main
struct CodexJSONLClientApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .windowStyle(.hiddenTitleBar)
    }
}
