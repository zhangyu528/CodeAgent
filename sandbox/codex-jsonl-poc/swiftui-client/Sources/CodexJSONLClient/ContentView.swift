import SwiftUI

struct ContentView: View {
    @StateObject private var vm = AgentViewModel()
    @State private var showingDebug = false
    @State private var dragOffset = CGSize.zero
    @State private var position = CGSize.zero
    
    var body: some View {
        ZStack(alignment: .topTrailing) {
            CodeAgentMainView()
            
            // Debug Toggle (Draggable)
            Button(action: { showingDebug.toggle() }) {
                Image(systemName: "ladybug.fill")
                    .foregroundColor(.orange)
                    .padding(8)
                    .background(Color.black.opacity(0.5))
                    .clipShape(Circle())
            }
            .padding(10)
            .offset(x: dragOffset.width + position.width,
                    y: dragOffset.height + position.height)
            .gesture(
                DragGesture()
                    .onChanged { value in
                        dragOffset = value.translation
                    }
                    .onEnded { value in
                        position.width += value.translation.width
                        position.height += value.translation.height
                        dragOffset = .zero
                    }
            )
            .help("Toggle Debug Overlay")
            
            if showingDebug {
                debugOverlay
            }
        }
    }
    
    private var debugOverlay: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Debug Console").bold()
                Spacer()
                Button("Close") { showingDebug = false }
            }
            
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Status: \(vm.status)")
                    Text("Last Response: \(vm.lastResponse)").font(.caption)
                    
                    Divider()
                    
                    Text("JSONL Logs:").bold()
                    ForEach(vm.logs) { entry in
                        Text("\(entry.direction): \(entry.rawLine)")
                            .font(.system(size: 10, design: .monospaced))
                    }
                }
            }
        }
        .padding()
        .frame(width: 400, height: 500)
        .background(Color.black.opacity(0.85))
        .cornerRadius(12)
        .padding()
        .transition(.move(edge: .trailing))
    }
}
