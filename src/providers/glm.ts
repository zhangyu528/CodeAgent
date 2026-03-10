import type { GenerateOptions, LLMResponse, Message, ToolDefinition } from "../types.js";
import type { LLMProvider } from "../llm/provider.js";

interface GLMProviderConfig {
  apiKey: string;
  baseUrl: string;
}

export class GLMProvider implements LLMProvider {
  name = "glm";

  constructor(private config: GLMProviderConfig) {}

  async generate(messages: Message[], options: GenerateOptions): Promise<LLMResponse> {
    const url = this.resolveUrl(this.config.baseUrl);

    const payload = {
      model: options.model,
      messages,
      tools: options.tools ? this.toToolPayload(options.tools) : undefined,
      tool_choice: options.tool_choice ?? "auto",
      temperature: options.temperature,
      max_tokens: options.max_tokens,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GLM request failed: ${response.status} ${response.statusText} - ${text}`);
    }

    const data = (await response.json()) as any;
    const message = data?.choices?.[0]?.message;

    return {
      content: message?.content ?? "",
      tool_calls: message?.tool_calls ?? undefined,
    };
  }

  private resolveUrl(baseUrl: string): string {
    if (baseUrl.endsWith("/chat/completions")) {
      return baseUrl;
    }

    return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  }

  private toToolPayload(tools: ToolDefinition[]) {
    return tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }
}
