import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EmbeddingProvider } from "./embedding-provider.js";
import crypto from "node:crypto";

export interface MemoryRecord {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
  embedding: number[];
  embedding_model: string;
  dimension: number;
}

export interface VectorStoreOptions {
  storageDir?: string;
  provider: EmbeddingProvider;
}

export class VectorStore {
  private records: MemoryRecord[] = [];
  private storageDir: string;

  constructor(options: VectorStoreOptions) {
    this.storageDir = options.storageDir ?? path.resolve(process.cwd(), ".memory");
    this.provider = options.provider;
  }

  async load(): Promise<void> {
    const filePath = this.resolvePath();
    try {
      const raw = await readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw) as MemoryRecord[];
      this.records = parsed;
    } catch {
      this.records = [];
    }
  }

  async save(): Promise<void> {
    await mkdir(this.storageDir, { recursive: true });
    const filePath = this.resolvePath();
    await writeFile(filePath, JSON.stringify(this.records, null, 2), "utf-8");
  }

  async add(text: string, metadata?: Record<string, unknown>): Promise<MemoryRecord> {
    const record: MemoryRecord = {
      id: crypto.randomUUID(),
      text,
      metadata,
      embedding: await this.provider.embed(text),
      embedding_model: this.provider.name,
      dimension: this.provider.dimension,
    };
    this.records.push(record);
    await this.save();
    return record;
  }

  async search(query: string, topK = 3): Promise<MemoryRecord[]> {
    const queryEmbedding = await this.provider.embed(query);
    return this.records
      .filter((record) => record.embedding_model === this.provider.name)
      .map((record) => ({
        record,
        score: cosineSimilarity(queryEmbedding, record.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((item) => item.record);
  }

  private resolvePath(): string {
    return path.resolve(this.storageDir, "vector-store.json");
  }
  private provider: EmbeddingProvider;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}
