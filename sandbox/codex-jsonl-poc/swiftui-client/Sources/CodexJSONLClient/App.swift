import SwiftUI

@main
struct CodexJSONLClientApp: App {
    init() {
        // 强制应用启动时跳到最前面，并获取焦点
        NSApplication.shared.activate(ignoringOtherApps: true)
    }
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
