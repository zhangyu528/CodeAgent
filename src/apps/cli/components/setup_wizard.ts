import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { select, input, password, confirm } from '@inquirer/prompts';
import { GLMProvider } from '../../../core/llm/glm_provider';
import { OpenAIProvider } from '../../../core/llm/openai_provider';
import { AnthropicProvider } from '../../../core/llm/anthropic_provider';
import { DeepSeekProvider } from '../../../core/llm/deepseek_provider';

const PROVIDER_TEMPLATES: Record<string, { url: string; model: string; name: string }> = {
  deepseek: {
    name: '🐋 DeepSeek (推荐: deepseek-chat)',
    url: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat',
  },
  glm: {
    name: '🤖 GLM (智谱 AI) (推荐: glm-4)',
    url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    model: 'glm-4',
  },
  anthropic: {
    name: '🧠 Anthropic (Claude) (推荐: claude-3-5-sonnet)',
    url: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-sonnet-latest',
  },
  openai: {
    name: '⚙️  OpenAI (官方/代理)',
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
  },
  ollama: {
    name: '🏠 Ollama (本地运行)',
    url: 'http://localhost:11434',
    model: 'qwen2.5-coder',
  },
};

/**
 * Logic to generate .env content based on configuration object
 */
export function generateEnvContent(config: Record<string, string>, templateContent: string = ''): string {
  let content = templateContent;
  for (const [key, value] of Object.entries(config)) {
    const regex = new RegExp(`^#?\\s*${key}=.*`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content = content.trim() + `\n${key}=${value}`;
    }
  }
  return content.trim() + '\n';
}

/**
 * Basic connectivity test
 */
async function verifyConnection(providerKey: string, config: Record<string, string>): Promise<boolean> {
  process.stdout.write(chalk.dim(`正在验证 ${providerKey} 连通性... `));
  try {
    let provider: any;
    const testMsg = [{ role: 'user', content: 'Hi' }];

    if (providerKey === 'glm') {
      provider = new GLMProvider(config['GLM_API_KEY']!);
    } else if (providerKey === 'openai') {
      provider = new OpenAIProvider({
        apiKey: config['OPENAI_API_KEY']!,
        baseUrl: config['OPENAI_BASE_URL'],
        model: config['OPENAI_MODEL']!,
      } as any);
    } else if (providerKey === 'anthropic') {
      provider = new AnthropicProvider({
        apiKey: config['ANTHROPIC_API_KEY']!,
        baseUrl: config['ANTHROPIC_BASE_URL'],
        model: config['ANTHROPIC_MODEL']!,
      } as any);
    } else if (providerKey === 'deepseek') {
      provider = new DeepSeekProvider({
        apiKey: config['DEEPSEEK_API_KEY']!,
        baseUrl: config['DEEPSEEK_BASE_URL'],
        model: config['DEEPSEEK_MODEL']!,
      } as any);
    } else {
      // For Ollama or others, we just assume success or do a simple fetch check if needed
      console.log(chalk.yellow('跳过验证'));
      return true;
    }

    await provider.generate(testMsg, [], { maxTokens: 5 });
    console.log(chalk.green('成功！'));
    return true;
  } catch (err: any) {
    console.log(chalk.red('失败'));
    console.error(chalk.dim(`错误原因: ${err.message}`));
    return false;
  }
}

export async function runInitWizard(): Promise<boolean> {
  console.log('\n' + chalk.cyan.bold('CodeAgent CLI 初始化向导'));
  console.log(chalk.dim('未检测到可用配置，我们将引导您完成首次设置。\n'));

  const providerKey = await select({
    message: '请选择您要使用的模型服务商 (推荐代码能力强的模型):',
    choices: [
      { name: PROVIDER_TEMPLATES.deepseek!.name, value: 'deepseek' },
      { name: PROVIDER_TEMPLATES.glm!.name, value: 'glm' },
      { name: PROVIDER_TEMPLATES.anthropic!.name, value: 'anthropic' },
      { name: PROVIDER_TEMPLATES.openai!.name, value: 'openai' },
      { name: PROVIDER_TEMPLATES.ollama!.name, value: 'ollama' },
    ],
  });

  const config: Record<string, string> = {
    DEFAULT_PROVIDER: providerKey,
  };

  if (providerKey === 'ollama') {
    const ollamaUrl = await input({
      message: 'Ollama 服务地址:',
      default: PROVIDER_TEMPLATES.ollama!.url,
    });
    const ollamaModel = await input({
      message: 'Ollama 模型名称 (例如 qwen2.5-coder, deepseek-coder):',
      default: PROVIDER_TEMPLATES.ollama!.model,
    });
    config['OLLAMA_BASE_URL'] = ollamaUrl;
    config['OLLAMA_MODEL'] = ollamaModel;
  } else if (providerKey === 'openai') {
    const url = await input({
      message: 'API Base URL:',
      default: PROVIDER_TEMPLATES.openai!.url,
    });
    const model = await input({
      message: '模型名称:',
      default: PROVIDER_TEMPLATES.openai!.model,
    });
    const key = await password({
      message: 'API Key (sk-...):',
      mask: '*',
    });
    config['OPENAI_BASE_URL'] = url;
    config['OPENAI_MODEL'] = model;
    config['OPENAI_API_KEY'] = key;
  } else {
    const template = PROVIDER_TEMPLATES[providerKey]!;
    const key = await password({
      message: `请输入您的 ${providerKey.toUpperCase()} API Key (sk-...):`,
      mask: '*',
    });
    
    const prefix = providerKey.toUpperCase();
    config[`${prefix}_API_KEY`] = key;
    
    if (providerKey === 'glm') {
      config['GLM_API_URL'] = template.url;
    } else {
      config[`${prefix}_BASE_URL`] = template.url;
    }
    config[`${prefix}_MODEL`] = template.model;
  }

  // Verification
  if (providerKey !== 'ollama') {
    const isValid = await verifyConnection(providerKey, config);
    if (!isValid) {
      const retry = await confirm({
        message: '连通性验证失败。是否重新输入配置？',
        default: true,
      });
      if (retry) return runInitWizard(); // Restart wizard
      
      const proceed = await confirm({
        message: '是否坚持保存当前无效配置？',
        default: false,
      });
      if (!proceed) return false;
    } else {
      // Logic to list models and let user select
      try {
        let provider: any;
        if (providerKey === 'glm') provider = new GLMProvider(config['GLM_API_KEY']!);
        else if (providerKey === 'openai') provider = new OpenAIProvider({ apiKey: config['OPENAI_API_KEY']!, baseUrl: config['OPENAI_BASE_URL'], model: config['OPENAI_MODEL']! } as any);
        else if (providerKey === 'anthropic') provider = new AnthropicProvider({ apiKey: config['ANTHROPIC_API_KEY']!, baseUrl: config['ANTHROPIC_BASE_URL'], model: config['ANTHROPIC_MODEL']! } as any);
        else if (providerKey === 'deepseek') provider = new DeepSeekProvider({ apiKey: config['DEEPSEEK_API_KEY']!, baseUrl: config['DEEPSEEK_BASE_URL'], model: config['DEEPSEEK_MODEL']! } as any);

        const models = await provider.listModels();
        if (models && models.length > 0) {
          const selectedModel = await select({
            message: '连接成功！请选择您要使用的默认模型:',
            choices: models.map((m: string) => ({ name: m, value: m })),
          });
          const prefix = providerKey.toUpperCase();
          config[`${prefix}_MODEL`] = selectedModel as string;
        }
      } catch {
        // Ignore listing errors, keep existing default
      }
    }
  }

  // Write to .env
  try {
    const envPath = path.join(process.cwd(), '.env');
    let templateContent = '';
    
    const examplePath = path.join(process.cwd(), '.env.example');
    if (fs.existsSync(examplePath)) {
      templateContent = fs.readFileSync(examplePath, 'utf-8');
    }

    const finalContent = generateEnvContent(config, templateContent);
    fs.writeFileSync(envPath, finalContent);
    
    console.log(chalk.green(`\n✅ 配置已成功保存至 .env 文件！`));
    
    // Reload env variables for the current process
    for (const [key, value] of Object.entries(config)) {
      process.env[key] = value;
    }

    return true;
  } catch (err: any) {
    console.error(chalk.red(`\n❌ 写入配置文件失败: ${err.message}`));
    return false;
  }
}
