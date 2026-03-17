import SwiftUI

struct TerminalView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                HStack(spacing: 16) {
                    TerminalTabItem(title: "Terminal", isActive: true)
                    TerminalTabItem(title: "Output", isActive: false)
                    TerminalTabItem(title: "Debug Console", isActive: false)
                }
                
                Spacer()
                
                HStack(spacing: 12) {
                    Image(systemName: "plus")
                    Image(systemName: "xmark")
                }
                .font(.system(size: 12))
                .foregroundColor(.gray)
            }
            .padding(.horizontal, 16)
            .frame(height: 32)
            .background(CodeAgentTheme.sidebar.opacity(0.5))
            .overlay(
                Rectangle()
                    .frame(height: 1)
                    .foregroundColor(CodeAgentTheme.border.opacity(0.5)),
                alignment: .bottom
            )
            
            // Content
            ScrollView {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text("➜").foregroundColor(.green)
                        Text("agent-workspace").foregroundColor(CodeAgentTheme.accent)
                        Text("pytest tests/test_db.py").foregroundColor(.white)
                    }
                    
                    Text("============================= test session starts ==============================")
                        .foregroundColor(.gray)
                    Text("platform linux -- Python 3.10.12, pytest-7.4.0, pluggy-1.2.0")
                        .foregroundColor(.gray)
                    Text("rootdir: /workspaces/agent-workspace")
                        .foregroundColor(.gray)
                    Text("tests/test_db.py .                                                     [100%]")
                        .foregroundColor(.green)
                    Text("============================== 1 passed in 0.05s ===============================")
                        .foregroundColor(.green)
                    
                    HStack(spacing: 8) {
                        Text("➜").foregroundColor(.green)
                        Text("agent-workspace").foregroundColor(CodeAgentTheme.accent)
                        Rectangle()
                            .frame(width: 8, height: 16)
                            .foregroundColor(.gray)
                    }
                }
                .font(.system(size: 12, design: .monospaced))
                .padding(12)
            }
        }
        .frame(height: 200)
        .background(Color.black.opacity(0.4))
    }
}

struct TerminalTabItem: View {
    let title: String
    let isActive: Bool
    
    var body: some View {
        Text(title.uppercased())
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

struct TerminalView_Previews: PreviewProvider {
    static var previews: some View {
        TerminalView()
    }
}
