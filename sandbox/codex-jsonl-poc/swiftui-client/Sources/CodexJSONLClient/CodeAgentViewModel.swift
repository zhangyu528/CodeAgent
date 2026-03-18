import Foundation
import SwiftUI

@MainActor
class CodeAgentViewModel: ObservableObject {
    enum ConnectionPhase: Equatable {
        case idle
        case starting
        case initializing
        case connected
        case failed(String)
    }

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
    @Published var connectionPhase: ConnectionPhase = .idle
    @Published var capabilities: [String] = []
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
        ChatMessage(role: .assistant, content: "Connecting to local agent...")
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
    private var hasAttemptedConnection = false

    private let launchConfig = AgentLaunchConfig(
        executablePath: "/Users/eric/Documents/CodeAgent/sandbox/codex-jsonl-poc/node-agent/dist/agent-macos-arm64",
        arguments: [],
        currentDirectoryURL: URL(fileURLWithPath: "/Users/eric/Documents/CodeAgent/sandbox/codex-jsonl-poc/node-agent", isDirectory: true),
        environment: nil
    )

    init() {
        client.onLogLine = { [weak self] direction, raw, ts in
            Task { @MainActor in
                self?.appendLog(direction: direction, raw: raw, ts: ts)
            }
        }
        client.onNotification = { [weak self] method, params in
            Task { @MainActor in
                self?.handleNotification(method: method, params: params)
            }
        }
        client.onExit = { [weak self] code in
            Task { @MainActor in
                let message = "exited (\(code))"
                self?.connectionPhase = .failed(message)
                self?.status = message
                self?.connectionStatus = message
            }
        }
    }
    
    // MARK: - Actions
    func connectIfNeeded() {
        guard !hasAttemptedConnection else { return }
        hasAttemptedConnection = true
        connectionPhase = .starting
        status = "starting"
        connectionStatus = "starting"

        do {
            try client.start(config: launchConfig)
            initializeAgent()
        } catch {
            let message = "failed to start"
            connectionPhase = .failed(message)
            status = message
            connectionStatus = message
            lastResponse = error.localizedDescription
            replaceConnectionMessage(with: "Failed to start local agent: \(error.localizedDescription)")
        }
    }

    func sendMessage() {
        guard !chatInput.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        guard isConnected else {
            lastResponse = "Agent is not ready"
            chatMessages.append(ChatMessage(role: .assistant, content: "Agent is not ready yet. Please wait for the connection to complete."))
            return
        }

        let userMsg = ChatMessage(role: .user, content: chatInput)
        chatMessages.append(userMsg)
        let outgoing = chatInput
        chatInput = ""

        client.sendRequest(method: "agent/echo", params: ["msg": outgoing]) { [weak self] result in
            Task { @MainActor in
                switch result {
                case .success(let res):
                    let rendered = self?.stringifyJSON(res) ?? "\(res)"
                    self?.lastResponse = "echo: \(rendered)"
                    if let echoed = res["echo"] {
                        self?.chatMessages.append(ChatMessage(role: .assistant, content: self?.stringifyValue(echoed) ?? "\(echoed)"))
                    } else {
                        self?.chatMessages.append(ChatMessage(role: .assistant, content: rendered))
                    }
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

    var connectionLabel: String {
        switch connectionPhase {
        case .idle:
            return "DISCONNECTED"
        case .starting, .initializing:
            return "CONNECTING"
        case .connected:
            return "AGENT READY"
        case .failed:
            return "FAILED"
        }
    }

    var connectionColor: Color {
        switch connectionPhase {
        case .idle:
            return .gray.opacity(0.8)
        case .starting, .initializing:
            return .orange.opacity(0.9)
        case .connected:
            return .green.opacity(0.8)
        case .failed:
            return .red.opacity(0.85)
        }
    }

    var isConnected: Bool {
        if case .connected = connectionPhase {
            return true
        }
        return false
    }

    private func appendLog(direction: String, raw: String, ts: Date) {
        logs.append(LogEntry(timestamp: ts, direction: direction, rawLine: raw))
        if logs.count > maxLogs {
            logs.removeFirst(logs.count - maxLogs)
        }
    }

    private func initializeAgent() {
        connectionPhase = .initializing
        status = "initializing"
        connectionStatus = "initializing"

        client.sendRequest(method: "initialize", params: ["client": "SwiftUI", "version": "0.1.0"]) { [weak self] result in
            Task { @MainActor in
                switch result {
                case .success(let res):
                    let capabilities = (res["capabilities"] as? [String]) ?? []
                    self?.capabilities = capabilities
                    self?.connectionPhase = .connected
                    self?.status = "connected"
                    self?.connectionStatus = "connected"
                    self?.lastResponse = "initialize: \(self?.stringifyJSON(res) ?? "\(res)")"
                    self?.replaceConnectionMessage(with: "Local agent connected. Capabilities: \(capabilities.joined(separator: ", "))")
                case .failure(let err):
                    let message = "initialize failed"
                    self?.connectionPhase = .failed(message)
                    self?.status = message
                    self?.connectionStatus = message
                    self?.lastResponse = err.localizedDescription
                    self?.replaceConnectionMessage(with: "Failed to initialize local agent: \(err.localizedDescription)")
                }
            }
        }
    }

    private func handleNotification(method: String, params: [String: Any]?) {
        let content = "[notify] \(method) \(params ?? [:])"
        if method == "agent/notify" {
            lastResponse = content
        }
        chatMessages.append(ChatMessage(role: .assistant, content: content))
    }

    private func replaceConnectionMessage(with content: String) {
        if let firstAssistantIndex = chatMessages.firstIndex(where: { $0.role == .assistant }) {
            chatMessages[firstAssistantIndex] = ChatMessage(role: .assistant, content: content)
        } else {
            chatMessages.insert(ChatMessage(role: .assistant, content: content), at: 0)
        }
    }

    private func stringifyJSON(_ value: [String: Any]) -> String {
        stringifyValue(value)
    }

    private func stringifyValue(_ value: Any) -> String {
        guard JSONSerialization.isValidJSONObject(value),
              let data = try? JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted]),
              let text = String(data: data, encoding: .utf8) else {
            return "\(value)"
        }
        return text
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
