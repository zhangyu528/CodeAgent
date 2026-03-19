import SwiftUI
import AppKit

struct ChatSidebarView: View {
    @ObservedObject var vm: CodeAgentViewModel
    @State private var showingClearKeyConfirmation = false
    @State private var didClearKey = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("AI ASSISTANT")
                .font(.system(size: 10, weight: .bold))
                .tracking(1.2)
                .foregroundColor(.gray)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .overlay(
                    Rectangle()
                        .frame(height: 1)
                        .foregroundColor(CodeAgentTheme.border),
                    alignment: .bottom
                )
            
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(vm.chatMessages) { msg in
                        ChatMessageView(
                            content: msg.content,
                            sender: msg.role == .assistant ? "Assistant" : "You",
                            isAssistant: msg.role == .assistant
                        )
                    }
                }
                .padding(16)
            }
            
            VStack(spacing: 12) {
                HStack(spacing: 8) {
                    ZStack(alignment: .leading) {
                        if vm.chatInput.isEmpty {
                            Text("How can I help you today?")
                                .font(.system(size: 13))
                                .foregroundColor(.gray.opacity(0.7))
                        }

                        ChatComposerTextView(
                            text: $vm.chatInput,
                            isDisabled: !vm.isConnected || vm.isAwaitingReply,
                            onSubmit: vm.sendMessage
                        )
                    }
                    .frame(minHeight: 24, maxHeight: 88)
                    
                    Button(action: { vm.sendMessage() }) {
                        Image(systemName: "chevron.right.2")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(vm.chatInput.isEmpty ? .gray.opacity(0.3) : CodeAgentTheme.accent)
                    }
                    .buttonStyle(.plain)
                    .disabled(vm.chatInput.isEmpty || !vm.isConnected || vm.isAwaitingReply)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(Color.white.opacity(0.04))
                .cornerRadius(12)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(CodeAgentTheme.border, lineWidth: 1)
                )

                if vm.showInlineSetup {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(vm.setupHintText)
                            .font(.system(size: 11))
                            .foregroundColor(.gray.opacity(0.85))

                        HStack(spacing: 8) {
                            SecureField(vm.selectedProviderApiKeyLabel, text: Binding(
                                get: { vm.providerConfigs[vm.selectedProvider]?.apiKey ?? "" },
                                set: {
                                    if var cfg = vm.providerConfigs[vm.selectedProvider] {
                                        cfg.apiKey = $0
                                        vm.providerConfigs[vm.selectedProvider] = cfg
                                    }
                                }
                            ))
                            .textFieldStyle(.plain)
                            .font(.system(size: 12))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(CodeAgentTheme.sidebar)
                            .cornerRadius(8)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(CodeAgentTheme.border, lineWidth: 1)
                            )

                            Button(vm.isConnecting ? "Connecting..." : "Connect") {
                                vm.connectWithSettings()
                            }
                            .buttonStyle(.plain)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.black)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .background(vm.isConnecting ? Color.gray.opacity(0.5) : CodeAgentTheme.accent)
                            .cornerRadius(8)
                            .disabled(vm.isConnecting)
                        }
                    }
                    .padding(10)
                    .background(Color.white.opacity(0.02))
                    .cornerRadius(10)
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(CodeAgentTheme.border, lineWidth: 1)
                    )
                }
                
                // Input Toolbar
                HStack(spacing: 16) {
                    // Provider & Model Picker Button
                    Button(action: { vm.isShowingModelPicker = true }) {
                        HStack(spacing: 4) {
                            Text("Provider:")
                                .foregroundColor(.gray.opacity(0.8))
                            Text("\(vm.selectedProvider) \(vm.selectedModel)")
                                .foregroundColor(.white.opacity(0.9))
                            Image(systemName: "chevron.down")
                                .font(.system(size: 8))
                                .foregroundColor(.gray)
                        }
                        .font(.system(size: 11))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color.clear)
                        .cornerRadius(6)
                        .overlay(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(CodeAgentTheme.border, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                    
                    // Execution Mode Selector
                    HStack(spacing: 0) {
                        ModeToggleButton(title: "Plan-first", isSelected: vm.executionMode == .planFirst) {
                            withAnimation { vm.executionMode = .planFirst }
                        }
                        
                        Divider().frame(height: 12).background(CodeAgentTheme.border)
                        
                        ModeToggleButton(title: "agent", isSelected: vm.executionMode == .agent) {
                            withAnimation { vm.executionMode = .agent }
                        }
                    }
                    .padding(2) // 内部间距
                    .background(Color.white.opacity(0.02))
                    .cornerRadius(6)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(CodeAgentTheme.border, lineWidth: 1)
                    )
                    
                    Spacer()

                    Button("Clear Key") {
                        showingClearKeyConfirmation = true
                    }
                    .buttonStyle(.plain)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(vm.hasStoredApiKeyForSelectedProvider ? .red.opacity(0.85) : .gray.opacity(0.5))
                    .disabled(!vm.hasStoredApiKeyForSelectedProvider)
                    
                    // Status Indicator
                    HStack(spacing: 6) {
                        Circle()
                            .frame(width: 6, height: 6)
                            .foregroundColor(vm.connectionColor)
                        Text(vm.connectionLabel)
                            .font(.system(size: 9, weight: .bold))
                            .foregroundColor(.gray.opacity(0.6))
                    }
                }
            }
            .padding(16)
            .background(CodeAgentTheme.bg)
            .confirmationDialog(
                "Clear saved API key for \(vm.selectedProvider)?",
                isPresented: $showingClearKeyConfirmation,
                titleVisibility: .visible
            ) {
                Button("Clear Key", role: .destructive) {
                    vm.clearStoredCredentials()
                    didClearKey = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        didClearKey = false
                    }
                }
                Button("Cancel", role: .cancel) {}
            }
            .overlay(alignment: .bottomTrailing) {
                if didClearKey {
                    Text("Key cleared")
                        .font(.system(size: 10, weight: .semibold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.black.opacity(0.8))
                        .cornerRadius(6)
                        .padding(.trailing, 12)
                        .padding(.bottom, 8)
                }
            }
        }
        .background(CodeAgentTheme.bg)
    }
}

struct ChatComposerTextView: NSViewRepresentable {
    @Binding var text: String
    let isDisabled: Bool
    let onSubmit: () -> Void

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSScrollView()
        scrollView.drawsBackground = false
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = true
        scrollView.borderType = .noBorder

        let textView = SubmitAwareTextView()
        textView.delegate = context.coordinator
        textView.drawsBackground = false
        textView.isRichText = false
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticDataDetectionEnabled = false
        textView.font = .systemFont(ofSize: 13)
        textView.textColor = .white
        textView.onSubmit = onSubmit
        textView.textContainerInset = NSSize(width: 0, height: 4)
        textView.textContainer?.lineFragmentPadding = 0
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.textContainer?.containerSize = NSSize(width: scrollView.contentSize.width, height: CGFloat.greatestFiniteMagnitude)
        textView.textContainer?.widthTracksTextView = true
        textView.string = text

        scrollView.documentView = textView
        return scrollView
    }

    func updateNSView(_ nsView: NSScrollView, context: Context) {
        guard let textView = nsView.documentView as? SubmitAwareTextView else { return }
        if textView.string != text {
            textView.string = text
        }
        textView.isEditable = !isDisabled
        textView.isSelectable = true
        textView.onSubmit = onSubmit
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text)
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        @Binding var text: String

        init(text: Binding<String>) {
            _text = text
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            text = textView.string
        }
    }
}

final class SubmitAwareTextView: NSTextView {
    var onSubmit: (() -> Void)?

    override func keyDown(with event: NSEvent) {
        let isReturnKey = event.keyCode == 36 || event.keyCode == 76
        if isReturnKey {
            if hasMarkedText() {
                super.keyDown(with: event)
                return
            }

            let flags = event.modifierFlags.intersection([.shift, .option])
            if flags.isEmpty {
                onSubmit?()
                return
            }
        }
        super.keyDown(with: event)
    }
}

struct ModeToggleButton: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 10, weight: isSelected ? .bold : .regular))
                .foregroundColor(isSelected ? .white : .gray.opacity(0.6))
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(isSelected ? Color.white.opacity(0.12) : Color.clear)
                .cornerRadius(4)
        }
        .buttonStyle(.plain)
    }
}

struct ChatMessageView: View {
    let content: String
    let sender: String
    var isAssistant: Bool = true
    @State private var didCopy = false
    
    var body: some View {
        VStack(alignment: (isAssistant ? .leading : .trailing), spacing: 4) {
            VStack(alignment: .leading, spacing: 8) {
                if isAssistant {
                    HStack {
                        Spacer()
                        Button(action: copyContent) {
                            HStack(spacing: 4) {
                                Image(systemName: didCopy ? "checkmark" : "doc.on.doc")
                                if didCopy {
                                    Text("Copied")
                                } else {
                                    Text("Copy")
                                }
                            }
                            .font(.system(size: 10, weight: .medium))
                            .foregroundColor(.gray.opacity(0.9))
                        }
                        .buttonStyle(.plain)
                    }
                }

                Text(content)
                    .font(.system(size: 13))
                    .textSelection(.enabled)
            }
            .padding(12)
            .background(isAssistant ? CodeAgentTheme.sidebar : CodeAgentTheme.accent.opacity(0.2))
            .cornerRadius(8)
            
            Text(sender)
                .font(.system(size: 10))
                .foregroundColor(.gray)
                .padding(.horizontal, 4)
        }
        .frame(maxWidth: .infinity, alignment: (isAssistant ? .leading : .trailing))
    }

    private func copyContent() {
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(content, forType: .string)
        didCopy = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            didCopy = false
        }
    }
}

struct ChatSidebarView_Previews: PreviewProvider {
    static var previews: some View {
        ChatSidebarView(vm: CodeAgentViewModel())
            .frame(height: 600)
    }
}
