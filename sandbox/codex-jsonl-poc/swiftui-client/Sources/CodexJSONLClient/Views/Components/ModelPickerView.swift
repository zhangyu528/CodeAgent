import SwiftUI

struct ModelPickerView: View {
    @ObservedObject var vm: CodeAgentViewModel
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Models & Providers Settings")
                    .font(.system(size: 14, weight: .bold))
                
                Spacer()
                
                HStack(spacing: 6) {
                    Circle()
                        .frame(width: 8, height: 8)
                        .foregroundColor(.green)
                    Text("Connected")
                        .font(.system(size: 11))
                        .foregroundColor(.gray)
                }
                
                Button(action: { vm.isShowingModelPicker = false }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 14))
                        .foregroundColor(.gray)
                        .padding(.leading, 12)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .background(CodeAgentTheme.sidebar)
            
            Divider().background(CodeAgentTheme.border)
            
            HStack(spacing: 0) {
                // Sidebar
                VStack(alignment: .leading, spacing: 20) {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 16) {
                            // Providers Section
                            VStack(alignment: .leading, spacing: 4) {
                                Text("PROVIDERS")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.gray)
                                    .padding(.horizontal, 12)
                                    .padding(.bottom, 4)
                                
                                SidebarItem(name: "OpenAI", icon: "square.stack.3d.up", isSelected: vm.selectedProvider == "OpenAI") {
                                    vm.selectedProvider = "OpenAI"
                                }
                                SidebarItem(name: "Anthropic", icon: "leaf", isSelected: vm.selectedProvider == "Anthropic") {
                                    vm.selectedProvider = "Anthropic"
                                }
                                SidebarItem(name: "DeepSeek", icon: "bolt", isSelected: vm.selectedProvider == "DeepSeek") {
                                    vm.selectedProvider = "DeepSeek"
                                }
                                SidebarItem(name: "GLM", icon: "brain.head.profile", isSelected: vm.selectedProvider == "GLM") {
                                    vm.selectedProvider = "GLM"
                                }
                                SidebarItem(name: "Ollama (Local)", icon: "laptopcomputer", isSelected: vm.selectedProvider == "Ollama") {
                                    vm.selectedProvider = "Ollama"
                                }
                            }
                            
                            // Collections Section
                            VStack(alignment: .leading, spacing: 4) {
                                Text("COLLECTIONS")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(.gray)
                                    .padding(.horizontal, 12)
                                    .padding(.bottom, 4)
                                
                                SidebarItem(name: "Starred Models", icon: "star", isSelected: false) {}
                                SidebarItem(name: "Fast Responses", icon: "timer", isSelected: false) {}
                            }
                        }
                        .padding(.vertical, 12)
                    }
                }
                .frame(width: 180)
                .background(CodeAgentTheme.sidebar.opacity(0.5))
                
                Divider().background(CodeAgentTheme.border)
                
                // Main Content
                VStack(alignment: .leading, spacing: 0) {
                    // Provider Settings Area
                    if let _ = vm.providerConfigs[vm.selectedProvider] {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                                    .font(.system(size: 12))
                                Text("Authentication valid")
                                    .font(.system(size: 12))
                                    .foregroundColor(.green.opacity(0.8))
                            }
                            .padding(.bottom, 4)
                            
                            HStack(spacing: 20) {
                                ConfigInputField(label: "API Key", text: Binding(
                                    get: { vm.providerConfigs[vm.selectedProvider]?.apiKey ?? "" },
                                    set: { vm.providerConfigs[vm.selectedProvider]?.apiKey = $0 }
                                ), isPassword: true)
                                
                                ConfigInputField(label: "Base URL", text: Binding(
                                    get: { vm.providerConfigs[vm.selectedProvider]?.baseUrl ?? "" },
                                    set: { vm.providerConfigs[vm.selectedProvider]?.baseUrl = $0 }
                                ))
                            }
                            
                            VStack(alignment: .leading, spacing: 4) {
                                ConfigInputField(label: "Organization ID", text: Binding(
                                    get: { vm.providerConfigs[vm.selectedProvider]?.organizationId ?? "" },
                                    set: { vm.providerConfigs[vm.selectedProvider]?.organizationId = $0 }
                                ), placeholder: "org-...")
                                Text("Optional. Required for some enterprise accounts.")
                                    .font(.system(size: 10))
                                    .foregroundColor(.gray)
                            }
                        }
                        .padding(20)
                        .background(Color.white.opacity(0.02))
                        
                        Divider().background(CodeAgentTheme.border)
                    }
                    
                    // Search Bar
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(.gray)
                        TextField("Search models...", text: $vm.searchText)
                            .textFieldStyle(.plain)
                    }
                    .font(.system(size: 12))
                    .padding(10)
                    .background(CodeAgentTheme.sidebar)
                    .cornerRadius(8)
                    .padding(.horizontal, 20)
                    .padding(.top, 16)
                    
                    // Models Grid/List
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Available Models")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(.gray)
                                .padding(.top, 8)
                            
                            let currentModels = vm.modelLibrary[vm.selectedProvider] ?? []
                            let filteredModels = currentModels.filter {
                                vm.searchText.isEmpty || $0.name.localizedCaseInsensitiveContains(vm.searchText)
                            }
                            
                            ForEach(filteredModels) { model in
                                ModelCard(
                                    model: model,
                                    isSelected: vm.selectedModel == model.name,
                                    action: { vm.selectedModel = model.name }
                                )
                            }
                        }
                        .padding(20)
                    }
                }
                .frame(maxWidth: .infinity)
            }
            
            Divider().background(CodeAgentTheme.border)
            
            // Footer
            HStack {
                HStack(spacing: 8) {
                    Circle()
                        .frame(width: 8, height: 8)
                        .foregroundColor(.green)
                    Text("Active: \(vm.selectedModel)")
                        .font(.system(size: 12, weight: .medium))
                }
                
                Spacer()
                
                HStack(spacing: 12) {
                    Button("Cancel") {
                        vm.isShowingModelPicker = false
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(Color.white.opacity(0.05))
                    .cornerRadius(6)
                    
                    Button("Apply Changes") {
                        vm.isShowingModelPicker = false
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(CodeAgentTheme.accent)
                    .cornerRadius(6)
                }
                .font(.system(size: 13, weight: .medium))
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
            .background(CodeAgentTheme.sidebar)
        }
        .frame(width: 700, height: 600)
        .background(CodeAgentTheme.bg)
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(CodeAgentTheme.border, lineWidth: 1)
        )
        .shadow(radius: 30)
    }
}

struct SidebarItem: View {
    let name: String
    let icon: String
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.system(size: 12))
                    .frame(width: 16)
                Text(name)
                    .font(.system(size: 12))
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isSelected ? CodeAgentTheme.accent.opacity(0.15) : Color.clear)
            .foregroundColor(isSelected ? CodeAgentTheme.accent : .white.opacity(0.8))
            .cornerRadius(6)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 8)
    }
}

struct ConfigInputField: View {
    let label: String
    @Binding var text: String
    var isPassword: Bool = false
    var placeholder: String = ""
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 11, weight: .bold))
                .foregroundColor(.gray)
            
            HStack {
                if isPassword {
                    SecureField(placeholder, text: $text)
                        .textFieldStyle(.plain)
                } else {
                    TextField(placeholder, text: $text)
                        .textFieldStyle(.plain)
                }
                
                if isPassword {
                    Image(systemName: "eye.slash")
                        .font(.system(size: 12))
                        .foregroundColor(.gray)
                }
            }
            .font(.system(size: 12))
            .padding(10)
            .background(CodeAgentTheme.sidebar)
            .cornerRadius(6)
            .overlay(
                RoundedRectangle(cornerRadius: 6)
                    .stroke(CodeAgentTheme.border, lineWidth: 1)
            )
        }
    }
}

struct ModelCard: View {
    let model: AIModel
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(model.name)
                            .font(.system(size: 14, weight: .bold))
                        Text(model.description)
                            .font(.system(size: 11))
                            .foregroundColor(.gray)
                    }
                    
                    Spacer()
                    
                    if model.isRecommended {
                        Text("Recommended")
                            .font(.system(size: 9, weight: .bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.green.opacity(0.2))
                            .foregroundColor(.green)
                            .cornerRadius(4)
                    }
                }
                
                HStack(spacing: 20) {
                    MetricView(label: "CONTEXT", value: model.context)
                    MetricView(label: "COST / 1M", value: model.cost)
                    MetricView(label: "LATENCY", value: model.latency)
                }
                
                HStack(spacing: 6) {
                    Circle()
                        .frame(width: 6, height: 6)
                        .foregroundColor(.green)
                    Text("Ready to use")
                        .font(.system(size: 10))
                        .foregroundColor(.gray)
                }
            }
            .padding(16)
            .background(isSelected ? CodeAgentTheme.accent.opacity(0.05) : Color.white.opacity(0.02))
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(isSelected ? CodeAgentTheme.accent : CodeAgentTheme.border, lineWidth: 1.5)
            )
        }
        .buttonStyle(.plain)
    }
}

struct MetricView: View {
    let label: String
    let value: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 9, weight: .bold))
                .foregroundColor(.gray)
            Text(value)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.white)
        }
    }
}
