import chalk from 'chalk';
import ora from 'ora';

type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
};

export class TelemetryMonitor {
  private byProvider: Map<string, ProviderUsage> = new Map();

  // Base rates (approximate)
  // Example rates per 1K tokens
  private rates = {
    input: 0.005,
    output: 0.015,
  };

  // Backward compatible: record(input, output) or record(provider, input, output)
  record(providerOrInput: string | number, inputOrOutput: number, outputMaybe?: number) {
    const provider = typeof providerOrInput === 'string' ? providerOrInput : 'unknown';
    const input = typeof providerOrInput === 'string' ? inputOrOutput : providerOrInput;
    const output = typeof providerOrInput === 'string' ? (outputMaybe ?? 0) : inputOrOutput;

    const key = (provider || 'unknown').toLowerCase();
    const existing = this.byProvider.get(key) || { inputTokens: 0, outputTokens: 0 };
    existing.inputTokens += input;
    existing.outputTokens += output;
    this.byProvider.set(key, existing);
  }

  getSummary() {
    const byProvider = Array.from(this.byProvider.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, usage]) => {
        const cost = ((usage.inputTokens * this.rates.input) / 1000) + ((usage.outputTokens * this.rates.output) / 1000);
        return {
          provider: name,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.inputTokens + usage.outputTokens,
          estimatedCost: cost,
        };
      });

    const totalInputTokens = byProvider.reduce((sum, p) => sum + p.inputTokens, 0);
    const totalOutputTokens = byProvider.reduce((sum, p) => sum + p.outputTokens, 0);
    const totalCost = byProvider.reduce((sum, p) => sum + p.estimatedCost, 0);

    return {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      estimatedCost: totalCost.toFixed(4),
      byProvider: byProvider.map(p => ({
        provider: p.provider,
        totalTokens: p.totalTokens,
        estimatedCost: p.estimatedCost.toFixed(4),
      })),
    };
  }
}

export class Logger {
  private spinner = ora();

  startSpinner(text: string) {
    this.spinner.text = text;
    this.spinner.start();
  }

  stopSpinner() {
    if (this.spinner.isSpinning) {
      this.spinner.stop();
    }
  }

  thought(text: string) {
    this.stopSpinner();
    console.log(chalk.gray(`\n  [Thought] ${text}`));
  }

  action(name: string, args: any) {
    this.stopSpinner();
    const argsStr = JSON.stringify(args).substring(0, 100);
    console.log(chalk.yellow(`  [Action] ${name} `) + chalk.dim(argsStr));
  }

  observation(name: string, result: any) {
    this.stopSpinner();
    const preview = typeof result === 'string' ? result : JSON.stringify(result);
    const truncated = (preview || '').substring(0, 150) + (preview && preview.length > 150 ? '...' : '');
    console.log(chalk.magenta(`  [Observation] ${name} -> `) + chalk.white(truncated));
  }

  answer(text: string) {
    this.stopSpinner();
    console.log(chalk.green(`\n[Answer]\n${text}\n`));
  }

  error(msg: string) {
    this.stopSpinner();
    console.log(chalk.red(`\n[Error] ${msg}`));
  }

  info(msg: string) {
    this.stopSpinner();
    console.log(chalk.cyan(`\n[Info] ${msg}`));
  }

  tokenUsage(usage: number, telemetry?: TelemetryMonitor, currentProvider?: string) {
    this.stopSpinner();
    let text = `[System] Current Context: ~${usage} Tokens`;

    if (telemetry) {
      const summary = telemetry.getSummary();
      const providerLabel = currentProvider ? currentProvider : 'unknown';
      text += ` | Current Provider: ${providerLabel}`;
      text += ` | Total Session: ${summary.totalTokens} Tokens ($${summary.estimatedCost})`;

      if (summary.byProvider && summary.byProvider.length > 0) {
        const breakdown = summary.byProvider
          .map(p => `${p.provider}: ${p.totalTokens} ($${p.estimatedCost})`)
          .join(' | ');
        text += ` | ${breakdown}`;
      }
    }

    console.log(chalk.dim(`  ${text}`));
  }
}

export const logger = new Logger();
