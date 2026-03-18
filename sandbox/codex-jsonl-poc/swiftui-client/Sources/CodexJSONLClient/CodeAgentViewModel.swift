import Foundation
import SwiftUI

@MainActor
class CodeAgentViewModel: ObservableObject {
    struct LogEntry: Identifiable {
        let id = UUID()
        let timestamp: Date
        let direction: String
        let rawLine: String
    }

    // MARK: - App State
    @Published var connectionStatus: String = "disconnected"
    @Published var status: String = "disconnected"
    @Published var lastResponse: String = ""
    @Published var logs: [LogEntry] = []
    @Published var executionMode: ExecutionMode = .planFirst
    @Published var selectedProvider: String = "OpenAI"
    @Published var selectedModel: String = "GPT-4o"
    @Published var isShowingModelPicker: Bool = false
    @Published var isPlanning: Bool = false
    
    // MARK: - Model Picker State
    @Published var searchText: String = ""
    @Published var providerConfigs: [String: ProviderConfig] = [
        "OpenAI": ProviderConfig(baseUrl: "https://api.openai.com/v1"),
        "Anthropic": ProviderConfig(baseUrl: "https://api.anthropic.com/v1"),
        "DeepSeek": ProviderConfig(baseUrl: "https://api.deepseek.com/v1")
    ]
    
    let modelLibrary: [String: [AIModel]] = [
        "OpenAI": [
            AIModel(name: "GPT-4o", description: "Omni model for flagship performance", context: "128k", cost: "$5.00", latency: "Low", isRecommended: true),
            AIModel(name: "GPT-4 Turbo", description: "Previous flagship model", context: "128k", cost: "$10.00", latency: "Medium"),
            AIModel(name: "GPT-3.5 Turbo", description: "Fast and cost-effective", context: "16k", cost: "$0.50", latency: "Instant")
        ],
        "Anthropic": [
            AIModel(name: "Claude 3.5 Sonnet", description: "Most intelligent model", context: "200k", cost: "$3.00", latency: "Low", isRecommended: true),
            AIModel(name: "Claude 3 Opus", description: "Powerful for complex tasks", context: "200k", cost: "$15.00", latency: "Medium"),
            AIModel(name: "Claude 3 Haiku", description: "Fastest and most compact", context: "200k", cost: "$0.25", latency: "Instant")
        ],
        "DeepSeek": [
            AIModel(name: "DeepSeek-V2.5", description: "Strong coding performance", context: "128k", cost: "$0.10", latency: "Low", isRecommended: true),
            AIModel(name: "DeepSeek-Coder", description: "Specialized for programming", context: "32k", cost: "$0.10", latency: "Low")
        ]
    ]
    
    // MARK: - Layout State
    @Published var isLeftSidebarVisible: Bool = true
    @Published var isRightSidebarVisible: Bool = true
    @Published var isDiffVisible: Bool = false
    @Published var isTerminalVisible: Bool = true
    
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

    private let maxLogs = 200
    private let client = AgentClient()

    init() {
        client.onLogLine = { [weak self] direction, raw, ts in
            Task { @MainActor in
                self?.appendLog(direction: direction, raw: raw, ts: ts)
            }
        }
        client.onNotification = { [weak self] method, params in
            Task { @MainActor in
                let content = "[notify] \(method) \(params ?? [:])"
                self?.chatMessages.append(ChatMessage(role: .assistant, content: content))
            }
        }
        client.onExit = { [weak self] code in
            Task { @MainActor in
                self?.status = "exited (\(code))"
                self?.connectionStatus = self?.status ?? "exited"
            }
        }
    }
    
    // MARK: - Actions
    func sendMessage() {
        guard !chatInput.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        let userMsg = ChatMessage(role: .user, content: chatInput)
        chatMessages.append(userMsg)
        let outgoing = chatInput
        chatInput = ""

        client.sendRequest(method: "agent/echo", params: ["msg": outgoing]) { [weak self] result in
            Task { @MainActor in
                switch result {
                case .success(let res):
                    self?.lastResponse = "echo: \(res)"
                    self?.chatMessages.append(ChatMessage(role: .assistant, content: "\(res)"))
                case .failure(let err):
                    self?.lastResponse = "echo error: \(err.localizedDescription)"
                    self?.chatMessages.append(ChatMessage(role: .assistant, content: "error: \(err.localizedDescription)"))
                }
            }
        }
    }
    
    func selectFile(_ name: String) {
        selectedFile = name
    }

    func start(nodePath: String) {
        do {
            try client.start(nodePath: nodePath)
            status = "connected"
            connectionStatus = "connected"
        } catch {
            status = "failed to start"
            connectionStatus = status
        }
    }

    private func appendLog(direction: String, raw: String, ts: Date) {
        logs.append(LogEntry(timestamp: ts, direction: direction, rawLine: raw))
        if logs.count > maxLogs {
            logs.removeFirst(logs.count - maxLogs)
        }
    }
}

// MARK: - Supporting Types

enum ExecutionMode: String {
    case planFirst = "Plan-first"
    case agent = "agent"
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

struct AIModel: Identifiable, Hashable {
    let id = UUID()
    let name: String
    let description: String
    let context: String
    let cost: String
    let latency: String
    var isRecommended: Bool = false
}

struct ProviderConfig {
    var apiKey: String = ""
    var baseUrl: String = ""
    var organizationId: String = ""
    var isKeyVisible: Bool = false
}

struct DiffFile: Identifiable {
    let id = UUID()
    let name: String
    let status: String
    var isActive: Bool = false
}
