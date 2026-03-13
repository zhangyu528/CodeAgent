import * as dotenv from 'dotenv';
import { LLMEngine } from '../llm/engine';
import { registerProvidersFromEnv } from '../llm/register_providers';
import { AgentController } from '../controller/agent_controller';
import { MemoryManager } from '../controller/memory_manager';
import { SecurityLayer } from '../controller/security_layer';
import { ContextInformer } from '../controller/context_informer';
import { logger } from '../utils/logger';
import { DefaultUIAdapter } from './default_ui_adapter';
import { runInitWizard } from './setup_wizard';

// Tools
import { ReadFileTool } from '../tools/read_file_tool';
import { WriteFileTool } from '../tools/write_file_tool';
import { RunCommandTool } from '../tools/run_command_tool';
import { ListDirectoryTool } from '../tools/list_directory_tool';
import { FileSearchTool } from '../tools/file_search_tool';
import { ReplaceContentTool } from '../tools/replace_content_tool';
import { SystemInfoTool } from '../tools/system_info_tool';
import { EchoTool } from '../tools/echo_tool';
import { WebSearchTool } from '../tools/web_search_tool';
import { BrowsePageTool } from '../tools/browse_page_tool';
import { SearchCodeTool } from '../tools/search_code_tool';
import { FindDefinitionTool } from '../tools/find_definition_tool';
import { ListTreeTool } from '../tools/list_tree_tool';
import { UserSelectTool } from '../tools/user_select_tool';
import { UserCheckboxTool } from '../tools/user_checkbox_tool';
import { UserEditorTool } from '../tools/user_editor_tool';

function formatProviders(list: string[]) {
  return list.length > 0 ? list.join(', ') : '(none)';
}

export async function createAgent(ui: DefaultUIAdapter) {
  const engine = new LLMEngine();

  let reg = registerProvidersFromEnv(engine);
  if (reg.registered.length === 0) {
    const success = await runInitWizard();
    if (success) {
      // Reload env again
      dotenv.config({ quiet: true });
      reg = registerProvidersFromEnv(engine);
    }

    if (reg.registered.length === 0) {
      logger.error('No LLM providers configured. Please set provider env vars in .env.');
      if (reg.skipped.length > 0) {
        logger.info(`Skipped: ${reg.skipped.map(s => `${s.name}(${s.reason})`).join(' | ')}`);
      }
      process.exit(1);
    }
  }

  const providers = engine.listProviders();

  let defaultProvider = (process.env.DEFAULT_PROVIDER || '').trim().toLowerCase();
  if (defaultProvider && !engine.hasProvider(defaultProvider)) {
    logger.error(`DEFAULT_PROVIDER=${defaultProvider} is not registered. Available: ${formatProviders(providers)}`);
    defaultProvider = '';
  }

  if (!defaultProvider) {
    defaultProvider = providers.length === 1 ? providers[0]! : (engine.hasProvider('glm') ? 'glm' : providers[0]!);
  }

  // HITL Approval Handler through UIAdapter
  const approvalHandler = async (description: string) => {
    logger.stopSpinner();
    return ui.confirmRisk(description);
  };

  const security = new SecurityLayer(process.cwd(), approvalHandler);

  const tools = [
    new ReadFileTool(),
    new WriteFileTool(),
    new RunCommandTool(),
    new ListDirectoryTool(),
    new FileSearchTool(),
    new ReplaceContentTool(),
    new SystemInfoTool(),
    new EchoTool(),
    new WebSearchTool(),
    new BrowsePageTool(security),
    new SearchCodeTool(),
    new FindDefinitionTool(),
    new ListTreeTool(),
    new UserSelectTool(ui),
    new UserCheckboxTool(ui),
    new UserEditorTool(ui),
  ];

  // F6: Workspace Trust Check
  const isTrusted = await security.isWorkspaceTrusted();
  if (!isTrusted) {
    const root = process.cwd();
    console.log(`\n\x1b[33m[Security Warning]\x1b[0m Detect start in untrusted directory: \x1b[36m${root}\x1b[0m`);
    const answer = await ui.confirmRisk({
      type: 'security',
      level: 'MEDIUM',
      title: 'Trust workspace',
      detail: root,
      reason: 'Workspace not previously trusted',
    });

    if (!answer) {
      console.log('\x1b[31m[Security] Access denied. Exiting.\x1b[0m');
      process.exit(0);
    }
    await security.grantWorkspaceTrust();
    console.log('\x1b[32m[Security] Workspace authorized.\x1b[0m\n');
  }

  const memory = new MemoryManager(4000);
  const contextInformer = new ContextInformer();
  const bootSnapshot = await contextInformer.buildBootSnapshot(process.cwd());

  const controller = new AgentController(engine, tools, defaultProvider, security, memory, {
    systemPromptContext: { bootSnapshot },
    ui,
  });

  return { controller, engine, ui };
}
