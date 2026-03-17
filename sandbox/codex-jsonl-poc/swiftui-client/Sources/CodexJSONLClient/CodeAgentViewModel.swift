import Foundation
import SwiftUI

class CodeAgentViewModel: ObservableObject {
    // MARK: - App State
    @Published var connectionStatus: String = "Connected"
    @Published var executionMode: ExecutionMode = .planFirst
    
    // MARK: - Sidebar / Explorer
    @Published var selectedFile: String? = "db.py"
    @Published var files: [FileItem] = [
        FileItem(name: "src", type: .folder),
        FileItem(name: "db.py", type: .file, extension: "py", isModified: true),
        FileItem(name: "config.json", type: .file, extension: "json", isModified: true),
        FileItem(name: "main.py", type: .file, extension: "py")
    ]
    
    // MARK: - Chat
    @Published var chatMessages: [ChatMessage] = [
        ChatMessage(role: .assistant, content: "I've updated the database connection to use a Singleton pattern. Review the changes below.")
    ]
    @Published var chatInput: String = ""
    
    // MARK: - Inspector / Diff
    @Published var selectedTab: InspectorTab = .diff
    @Published var diffFiles: [DiffFile] = [
        DiffFile(name: "db.py", status: "M", isActive: true),
        DiffFile(name: "config.json", status: "M")
    ]
    
    // MARK: - Actions
    func sendMessage() {
        guard !chatInput.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        let userMsg = ChatMessage(role: .user, content: chatInput)
        chatMessages.append(userMsg)
        chatInput = ""
        
        // Mock assistant response
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            self.chatMessages.append(ChatMessage(role: .assistant, content: "Understood. I'll check that for you."))
        }
    }
    
    func selectFile(_ name: String) {
        selectedFile = name
    }
}

// MARK: - Supporting Types

enum ExecutionMode: String {
    case planFirst = "Plan-first"
    case autoRun = "Auto-run"
}

enum InspectorTab: String {
    case timeline = "Timeline"
    case diff = "Diff"
    case web = "Web"
}

struct FileItem: Identifiable {
    let id = UUID()
    let name: String
    let type: FileType
    var `extension`: String?
    var isModified: Bool = false
    
    enum FileType {
        case file, folder
    }
}

struct ChatMessage: Identifiable {
    let id = UUID()
    let role: MessageRole
    let content: String
    
    enum MessageRole {
        case user, assistant
    }
}

struct DiffFile: Identifiable {
    let id = UUID()
    let name: String
    let status: String
    var isActive: Bool = false
}
