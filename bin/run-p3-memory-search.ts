import { VectorStore } from "../src/memory/vector-store.js";
import { GLMEmbeddingProvider, HashEmbeddingProvider } from "../src/memory/embedding-provider.js";

const provider = (process.env.EMBEDDING_PROVIDER ?? "hash").toLowerCase();
const embeddingProvider =
  provider === "glm"
    ? new GLMEmbeddingProvider({
        apiKey: process.env.GLM_API_KEY ?? "",
        baseUrl: process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
        model: process.env.EMBEDDING_MODEL ?? "embedding-3",
        dimension: Number(process.env.EMBEDDING_DIMENSION ?? "1024"),
      })
    : new HashEmbeddingProvider(Number(process.env.EMBEDDING_DIMENSION ?? "128"));

const store = new VectorStore({ provider: embeddingProvider });
await store.load();

await store.add("The test script is named lint in this repo.");
await store.add("Use npm run acceptance to validate the tool loop.");
await store.add("Run npm run p1-acceptance for planning tests.");

const results = await store.search("how to run the agent acceptance", 2);
console.log("[p3-memory-search] results:");
console.log(results.map((item) => ({ id: item.id, text: item.text })));
