import SwiftUI

struct ModelPickerView: View {
    @ObservedObject var vm: CodeAgentViewModel
    
    let providers = [
        "OpenAI", "Anthropic", "Google", "Mistral", "Ollama"
    ]
    
    let models: [String: [String]] = [
        "OpenAI": ["GPT-4o", "GPT-4 Turbo", "GPT-3.5 Turbo"],
        "Anthropic": ["Claude 3.5 Sonnet", "Claude 3 Opus", "Claude 3 Haiku"],
        "Google": ["Gemini 1.5 Pro", "Gemini 1.5 Flash"],
        "Mistral": ["Mistral Large 2", "Mistral NeMo"],
        "Ollama": ["Llama 3.1", "CodeLlama"]
    ]
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Provider & Model Configuration")
                    .font(.system(size: 14, weight: .bold))
                Spacer()
                Button(action: { vm.isShowingModelPicker = false }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 14))
                        .foregroundColor(.gray)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .background(CodeAgentTheme.sidebar)
            
            Divider().background(CodeAgentTheme.border)
            
            HStack(spacing: 0) {
                // Providers List
                VStack(alignment: .leading, spacing: 0) {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 4) {
                            ForEach(providers, id: \.self) { provider in
                                ProviderItem(
                                    name: provider,
                                    isSelected: vm.selectedProvider == provider,
                                    action: { vm.selectedProvider = provider }
                                )
                            }
                        }
                        .padding(12)
                    }
                }
                .frame(width: 180)
                .background(CodeAgentTheme.sidebar.opacity(0.5))
                
                Divider().background(CodeAgentTheme.border)
                
                // Models List
                VStack(alignment: .leading, spacing: 0) {
                    if let selectedModels = models[vm.selectedProvider] {
                        ScrollView {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Available Models")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(.gray)
                                    .padding(.horizontal, 16)
                                    .padding(.top, 16)
                                
                                ForEach(selectedModels, id: \.self) { model in
                                    ModelItem(
                                        name: model,
                                        isSelected: vm.selectedModel == model,
                                        action: {
                                            vm.selectedModel = model
                                            vm.isShowingModelPicker = false
                                        }
                                    )
                                }
                            }
                        }
                    } else {
                        Spacer()
                        Text("Select a provider")
                            .foregroundColor(.gray)
                        Spacer()
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
        .frame(width: 500, height: 400)
        .background(CodeAgentTheme.bg)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(CodeAgentTheme.border, lineWidth: 1)
        )
        .shadow(radius: 20)
    }
}

struct ProviderItem: View {
    let name: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                Text(name)
                    .font(.system(size: 12))
                Spacer()
                if isSelected {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 10))
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isSelected ? CodeAgentTheme.accent.opacity(0.15) : Color.clear)
            .foregroundColor(isSelected ? CodeAgentTheme.accent : .white)
            .cornerRadius(6)
        }
        .buttonStyle(.plain)
    }
}

struct ModelItem: View {
    let name: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(name)
                        .font(.system(size: 13, weight: .medium))
                    Text("Optimization for coding tasks")
                        .font(.system(size: 10))
                        .foregroundColor(.gray)
                }
                Spacer()
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(CodeAgentTheme.accent)
                }
            }
            .padding(12)
            .background(Color.white.opacity(isSelected ? 0.05 : 0.02))
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? CodeAgentTheme.accent.opacity(0.5) : Color.clear, lineWidth: 1)
            )
        }
        .padding(.horizontal, 16)
        .buttonStyle(.plain)
    }
}
