import SwiftUI

struct ProjectSidebarView: View {
    @ObservedObject var vm: CodeAgentViewModel
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("EXPLORER")
                .font(.system(size: 10, weight: .bold))
                .tracking(1.2)
                .foregroundColor(.gray)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
            
            ScrollView {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(vm.files) { item in
                        FileItemView(
                            icon: item.type == .folder ? "folder.fill" : "doc.plaintext.fill",
                            name: item.name,
                            isSelected: vm.selectedFile == item.name,
                            color: item.isModified ? .yellow : .gray
                        )
                        .contentShape(Rectangle())
                        .onTapGesture {
                            vm.selectFile(item.name)
                        }
                    }
                }
                .padding(.horizontal, 8)
            }
            
            Spacer()
        }
        .frame(width: 250)
        .background(CodeAgentTheme.sidebar)
        .overlay(
            Rectangle()
                .frame(width: 1)
                .foregroundColor(CodeAgentTheme.border),
            alignment: .trailing
        )
    }
}

struct FileItemView: View {
    let icon: String
    let name: String
    var isSelected: Bool = false
    var color: Color = .gray
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .foregroundColor(isSelected ? CodeAgentTheme.accent : color)
                .frame(width: 16)
            
            Text(name)
                .font(.system(size: 13))
                .foregroundColor(isSelected ? .white : .gray)
            
            Spacer()
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(isSelected ? CodeAgentTheme.accent.opacity(0.15) : Color.clear)
        .cornerRadius(4)
    }
}

struct ProjectSidebarView_Previews: PreviewProvider {
    static var previews: some View {
        ProjectSidebarView(vm: CodeAgentViewModel())
            .frame(height: 600)
    }
}
