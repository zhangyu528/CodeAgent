import SwiftUI

struct ContentView: View {
    @StateObject private var vm = AgentViewModel()
    @State private var nodePath: String = "/Users/eric/Documents/CodeAgent/sandbox/codex-jsonl-poc/node-agent/dist/agent-macos-arm64"
    @State private var echoText: String = "hello"

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Status: \(vm.status)")

            HStack {
                TextField("Node path", text: $nodePath)
                Button("Start") { vm.start(nodePath: nodePath) }
            }

            HStack {
                Button("Ping") { vm.ping() }
                TextField("Echo", text: $echoText)
                Button("Send") { vm.echo(echoText) }
            }

            Button("Shutdown") { vm.shutdown() }

            Text("Last Response:")
            Text(vm.lastResponse).font(.caption)

            Text("Notifications:")
            List(vm.notifications, id: \.self) { item in
                Text(item).font(.caption)
            }
        }
        .padding()
    }
}
