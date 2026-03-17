import SwiftUI

enum CodeAgentTheme {
    static let bg = Color(hex: "#1e1e1e")
    static let sidebar = Color(hex: "#252526")
    static let border = Color(hex: "#3c3c3c")
    static let diffAdd = Color(hex: "#2d4731")
    static let diffRemove = Color(hex: "#4b1818")
    static let diffAddText = Color(hex: "#b2d9b5")
    static let diffRemoveText = Color(hex: "#ffd0d0")
    static let accent = Color(hex: "#0078d4")
    static let terminalBg = Color.black.opacity(0.4)
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
