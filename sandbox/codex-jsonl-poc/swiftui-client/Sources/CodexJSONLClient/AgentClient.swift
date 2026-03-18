import Foundation

struct AgentLaunchConfig {
    let executablePath: String
    let arguments: [String]
    let currentDirectoryURL: URL?
    let environment: [String: String]?
}

actor PendingStore {
    private var pending: [String: (Result<[String: Any], Error>) -> Void] = [:]

    func insert(id: String, callback: @escaping (Result<[String: Any], Error>) -> Void) {
        pending[id] = callback
    }

    func take(id: String) -> ((Result<[String: Any], Error>) -> Void)? {
        return pending.removeValue(forKey: id)
    }

    func drain(error: Error) -> [((Result<[String: Any], Error>) -> Void)] {
        let callbacks = Array(pending.values)
        pending.removeAll()
        return callbacks
    }
}

final class AgentClient {
    enum ClientError: Error {
        case processNotRunning
        case invalidMessage
        case processTerminated
    }

    private let writeQueue = DispatchQueue(label: "agent.client.write")
    private let readQueue = DispatchQueue(label: "agent.client.read")

    private var process: Process?
    private var stdinPipe: Pipe?
    private var stdoutPipe: Pipe?
    private var buffer = Data()
    private var isCleaningUp = false

    private let pendingStore = PendingStore()

    var onNotification: ((String, [String: Any]?) -> Void)?
    var onLogLine: ((String, String, Date) -> Void)?
    var onExit: ((Int32) -> Void)?

    func start(config: AgentLaunchConfig) throws {
        if process != nil { return }

        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: config.executablePath)
        proc.arguments = config.arguments
        proc.currentDirectoryURL = config.currentDirectoryURL
        if let environment = config.environment {
            proc.environment = ProcessInfo.processInfo.environment.merging(environment) { _, new in new }
        }

        let inPipe = Pipe()
        let outPipe = Pipe()
        proc.standardInput = inPipe
        proc.standardOutput = outPipe
        proc.standardError = FileHandle.standardError

        proc.terminationHandler = { [weak self] p in
            self?.onExit?(p.terminationStatus)
            self?.cleanup(error: ClientError.processTerminated)
        }

        try proc.run()

        process = proc
        stdinPipe = inPipe
        stdoutPipe = outPipe
        isCleaningUp = false

        startReading()
    }

    func stop() {
        guard let proc = process else { return }
        proc.terminate()
        cleanup(error: ClientError.processTerminated)
    }

    func sendRequest(method: String, params: [String: Any]? = nil, completion: @escaping (Result<[String: Any], Error>) -> Void) {
        let id = UUID().uuidString
        var msg: [String: Any] = ["id": id, "method": method]
        if let params = params { msg["params"] = params }
        Task { await pendingStore.insert(id: id, callback: completion) }
        sendMessage(msg)
    }

    func sendNotification(method: String, params: [String: Any]? = nil) {
        var msg: [String: Any] = ["method": method]
        if let params = params { msg["params"] = params }
        sendMessage(msg)
    }

    private func sendMessage(_ msg: [String: Any]) {
        guard let inPipe = stdinPipe else { return }
        writeQueue.async {
            do {
                let data = try JSONSerialization.data(withJSONObject: msg, options: [])
                var line = data
                line.append(0x0A) // \n
                if let raw = String(data: data, encoding: .utf8) {
                    self.onLogLine?("TX", raw, Date())
                }
                inPipe.fileHandleForWriting.write(line)
            } catch {
                // Ignore local serialization errors for now
            }
        }
    }

    private func startReading() {
        guard let outPipe = stdoutPipe else { return }
        let handle = outPipe.fileHandleForReading

        handle.readabilityHandler = { [weak self] h in
            let data = h.availableData
            if data.isEmpty { return }
            self?.readQueue.async {
                self?.buffer.append(data)
                self?.drainBuffer()
            }
        }
    }

    private func drainBuffer() {
        while let newlineRange = buffer.firstRange(of: Data([0x0A])) {
            let lineData = buffer.subdata(in: buffer.startIndex..<newlineRange.lowerBound)
            buffer.removeSubrange(buffer.startIndex...newlineRange.lowerBound)
            if lineData.isEmpty { continue }
            parseLine(lineData)
        }
    }

    private func parseLine(_ data: Data) {
        do {
            if let raw = String(data: data, encoding: .utf8) {
                onLogLine?("RX", raw, Date())
            }
            let obj = try JSONSerialization.jsonObject(with: data, options: [])
            guard let dict = obj as? [String: Any] else {
                return
            }
            handleMessage(dict)
        } catch {
            // Ignore malformed messages
        }
    }

    private func handleMessage(_ msg: [String: Any]) {
        if let id = msg["id"] as? String {
            if let error = msg["error"] as? [String: Any] {
                let err = NSError(domain: "AgentClient", code: -1, userInfo: error)
                Task {
                    if let callback = await pendingStore.take(id: id) {
                        callback(.failure(err))
                    }
                }
                return
            }
            if let result = msg["result"] as? [String: Any] {
                Task {
                    if let callback = await pendingStore.take(id: id) {
                        callback(.success(result))
                    }
                }
                return
            }
        }

        if let method = msg["method"] as? String, msg["id"] == nil {
            let params = msg["params"] as? [String: Any]
            onNotification?(method, params)
        }
    }

    private func cleanup(error: Error) {
        if isCleaningUp { return }
        isCleaningUp = true

        if let outPipe = stdoutPipe {
            outPipe.fileHandleForReading.readabilityHandler = nil
            outPipe.fileHandleForReading.closeFile()
        }
        if let inPipe = stdinPipe {
            inPipe.fileHandleForWriting.closeFile()
        }

        process = nil
        stdinPipe = nil
        stdoutPipe = nil

        Task {
            let callbacks = await pendingStore.drain(error: error)
            for callback in callbacks {
                callback(.failure(error))
            }
        }
    }
}
