import { RunCommandTool } from "../src/tools/run-command-tool.js";
import { ToolSystem } from "../src/tools/tool-system.js";

const toolSystem = new ToolSystem([RunCommandTool]);

async function main() {
  console.log("[p2-security] attempting high-risk command: rm -rf /tmp/p2-security-demo");

  try {
    const result = await toolSystem.execute("run_command", {
      cmd: "rm",
      args: ["-rf", "/tmp/p2-security-demo"],
    });
    console.log("[p2-security] result:", result);
  } catch (error) {
    console.error(
      `[p2-security] blocked or rejected: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  console.log("[p2-security] attempting review command: rm -f ./tmp/p2-review-demo.txt");

  try {
    const result = await toolSystem.execute("run_command", {
      cmd: "rm",
      args: ["-f", "./tmp/p2-review-demo.txt"],
    });
    console.log("[p2-security] review result:", result);
  } catch (error) {
    console.error(
      `[p2-security] review blocked or rejected: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

main().catch((error) => {
  console.error(
    `[p2-security] fatal error: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
