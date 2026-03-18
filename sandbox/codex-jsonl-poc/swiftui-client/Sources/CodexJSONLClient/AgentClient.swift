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
    private var stderrPipe: Pipe?
    private var buffer = Data()
    private var stderrBuffer = Data()
    private var isCleaningUp = false

    private let pendingStore = PendingStore()

    var onMessage: (([String: Any]) -> Void)?
    var onLogLine: ((String, String, Date) -> Void)?
    var onStderrLine: ((String) -> Void)?
    var onExit: ((Int32) -> Void)?
    var isRunning: Bool { process != nil }

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
        let errPipe = Pipe()
        proc.standardInput = inPipe
        proc.standardOutput = outPipe
        proc.standardError = errPipe

        proc.terminationHandler = { [weak self] p in
            self?.onExit?(p.terminationStatus)
            self?.cleanup(error: ClientError.processTerminated)
        }

        try proc.run()

        process = proc
        stdinPipe = inPipe
        stdoutPipe = outPipe
        stderrPipe = errPipe
        isCleaningUp = false

        startReadingStdout()
        startReadingStderr()
    }

    func stop() {
        if let proc = process {
            proc.terminate()
        }
        cleanup(error: ClientError.processTerminated)
    }

    func sendRpcCommand(id: String = UUID().uuidString, type: String, payload: [String: Any] = [:], completion: @escaping (Result<[String: Any], Error>) -> Void) {
        guard process != nil, stdinPipe != nil else {
            completion(.failure(ClientError.processNotRunning))
            return
        }
        var msg: [String: Any] = ["id": id, "type": type]
        for (k, v) in payload {
            msg[k] = v
        }
        Task {
            await pendingStore.insert(id: id, callback: completion)
            sendMessage(msg)
        }
    }

    func sendRpcEvent(type: String, payload: [String: Any] = [:]) {
        var msg: [String: Any] = ["type": type]
        for (k, v) in payload {
            msg[k] = v
        }
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

    private func startReadingStdout() {
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

    private func startReadingStderr() {
        guard let errPipe = stderrPipe else { return }
        let handle = errPipe.fileHandleForReading

        handle.readabilityHandler = { [weak self] h in
            let data = h.availableData
            if data.isEmpty { return }
            self?.readQueue.async {
                self?.stderrBuffer.append(data)
                self?.drainStderrBuffer()
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
            if msg["type"] as? String == "response" {
                Task {
                    if let callback = await pendingStore.take(id: id) {
                        if let success = msg["success"] as? Bool, success == false {
                            let errorText = msg["error"] as? String ?? "RPC command failed"
                            let err = NSError(domain: "AgentClient", code: -1, userInfo: [NSLocalizedDescriptionKey: errorText])
                            callback(.failure(err))
                        } else {
                            callback(.success(msg))
                        }
                    }
                }
                return
            }

            if let error = msg["error"] as? [String: Any] {
                let err = NSError(domain: "AgentClient", code: -1, userInfo: error)
                Task {
                    if let callback = await pendingStore.take(id: id) {
                        callback(.failure(err))
                    }
                }
                return
            }
        }

        onMessage?(msg)
    }

    private func drainStderrBuffer() {
        while let newlineRange = stderrBuffer.firstRange(of: Data([0x0A])) {
            let lineData = stderrBuffer.subdata(in: stderrBuffer.startIndex..<newlineRange.lowerBound)
            stderrBuffer.removeSubrange(stderrBuffer.startIndex...newlineRange.lowerBound)
            if lineData.isEmpty { continue }
            if let line = String(data: lineData, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines),
               !line.isEmpty {
                onLogLine?("ERR", line, Date())
                onStderrLine?(line)
            }
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
        if let errPipe = stderrPipe {
            errPipe.fileHandleForReading.readabilityHandler = nil
            errPipe.fileHandleForReading.closeFile()
        }

        process = nil
        stdinPipe = nil
        stdoutPipe = nil
        stderrPipe = nil
        buffer.removeAll(keepingCapacity: false)
        stderrBuffer.removeAll(keepingCapacity: false)

        Task {
            let callbacks = await pendingStore.drain(error: error)
            for callback in callbacks {
                callback(.failure(error))
            }
        }
    }
}
