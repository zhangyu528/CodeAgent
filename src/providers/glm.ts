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
    const timeoutMs = this.resolveTimeoutMs();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const payload = {
      model: options.model,
      messages,
      tools: options.tools ? this.toToolPayload(options.tools) : undefined,
      tool_choice: options.tool_choice ?? "auto",
      temperature: options.temperature,
      max_tokens: options.max_tokens,
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      if (this.isAbortError(error)) {
        throw new Error(
          `GLM request timed out after ${timeoutMs}ms. Check network/DNS or increase LLM_REQUEST_TIMEOUT_MS.`
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

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

  async *generateStream(messages: Message[], options: GenerateOptions): AsyncIterable<string> {
    const url = this.resolveUrl(this.config.baseUrl);
    const timeoutMs = this.resolveTimeoutMs();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const payload = {
      model: options.model,
      messages,
      tools: options.tools ? this.toToolPayload(options.tools) : undefined,
      tool_choice: options.tool_choice ?? "auto",
      temperature: options.temperature,
      max_tokens: options.max_tokens,
      stream: true,
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      if (this.isAbortError(error)) {
        throw new Error(
          `GLM request timed out after ${timeoutMs}ms. Check network/DNS or increase LLM_REQUEST_TIMEOUT_MS.`
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok || !response.body) {
      const text = response.body ? await response.text() : "";
      throw new Error(`GLM stream request failed: ${response.status} ${response.statusText} - ${text}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) {
          continue;
        }
        const data = trimmed.slice("data:".length).trim();
        if (data === "[DONE]") {
          return;
        }
        try {
          const json = JSON.parse(data);
          const delta =
            json?.choices?.[0]?.delta?.content ??
            json?.choices?.[0]?.message?.content ??
            json?.choices?.[0]?.text;
          if (delta) {
            yield String(delta);
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }
  }

  private resolveUrl(baseUrl: string): string {
    if (baseUrl.endsWith("/chat/completions")) {
      return baseUrl;
    }

    return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  }

  private resolveTimeoutMs(): number {
    const raw = process.env.LLM_REQUEST_TIMEOUT_MS;
    if (!raw) {
      return 20_000;
    }
    const value = Number(raw);
    if (Number.isNaN(value) || value <= 0) {
      return 20_000;
    }
    return value;
  }

  private isAbortError(error: unknown): boolean {
    return (
      error instanceof Error &&
      (error.name === "AbortError" || error.message.toLowerCase().includes("aborted"))
    );
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
