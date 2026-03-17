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
            
            Divider().background(CodeAgentTheme.border)
            
            HStack {
                TextField("Ask a follow-up...", text: $vm.chatInput)
                    .font(.system(size: 13))
                    .padding(8)
                    .background(CodeAgentTheme.sidebar)
                    .cornerRadius(6)
                    .overlay(
                        RoundedRectangle(cornerRadius: 6)
                            .stroke(CodeAgentTheme.border, lineWidth: 1)
                    )
                    .onSubmit {
                        vm.sendMessage()
                    }
                
                Button(action: { vm.sendMessage() }) {
                    Image(systemName: "paperplane.fill")
                        .foregroundColor(vm.chatInput.isEmpty ? .gray : CodeAgentTheme.accent)
                }
                .buttonStyle(.plain)
                .disabled(vm.chatInput.isEmpty)
            }
            .padding(12)
        }
        .background(CodeAgentTheme.bg)
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
