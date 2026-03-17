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
                    
                    Button(action: { withAnimation(.easeInOut(duration: 0.2)) { vm.isLeftSidebarVisible.toggle() } }) {
                        Image(systemName: "sidebar.left")
                            .foregroundColor(vm.isLeftSidebarVisible ? CodeAgentTheme.accent : .gray)
                    }
                    .buttonStyle(.plain)
                    
                    Button(action: { withAnimation(.easeInOut(duration: 0.2)) { vm.isTerminalVisible.toggle() } }) {
                        Image(systemName: "terminal")
                            .foregroundColor(vm.isTerminalVisible ? CodeAgentTheme.accent : .gray)
                    }
                    .buttonStyle(.plain)
                    
                    Button(action: { withAnimation(.easeInOut(duration: 0.2)) { vm.isRightSidebarVisible.toggle() } }) {
                        Image(systemName: "bubble.left.and.bubble.right")
                            .foregroundColor(vm.isRightSidebarVisible ? CodeAgentTheme.accent : .gray)
                    }
                    .buttonStyle(.plain)
                    
                    Button(action: { withAnimation(.easeInOut(duration: 0.2)) { vm.isDiffVisible.toggle() } }) {
                        Image(systemName: "sidebar.right")
                            .foregroundColor(vm.isDiffVisible ? CodeAgentTheme.accent : .gray)
                    }
                    .buttonStyle(.plain)
                }
                .font(.system(size: 14))
                .foregroundColor(.gray)
                .frame(width: 280, alignment: .trailing)
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
                if vm.isLeftSidebarVisible {
                    ProjectSidebarView(vm: vm)
                        .grayscale(1.0)
                        .opacity(0.5)
                        .transition(.move(edge: .leading))
                        .zIndex(1)
                }
                
                if vm.isRightSidebarVisible {
                    ChatSidebarView(vm: vm)
                        .transition(.asymmetric(insertion: .move(edge: .leading), removal: .move(edge: .leading)))
                }
                
                if vm.isDiffVisible {
                    DiffView(vm: vm)
                        .transition(.move(edge: .trailing))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            
            // Bottom Terminal
            if vm.isTerminalVisible {
                TerminalView()
                    .transition(.move(edge: .bottom))
                    .zIndex(2)
            }
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
