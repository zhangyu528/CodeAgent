import Foundation

final class AgentClient {
    enum ClientError: Error {
        case processNotRunning
        case invalidMessage
    }

    private let writeQueue = DispatchQueue(label: "agent.client.write")
    private let readQueue = DispatchQueue(label: "agent.client.read")

    private var process: Process?
    private var stdinPipe: Pipe?
    private var stdoutPipe: Pipe?
    private var buffer = Data()

    private var pending: [String: (Result<[String: Any], Error>) -> Void] = [:]

    var onNotification: ((String, [String: Any]?) -> Void)?
    var onExit: ((Int32) -> Void)?

    func start(nodePath: String) throws {
        if process != nil { return }

        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: "/usr/bin/env")
        proc.arguments = ["node", nodePath]

        let inPipe = Pipe()
        let outPipe = Pipe()
        proc.standardInput = inPipe
        proc.standardOutput = outPipe
        proc.standardError = FileHandle.standardError

        proc.terminationHandler = { [weak self] p in
            self?.onExit?(p.terminationStatus)
        }

        try proc.run()

        process = proc
        stdinPipe = inPipe
        stdoutPipe = outPipe

        startReading()
    }

    func stop() {
        guard let proc = process else { return }
        proc.terminate()
        process = nil
        stdinPipe = nil
        stdoutPipe = nil
    }

    func sendRequest(method: String, params: [String: Any]? = nil, completion: @escaping (Result<[String: Any], Error>) -> Void) {
        let id = UUID().uuidString
        var msg: [String: Any] = ["id": id, "method": method]
        if let params = params { msg["params"] = params }
        pending[id] = completion
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
                if let callback = pending.removeValue(forKey: id) {
                    callback(.failure(err))
                }
                return
            }
            if let result = msg["result"] as? [String: Any] {
                if let callback = pending.removeValue(forKey: id) {
                    callback(.success(result))
                }
                return
            }
        }

        if let method = msg["method"] as? String, msg["id"] == nil {
            let params = msg["params"] as? [String: Any]
            onNotification?(method, params)
        }
    }
}
