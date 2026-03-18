import Foundation
import SwiftUI

@MainActor
class CodeAgentViewModel: ObservableObject {
    enum ConnectionPhase: Equatable {
        case idle
        case starting
        case probing
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
    @Published var isAwaitingReply: Bool = false
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
    private var probeRequestId: String?
    private var pendingPromptId: String?
    private var pendingAssistantDraftIndex: Int?
    private var pendingAssistantText: String = ""
    private var probeTimeoutTask: Task<Void, Never>?
    private var promptTimeoutTask: Task<Void, Never>?

    init() {
        client.onLogLine = { [weak self] direction, raw, ts in
            Task { @MainActor in
                self?.appendLog(direction: direction, raw: raw, ts: ts)
            }
        }
        client.onMessage = { [weak self] msg in
            Task { @MainActor in
                self?.handleRpcMessage(msg)
            }
        }
        client.onExit = { [weak self] code in
            Task { @MainActor in
                let message = "exited (\(code))"
                self?.connectionPhase = .failed(message)
                self?.status = message
                self?.connectionStatus = message
                self?.cleanupPendingTasks()
                self?.isAwaitingReply = false
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
            try client.start(config: buildLaunchConfig())
            sendGetStateProbe()
        } catch {
            let message = "failed to start"
            connectionPhase = .failed(message)
            status = message
            connectionStatus = message
            lastResponse = error.localizedDescription
            replaceConnectionMessage(with: "Failed to start local pi RPC: \(error.localizedDescription)")
        }
    }

    func sendMessage() {
        guard !chatInput.trimmingCharacters(in: .whitespaces).isEmpty else { return }
        guard isConnected else {
            lastResponse = "Agent is not ready"
            chatMessages.append(ChatMessage(role: .assistant, content: "Agent is not ready yet. Please wait for the connection to complete."))
            return
        }
        guard pendingPromptId == nil else {
            chatMessages.append(ChatMessage(role: .assistant, content: "A response is already in progress. Please wait for completion."))
            return
        }

        let userMsg = ChatMessage(role: .user, content: chatInput)
        chatMessages.append(userMsg)
        let outgoing = chatInput
        chatInput = ""
        isAwaitingReply = true
        pendingAssistantDraftIndex = nil
        pendingAssistantText = ""

        let promptId = UUID().uuidString
        pendingPromptId = promptId
        schedulePromptTimeout(for: promptId)

        client.sendRpcCommand(id: promptId, type: "prompt", payload: ["message": outgoing]) { [weak self] result in
            Task { @MainActor in
                switch result {
                case .success(let response):
                    if let success = response["success"] as? Bool, !success {
                        let errorText = response["error"] as? String ?? "prompt failed"
                        self?.handlePromptFailure(for: promptId, errorText: errorText)
                    }
                case .failure(let err):
                    self?.handlePromptFailure(for: promptId, errorText: err.localizedDescription)
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
        case .starting, .probing:
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
        case .starting, .probing:
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

    private func replaceConnectionMessage(with content: String) {
        if let firstAssistantIndex = chatMessages.firstIndex(where: { $0.role == .assistant }) {
            chatMessages[firstAssistantIndex] = ChatMessage(role: .assistant, content: content)
        } else {
            chatMessages.insert(ChatMessage(role: .assistant, content: content), at: 0)
        }
    }

    private func buildLaunchConfig() -> AgentLaunchConfig {
        var environment: [String: String] = [:]
        if let cfg = providerConfigs[selectedProvider], !cfg.apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let key = cfg.apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
            switch selectedProvider {
            case "OpenAI":
                environment["OPENAI_API_KEY"] = key
                if !cfg.baseUrl.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    environment["OPENAI_BASE_URL"] = cfg.baseUrl
                }
            case "Anthropic":
                environment["ANTHROPIC_API_KEY"] = key
                if !cfg.baseUrl.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    environment["ANTHROPIC_BASE_URL"] = cfg.baseUrl
                }
            case "DeepSeek":
                environment["DEEPSEEK_API_KEY"] = key
                if !cfg.baseUrl.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    environment["DEEPSEEK_BASE_URL"] = cfg.baseUrl
                }
            default:
                break
            }
        }

        return AgentLaunchConfig(
            executablePath: "/Users/eric/Documents/pi-mono/packages/coding-agent/dist/pi",
            arguments: ["--mode", "rpc"],
            currentDirectoryURL: URL(fileURLWithPath: "/Users/eric/Documents/pi-mono/packages/coding-agent", isDirectory: true),
            environment: environment.isEmpty ? nil : environment
        )
    }

    private func sendGetStateProbe() {
        let probeId = "probe-\(UUID().uuidString)"
        probeRequestId = probeId
        connectionPhase = .probing
        status = "probing"
        connectionStatus = "probing"
        scheduleProbeTimeout(for: probeId)

        client.sendRpcCommand(id: probeId, type: "get_state") { [weak self] result in
            Task { @MainActor in
                switch result {
                case .success(let response):
                    self?.handleProbeResponse(probeId: probeId, response: response)
                case .failure(let err):
                    self?.markConnectionFailed(message: "probe failed: \(err.localizedDescription)")
                }
            }
        }
    }

    private func handleRpcMessage(_ message: [String: Any]) {
        guard message["id"] == nil else { return }
        guard let type = message["type"] as? String else { return }

        switch type {
        case "message_end":
            handleAssistantMessageEnd(message)
        case "agent_end":
            handleAgentEnd(message)
        default:
            break
        }
    }

    private func handleProbeResponse(probeId: String, response: [String: Any]) {
        guard probeRequestId == probeId else { return }
        probeTimeoutTask?.cancel()
        probeTimeoutTask = nil
        probeRequestId = nil

        let success = (response["success"] as? Bool) ?? false
        let command = response["command"] as? String
        guard success, command == "get_state" else {
            let errorText = response["error"] as? String ?? "invalid probe response"
            markConnectionFailed(message: errorText)
            return
        }

        if let data = response["data"] as? [String: Any] {
            capabilities = ["rpc"]
            lastResponse = "get_state: \(stringifyJSON(data))"
        }
        connectionPhase = .connected
        status = "connected"
        connectionStatus = "connected"
        replaceConnectionMessage(with: "Pi RPC connected.")
    }

    private func handleAssistantMessageEnd(_ event: [String: Any]) {
        guard pendingPromptId != nil else { return }
        guard let message = event["message"] as? [String: Any] else { return }
        guard (message["role"] as? String) == "assistant" else { return }

        let extractedText = extractAssistantText(from: message)
        guard !extractedText.isEmpty else { return }
        pendingAssistantText = extractedText
        if let index = pendingAssistantDraftIndex, chatMessages.indices.contains(index) {
            chatMessages[index] = ChatMessage(role: .assistant, content: extractedText)
        } else {
            chatMessages.append(ChatMessage(role: .assistant, content: extractedText))
            pendingAssistantDraftIndex = chatMessages.count - 1
        }
        lastResponse = "message_end received"
    }

    private func handleAgentEnd(_ event: [String: Any]) {
        guard pendingPromptId != nil else { return }
        if pendingAssistantDraftIndex == nil {
            chatMessages.append(ChatMessage(role: .assistant, content: "No assistant message received."))
        }
        if let messages = event["messages"] as? [[String: Any]], let last = messages.last {
            let summary = extractAssistantText(from: last)
            if !summary.isEmpty {
                lastResponse = summary
            }
        }
        completePrompt()
    }

    private func extractAssistantText(from message: [String: Any]) -> String {
        guard let content = message["content"] as? [[String: Any]] else { return "" }
        let chunks = content.compactMap { item -> String? in
            guard let type = item["type"] as? String, type == "text" else { return nil }
            return item["text"] as? String
        }
        return chunks.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func scheduleProbeTimeout(for probeId: String) {
        probeTimeoutTask?.cancel()
        probeTimeoutTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 5_000_000_000)
            await MainActor.run {
                guard let self = self, self.probeRequestId == probeId else { return }
                self.markConnectionFailed(message: "probe timeout")
            }
        }
    }

    private func schedulePromptTimeout(for promptId: String) {
        promptTimeoutTask?.cancel()
        promptTimeoutTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 90_000_000_000)
            await MainActor.run {
                guard let self = self, self.pendingPromptId == promptId else { return }
                self.handlePromptFailure(for: promptId, errorText: "prompt timeout")
            }
        }
    }

    private func handlePromptFailure(for promptId: String, errorText: String) {
        guard pendingPromptId == promptId else { return }
        chatMessages.append(ChatMessage(role: .assistant, content: "error: \(errorText)"))
        lastResponse = errorText
        completePrompt()
    }

    private func completePrompt() {
        pendingPromptId = nil
        pendingAssistantDraftIndex = nil
        pendingAssistantText = ""
        isAwaitingReply = false
        promptTimeoutTask?.cancel()
        promptTimeoutTask = nil
    }

    private func markConnectionFailed(message: String) {
        connectionPhase = .failed(message)
        status = message
        connectionStatus = message
        lastResponse = message
        replaceConnectionMessage(with: "Pi RPC connection failed: \(message)")
        cleanupPendingTasks()
    }

    private func cleanupPendingTasks() {
        probeRequestId = nil
        pendingPromptId = nil
        pendingAssistantDraftIndex = nil
        pendingAssistantText = ""
        probeTimeoutTask?.cancel()
        promptTimeoutTask?.cancel()
        probeTimeoutTask = nil
        promptTimeoutTask = nil
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
