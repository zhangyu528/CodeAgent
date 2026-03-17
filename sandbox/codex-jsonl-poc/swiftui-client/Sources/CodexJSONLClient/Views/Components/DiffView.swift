import SwiftUI

struct DiffView: View {
    @ObservedObject var vm: CodeAgentViewModel
    @State private var showAppliedSuccess = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack(spacing: 0) {
                TabItemView(title: "Diff", isActive: vm.selectedTab == .diff)
                    .onTapGesture { vm.selectedTab = .diff }
                TabItemView(title: "Timeline", isActive: vm.selectedTab == .timeline)
                    .onTapGesture { vm.selectedTab = .timeline }
                TabItemView(title: "Web", isActive: vm.selectedTab == .web)
                    .onTapGesture { vm.selectedTab = .web }
                Spacer()
            }
            .background(CodeAgentTheme.sidebar)
            
            HStack(alignment: .top, spacing: 0) {
                // Changed Files
                VStack(alignment: .leading, spacing: 0) {
                    Text("CHANGED FILES")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.gray)
                        .padding(12)
                    
                    ForEach(vm.diffFiles) { file in
                        FileListItemView(name: file.name, status: file.status, isActive: vm.selectedFile == file.name)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                vm.selectFile(file.name)
                            }
                    }
                    
                    Spacer()
                }
                .frame(width: 200)
                .background(CodeAgentTheme.sidebar)
                .overlay(
                    Rectangle()
                        .frame(width: 1)
                        .foregroundColor(CodeAgentTheme.border),
                    alignment: .trailing
                )
                
                // Code View
                ScrollView([.horizontal, .vertical]) {
                    VStack(alignment: .leading, spacing: 0) {
                        if vm.selectedFile == "db.py" {
                            DiffLineView(lineNumber: "1", content: "import sqlite3", type: .normal)
                            DiffLineView(lineNumber: "2", content: "", type: .normal)
                            DiffLineView(lineNumber: "3", content: "class Database:", type: .normal)
                            DiffLineView(lineNumber: "4", content: "-    def __init__(self):", type: .removed)
                            DiffLineView(lineNumber: "5", content: "-        self.conn = sqlite3.connect('app.db')", type: .removed)
                            DiffLineView(lineNumber: "6", content: "+    _instance = None", type: .added)
                            DiffLineView(lineNumber: "7", content: "+", type: .added)
                            DiffLineView(lineNumber: "8", content: "+    def __new__(cls):", type: .added)
                            DiffLineView(lineNumber: "9", content: "+        if cls._instance is None:", type: .added)
                        } else if vm.selectedFile == "config.json" {
                            DiffLineView(lineNumber: "1", content: "{", type: .normal)
                            DiffLineView(lineNumber: "2", content: "-  \"db_path\": \"app.db\"", type: .removed)
                            DiffLineView(lineNumber: "2", content: "+  \"db_path\": \"production.db\",", type: .added)
                            DiffLineView(lineNumber: "3", content: "+  \"version\": \"1.0.1\"", type: .added)
                            DiffLineView(lineNumber: "4", content: "}", type: .normal)
                        } else {
                            Text("No changes in \(vm.selectedFile ?? "this file")")
                                .foregroundColor(.gray)
                                .font(.system(size: 12))
                                .padding()
                        }
                    }
                    .padding(.vertical, 12)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color(hex: "#161616"))
            }
            
            // Footer Actions
            HStack {
                if showAppliedSuccess {
                    Text("Changes applied successfully!")
                        .font(.system(size: 11))
                        .foregroundColor(.green)
                        .transition(.opacity)
                }
                
                Spacer()
                Button("Discard All") {
                    withAnimation {
                        vm.diffFiles.removeAll()
                        vm.files = vm.files.map { var i = $0; i.isModified = false; return i }
                    }
                }
                .buttonStyle(SecondaryButtonStyle())
                
                Button("Apply All Changes") {
                    withAnimation {
                        showAppliedSuccess = true
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                            showAppliedSuccess = false
                            vm.diffFiles.removeAll()
                            vm.files = vm.files.map { var i = $0; i.isModified = false; return i }
                        }
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
            }
            .padding(.horizontal, 24)
            .frame(height: 56)
            .background(CodeAgentTheme.sidebar)
            .overlay(
                Rectangle()
                    .frame(height: 1)
                    .foregroundColor(CodeAgentTheme.border),
                alignment: .top
            )
        }
    }
}

struct TabItemView: View {
    let title: String
    let isActive: Bool
    
    var body: some View {
        Text(title)
            .font(.system(size: 12))
            .foregroundColor(isActive ? .white : .gray)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(isActive ? CodeAgentTheme.bg : Color.clear)
            .maskRoundedCorners(4, corners: [.topLeft, .topRight])
            .offset(y: isActive ? 1 : 0)
    }
}

struct FileListItemView: View {
    let name: String
    let status: String
    let isActive: Bool
    
    var body: some View {
        HStack {
            Text(name)
            Spacer()
            Text(status)
                .foregroundColor(.yellow)
                .font(.system(size: 10, design: .monospaced))
        }
        .font(.system(size: 12))
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(isActive ? CodeAgentTheme.accent.opacity(0.2) : Color.clear)
        .overlay(
            isActive ? Rectangle().frame(width: 2).foregroundColor(CodeAgentTheme.accent) : nil,
            alignment: .leading
        )
    }
}

enum DiffType {
    case added, removed, normal
}

struct DiffLineView: View {
    let lineNumber: String
    let content: String
    let type: DiffType
    
    var body: some View {
        HStack(spacing: 0) {
            Text(lineNumber)
                .font(.system(size: 12, design: .monospaced))
                .foregroundColor(.gray)
                .frame(width: 40, alignment: .trailing)
                .padding(.trailing, 16)
            
            Text(content)
                .font(.system(size: 12, design: .monospaced))
                .foregroundColor(textColor)
                .padding(.horizontal, 4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(bgColor)
        }
        .frame(height: 24)
    }
    
    var textColor: Color {
        switch type {
        case .added: return CodeAgentTheme.diffAddText
        case .removed: return CodeAgentTheme.diffRemoveText
        case .normal: return .white
        }
    }
    
    var bgColor: Color {
        switch type {
        case .added: return CodeAgentTheme.diffAdd
        case .removed: return CodeAgentTheme.diffRemove
        case .normal: return .clear
        }
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 12, weight: .bold))
            .foregroundColor(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 6)
            .background(CodeAgentTheme.accent)
            .cornerRadius(4)
            .shadow(radius: 2)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 12, weight: .medium))
            .foregroundColor(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 6)
            .background(Color.clear)
            .overlay(RoundedRectangle(cornerRadius: 4).stroke(CodeAgentTheme.border))
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
    }
}

extension View {
    func maskRoundedCorners(_ radius: CGFloat, corners: [RoundedCorner.Corner]) -> some View {
        clipShape( RoundedCorner(radius: radius, corners: corners) )
    }
}

struct RoundedCorner: Shape {
    var radius: CGFloat = .infinity
    var corners: [Corner] = []

    enum Corner {
        case topLeft, topRight, bottomLeft, bottomRight
    }

    func path(in rect: CGRect) -> Path {
        var path = Path()

        let w = rect.size.width
        let h = rect.size.height

        let tr = corners.contains(.topRight) ? radius : 0
        let tl = corners.contains(.topLeft) ? radius : 0
        let br = corners.contains(.bottomRight) ? radius : 0
        let bl = corners.contains(.bottomLeft) ? radius : 0

        path.move(to: CGPoint(x: w / 2.0, y: 0))
        path.addLine(to: CGPoint(x: w - tr, y: 0))
        path.addArc(center: CGPoint(x: w - tr, y: tr), radius: tr, startAngle: Angle(degrees: -90), endAngle: Angle(degrees: 0), clockwise: false)
        path.addLine(to: CGPoint(x: w, y: h - br))
        path.addArc(center: CGPoint(x: w - br, y: h - br), radius: br, startAngle: Angle(degrees: 0), endAngle: Angle(degrees: 90), clockwise: false)
        path.addLine(to: CGPoint(x: bl, y: h))
        path.addArc(center: CGPoint(x: bl, y: h - bl), radius: bl, startAngle: Angle(degrees: 90), endAngle: Angle(degrees: 180), clockwise: false)
        path.addLine(to: CGPoint(x: 0, y: tl))
        path.addArc(center: CGPoint(x: tl, y: tl), radius: tl, startAngle: Angle(degrees: 180), endAngle: Angle(degrees: 270), clockwise: false)
        path.closeSubpath()

        return path
    }
}

struct DiffView_Previews: PreviewProvider {
    static var previews: some View {
        DiffView(vm: CodeAgentViewModel())
            .frame(width: 800, height: 600)
    }
}
