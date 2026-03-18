import SwiftUI

struct ChatSidebarView: View {
    @ObservedObject var vm: CodeAgentViewModel
    
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
                    TextField("How can I help you today?", text: $vm.chatInput)
                        .font(.system(size: 13))
                        .textFieldStyle(.plain)
                        .foregroundColor(.white)
                        .disabled(!vm.isConnected || vm.isAwaitingReply)
                    
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
        }
        .background(CodeAgentTheme.bg)
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
    
    var body: some View {
        VStack(alignment: (isAssistant ? .leading : .trailing), spacing: 4) {
            Text(content)
                .font(.system(size: 13))
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
}

struct ChatSidebarView_Previews: PreviewProvider {
    static var previews: some View {
        ChatSidebarView(vm: CodeAgentViewModel())
            .frame(height: 600)
    }
}
