import SwiftUI

struct CodeAgentMainView: View {
    @StateObject private var vm = CodeAgentViewModel()
    
    var body: some View {
        VStack(spacing: 0) {
            // Window Controls & Title (Unified Toolbar)
            HStack(spacing: 0) {
                // 为系统原生红绿灯留出左侧空间
                Spacer()
                    .frame(width: 80)
                
                // 中央标题
                Text("Coding Agent — \(vm.selectedFile ?? "Project")")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.white.opacity(0.6))
                    .frame(maxWidth: .infinity)
                
                // 右侧快捷按钮
                HStack(spacing: 14) {
                    // Execution Mode Picker
                    Menu {
                        Button("Plan-first") { vm.executionMode = .planFirst }
                        Button("Auto-run") { vm.executionMode = .autoRun }
                    } label: {
                        HStack(spacing: 4) {
                            Text(vm.executionMode.rawValue)
                            Image(systemName: "chevron.down").font(.system(size: 8))
                        }
                        .font(.system(size: 10))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(4)
                    }
                    .buttonStyle(.plain)
                    
                    Group {
                        Button(action: { withAnimation(.easeInOut(duration: 0.2)) { vm.isLeftSidebarVisible.toggle() } }) {
                            Image(systemName: "sidebar.left")
                                .foregroundColor(vm.isLeftSidebarVisible ? CodeAgentTheme.accent : .gray)
                        }
                        
                        Button(action: { withAnimation(.easeInOut(duration: 0.2)) { vm.isTerminalVisible.toggle() } }) {
                            Image(systemName: "terminal")
                                .foregroundColor(vm.isTerminalVisible ? CodeAgentTheme.accent : .gray)
                        }
                        
                        Button(action: { withAnimation(.easeInOut(duration: 0.2)) { vm.isDiffVisible.toggle() } }) {
                            Image(systemName: "sidebar.right")
                                .foregroundColor(vm.isDiffVisible ? CodeAgentTheme.accent : .gray)
                        }
                    }
                    .font(.system(size: 13))
                    .buttonStyle(.plain)
                }
                .frame(width: 220, alignment: .trailing)
                .padding(.trailing, 12)
            }
            .frame(height: 32)
            .padding(.top, 2) // 极致微调：精准匹配红绿灯视觉中心
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
                
                // Chat 栏常驻且具备弹性
                ChatSidebarView(vm: vm)
                    .frame(maxWidth: .infinity)
                
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
        .ignoresSafeArea(.container, edges: .top)
    }
}

struct CodeAgentMainView_Previews: PreviewProvider {
    static var previews: some View {
        CodeAgentMainView()
    }
}
