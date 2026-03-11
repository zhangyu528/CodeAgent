import crypto from "node:crypto";

export interface EmbeddingProvider {
  name: string;
  dimension: number;
  embed(text: string): Promise<number[]>;
}

export class HashEmbeddingProvider implements EmbeddingProvider {
  name = "hash-v1";
  dimension: number;

  constructor(dimension = 128) {
    this.dimension = dimension;
  }

  async embed(text: string): Promise<number[]> {
    const hash = crypto.createHash("sha256").update(text).digest();
    const values: number[] = [];
    for (let i = 0; i < this.dimension; i += 1) {
      values.push(hash[i % hash.length] / 255);
    }
    return values;
  }
}

export class GLMEmbeddingProvider implements EmbeddingProvider {
  name: string;
  dimension: number;
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(options: { apiKey: string; baseUrl: string; model: string; dimension?: number }) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl;
    this.model = options.model;
    this.dimension = options.dimension ?? 1024;
    this.name = `glm-${this.model}`;
  }

  async embed(text: string): Promise<number[]> {
    const url = this.resolveUrl(this.baseUrl);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
      }),
    });

    if (!response.ok) {
      const msg = await response.text();
      throw new Error(`GLM embedding request failed: ${response.status} ${response.statusText} - ${msg}`);
    }

    const data = (await response.json()) as { data?: Array<{ embedding: number[] }> };
    const embedding = data?.data?.[0]?.embedding;
    if (!embedding) {
      throw new Error("GLM embedding response missing embedding data.");
    }
    return embedding;
  }

  private resolveUrl(baseUrl: string): string {
    if (baseUrl.endsWith("/embeddings")) {
      return baseUrl;
    }
    return `${baseUrl.replace(/\/$/, "")}/embeddings`;
  }
}
