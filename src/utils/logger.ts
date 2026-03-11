import chalk from 'chalk';
import ora from 'ora';

export class TelemetryMonitor {
  private totalInputTokens: number = 0;
  private totalOutputTokens: number = 0;
  
  // Base rates (approximate for GLM/OpenAI style models)
  // These are example rates per 1K tokens
  private rates = {
    input: 0.005, // $0.005 per 1K tokens
    output: 0.015 // $0.015 per 1K tokens
  };

  record(input: number, output: number) {
    this.totalInputTokens += input;
    this.totalOutputTokens += output;
  }

  getSummary() {
    const cost = ((this.totalInputTokens * this.rates.input) / 1000) + 
                 ((this.totalOutputTokens * this.rates.output) / 1000);
    
    return {
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
      totalTokens: this.totalInputTokens + this.totalOutputTokens,
      estimatedCost: cost.toFixed(4)
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

  tokenUsage(usage: number, telemetry?: TelemetryMonitor) {
    this.stopSpinner();
    let text = `[System] Current Context: ~${usage} Tokens`;
    if (telemetry) {
      const summary = telemetry.getSummary();
      text += ` | Total Session: ${summary.totalTokens} Tokens ($${summary.estimatedCost})`;
    }
    console.log(chalk.dim(`  ${text}`));
  }
}

export const logger = new Logger();
