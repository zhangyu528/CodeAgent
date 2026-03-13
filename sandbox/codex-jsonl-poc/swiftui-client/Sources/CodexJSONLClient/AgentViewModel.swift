import Foundation
import SwiftUI

@MainActor
final class AgentViewModel: ObservableObject {
    struct LogEntry: Identifiable {
        let id = UUID()
        let timestamp: Date
        let direction: String
        let rawLine: String
    }

    @Published var status: String = "disconnected"
    @Published var lastResponse: String = ""
    @Published var notifications: [String] = []
    @Published var logs: [LogEntry] = []

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
                self?.notifications.append("\(method) \(params ?? [:])")
            }
        }
        client.onExit = { [weak self] code in
            Task { @MainActor in
                self?.status = "exited (\(code))"
            }
        }
    }

    func start(nodePath: String) {
        do {
            try client.start(nodePath: nodePath)
            status = "connected"
        } catch {
            status = "failed to start"
        }
    }

    func ping() {
        client.sendRequest(method: "agent/ping") { [weak self] result in
            Task { @MainActor in
                switch result {
                case .success(let res):
                    self?.lastResponse = "ping: \(res)"
                case .failure(let err):
                    self?.lastResponse = "ping error: \(err.localizedDescription)"
                }
            }
        }
    }

    func echo(_ msg: String) {
        client.sendRequest(method: "agent/echo", params: ["msg": msg]) { [weak self] result in
            Task { @MainActor in
                switch result {
                case .success(let res):
                    self?.lastResponse = "echo: \(res)"
                case .failure(let err):
                    self?.lastResponse = "echo error: \(err.localizedDescription)"
                }
            }
        }
    }

    func shutdown() {
        client.sendRequest(method: "shutdown") { _ in }
        client.sendNotification(method: "exit")
        status = "shutdown sent"
    }

    private func appendLog(direction: String, raw: String, ts: Date) {
        logs.append(LogEntry(timestamp: ts, direction: direction, rawLine: raw))
        if logs.count > maxLogs {
            logs.removeFirst(logs.count - maxLogs)
        }
    }
}
