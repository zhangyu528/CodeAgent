import * as dotenv from 'dotenv';
import { LLMEngine } from '../../../core/llm/engine';
import { registerProvidersFromEnv } from '../../../core/llm/register_providers';
import { AgentController } from '../../../core/controller/agent_controller';
import { MemoryManager } from '../../../core/controller/memory_manager';
import { SecurityLayer } from '../../../core/controller/security_layer';
import { ContextInformer } from '../../../core/controller/context_informer';
import { logger } from '../../../utils/logger';
import { TTY_UIAdapter } from '../adapter';
import { runInitWizard } from './setup_wizard';
import { IUIAdapter } from '../../../core/interfaces/ui';

// Tools
import { ReadFileTool } from '../../../core/tools/read_file_tool';
import { WriteFileTool } from '../../../core/tools/write_file_tool';
import { RunCommandTool } from '../../../core/tools/run_command_tool';
import { ListDirectoryTool } from '../../../core/tools/list_directory_tool';
import { FileSearchTool } from '../../../core/tools/file_search_tool';
import { ReplaceContentTool } from '../../../core/tools/replace_content_tool';
import { SystemInfoTool } from '../../../core/tools/system_info_tool';
import { EchoTool } from '../../../core/tools/echo_tool';
import { WebSearchTool } from '../../../core/tools/web_search_tool';
import { BrowsePageTool } from '../../../core/tools/browse_page_tool';
import { SearchCodeTool } from '../../../core/tools/search_code_tool';
import { FindDefinitionTool } from '../../../core/tools/find_definition_tool';
import { ListTreeTool } from '../../../core/tools/list_tree_tool';
import { UserSelectTool } from '../../../core/tools/user_select_tool';
import { UserCheckboxTool } from '../../../core/tools/user_checkbox_tool';
import { UserEditorTool } from '../../../core/tools/user_editor_tool';

function formatProviders(list: string[]) {
  return list.length > 0 ? list.join(', ') : '(none)';
}

export async function createAgent(ui: IUIAdapter) {
  const engine = new LLMEngine();

  let reg = registerProvidersFromEnv(engine);
  
  // 只有当没有任何provider（包括内置免费GLM）时才运行初始化向导
  if (reg.registered.length === 0) {
    const success = await runInitWizard();
    if (success) {
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
    return ui.confirm(description);
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
    new UserSelectTool(ui as any),
    new UserCheckboxTool(ui as any),
    new UserEditorTool(ui as any),
  ];

  // F6: Workspace Trust Check
  const isTrusted = await security.isWorkspaceTrusted();
  if (!isTrusted) {
    const root = process.cwd();
    console.log(`\n\x1b[33m[Security Warning]\x1b[0m Detect start in untrusted directory: \x1b[36m${root}\x1b[0m`);
    const answer = await ui.confirm(`Trust workspace: ${root}?`);

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

  const controller = new AgentController(engine, tools, defaultProvider, security, ui, memory, {
    systemPromptContext: { bootSnapshot }
  });

  return { controller, engine, ui };
}
