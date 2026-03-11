import { MemoryManager } from "../src/memory/memory-manager.js";

const sessionId = "p2-demo";

const memory = new MemoryManager({
  maxItems: 2,
  summarize: async (items) => ({
    role: "system",
    content: `[summary] ${items.map((item) => item.content).join(" | ")}`,
  }),
});
await memory.add({ role: "system", content: "System prompt" });
await memory.add({ role: "user", content: "First task" });
await memory.add({ role: "assistant", content: "First response" });

await memory.saveState(sessionId);
console.log("[p2-memory] saved");

const loaded = new MemoryManager({ maxItems: 5 });
await loaded.loadState(sessionId);
console.log("[p2-memory] loaded snapshot:");
console.log(loaded.getSnapshot());
