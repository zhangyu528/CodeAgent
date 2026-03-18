import SwiftUI

struct CodeAgentMainView: View {
    @ObservedObject var vm: CodeAgentViewModel
    
    var body: some View {
        ZStack {
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
                    HStack(spacing: 16) {
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
                    .frame(width: 120, alignment: .trailing) // 宽度从 220 减小，因为模式切换已移除
                    .padding(.trailing, 12)
                }
                .frame(height: 32)
                .padding(.top, 2)
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
                    NativeTerminalContainer()
                        .frame(height: 220)
                        .transition(.move(edge: .bottom))
                        .zIndex(2)
                }
            }
            .background(CodeAgentTheme.bg)
            .ignoresSafeArea(.container, edges: .top)
            
            // Model Picker Overlay
            if vm.isShowingModelPicker {
                ZStack {
                    Color.black.opacity(0.4)
                        .ignoresSafeArea()
                        .onTapGesture {
                            withAnimation { vm.isShowingModelPicker = false }
                        }
                    
                    ModelPickerView(vm: vm)
                        .transition(.scale(scale: 0.9).combined(with: .opacity))
                }
                .zIndex(10)
            }
        }
        .frame(minWidth: 1000, minHeight: 700)
        .preferredColorScheme(.dark)
    }
}

struct CodeAgentMainView_Previews: PreviewProvider {
    static var previews: some View {
        CodeAgentMainView(vm: CodeAgentViewModel())
    }
}
