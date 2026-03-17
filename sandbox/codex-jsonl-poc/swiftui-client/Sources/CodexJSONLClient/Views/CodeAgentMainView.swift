import SwiftUI

struct CodeAgentMainView: View {
    @StateObject private var vm = CodeAgentViewModel()
    
    var body: some View {
        VStack(spacing: 0) {
            // Window Controls & Title
            HStack(spacing: 12) {
                HStack(spacing: 8) {
                    Circle().fill(Color(hex: "#ff5f57")).frame(width: 12, height: 12)
                    Circle().fill(Color(hex: "#febc2e")).frame(width: 12, height: 12)
                    Circle().fill(Color(hex: "#28c840")).frame(width: 12, height: 12)
                }
                .frame(width: 60)
                
                Spacer()
                
                Text("Coding Agent — \(vm.selectedFile ?? "Project")")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(.gray)
                
                Spacer()
                
                HStack(spacing: 16) {
                    // Execution Mode Picker
                    Menu {
                        Button("Plan-first") { vm.executionMode = .planFirst }
                        Button("Auto-run") { vm.executionMode = .autoRun }
                    } label: {
                        HStack(spacing: 4) {
                            Text(vm.executionMode.rawValue)
                            Image(systemName: "chevron.down").font(.system(size: 8))
                        }
                        .font(.system(size: 11))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(4)
                    }
                    .buttonStyle(.plain)
                    
                    Image(systemName: "sidebar.left")
                    Image(systemName: "terminal")
                        .foregroundColor(CodeAgentTheme.accent)
                    Image(systemName: "sidebar.right")
                }
                .font(.system(size: 14))
                .foregroundColor(.gray)
                .frame(width: 260, alignment: .trailing)
            }
            .padding(.horizontal, 12)
            .frame(height: 38)
            .background(CodeAgentTheme.sidebar)
            .overlay(
                Rectangle()
                    .frame(height: 1)
                    .foregroundColor(CodeAgentTheme.border),
                alignment: .bottom
            )
            
            // Middle Content
            HStack(spacing: 0) {
                ProjectSidebarView(vm: vm)
                    .grayscale(1.0)
                    .opacity(0.5)
                
                ChatSidebarView(vm: vm)
                    // .grayscale(1.0) // 移除置灰以支持交互
                    // .opacity(0.5)
                
                DiffView(vm: vm)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            
            // Bottom Terminal
            TerminalView()
        }
        .frame(minWidth: 1000, minHeight: 700)
        .background(CodeAgentTheme.bg)
        .preferredColorScheme(.dark)
    }
}

struct CodeAgentMainView_Previews: PreviewProvider {
    static var previews: some View {
        CodeAgentMainView()
    }
}
