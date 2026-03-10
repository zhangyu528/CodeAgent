import { LLMEngine } from '../llm/engine';
import { AgentController } from './agent_controller';

export interface PlanStep {
  id: number;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
}

export interface Plan {
  objective: string;
  steps: PlanStep[];
}

export class Planner {
  private engine: LLMEngine;
  private providerName: string;
  private maxReplans: number;

  constructor(engine: LLMEngine, providerName: string, maxReplans: number = 2) {
    this.engine = engine;
    this.providerName = providerName;
    this.maxReplans = maxReplans;
  }

  /**
   * Use LLM to decompose a complex objective into a structured plan (list of steps).
   */
  async createPlan(objective: string): Promise<Plan> {
    const prompt = `
You are a task planner for a Coding Agent. 
Your goal is to take a complex user objective and break it down into a sequence of simple, actionable steps.

Objective: "${objective}"

Please output the plan in the following JSON format:
{
  "objective": "...",
  "steps": [
    { "id": 1, "description": "Step 1 details..." },
    { "id": 2, "description": "Step 2 details..." }
  ]
}

Guidelines:
- Each step should be clear and achievable by a Coding Agent with file access and shell command capabilities.
- Keep the number of steps reasonable (usually 3-7).
- Ensure steps are in the correct logical order.
- Return ONLY the JSON.
`;

    const response = await this.engine.generate(this.providerName, [
      { role: 'system', content: 'You are a technical task planner.' },
      { role: 'user', content: prompt }
    ]);

    return this.parsePlanResponse(response.message.content);
  }

  /**
   * Ask the LLM to create a revised plan for the remaining work,
   * given the original objective, what has been completed, and what failed.
   */
  private async replanRemaining(
    objective: string,
    completedSteps: PlanStep[],
    failedStep: PlanStep,
    errorMessage: string
  ): Promise<PlanStep[]> {
    const completedSummary = completedSteps
      .map(s => `- Step ${s.id}: ${s.description} → ✅ Done`)
      .join('\n');

    const prompt = `
You are a task planner for a Coding Agent.
The original objective was: "${objective}"

The following steps have been completed successfully:
${completedSummary || '(none yet)'}

The following step FAILED:
- Step ${failedStep.id}: ${failedStep.description}
- Error: ${errorMessage}

Please create a REVISED plan of remaining steps to still achieve the objective.
Take the failure into account — you may need to fix the error first, retry differently, or skip it.

Output ONLY the JSON:
{
  "steps": [
    { "id": 1, "description": "..." },
    { "id": 2, "description": "..." }
  ]
}
`;

    const response = await this.engine.generate(this.providerName, [
      { role: 'system', content: 'You are a technical task planner handling error recovery.' },
      { role: 'user', content: prompt }
    ]);

    const parsed = this.parsePlanResponse(response.message.content);
    return parsed.steps;
  }

  /**
   * Parse a JSON plan from the LLM response text.
   */
  private parsePlanResponse(content: string): Plan {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Failed to parse Plan JSON from LLM response");

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        objective: parsed.objective || '',
        steps: (parsed.steps || []).map((s: any, idx: number) => ({
          id: s.id ?? idx + 1,
          description: s.description,
          status: 'pending' as const,
        })),
      };
    } catch (error) {
      throw new Error(`Planner failed to generate a valid plan: ${error}`);
    }
  }

  /**
   * Execute the plan by iterating through steps and invoking the AgentController.
   * On step failure, attempts dynamic re-planning up to `maxReplans` times.
   */
  async executePlan(plan: Plan, controller: AgentController): Promise<void> {
    console.log(`\n[Planner] Starting execution for objective: ${plan.objective}\n`);

    let replansUsed = 0;
    let steps = [...plan.steps];
    let completedSteps: PlanStep[] = [];
    let i = 0;
    
    // Maintain conversational history across steps for context continuity
    let conversationHistory: any[] = [];

    while (i < steps.length) {
      const step = steps[i]!;
      step.status = 'running';
      console.log(`\x1b[36m%s\x1b[0m`, `>>> [Step ${step.id}] ${step.description}`);

      try {
        const runResult = await controller.run(
          `Current Objective: ${plan.objective}\nYour current task is: ${step.description}`,
          conversationHistory.length > 0 ? conversationHistory : undefined
        );
        
        step.status = 'completed';
        step.result = runResult.content;
        conversationHistory = runResult.messages; // Inherit history for next step
        
        completedSteps.push(step);
        console.log(`\x1b[32m%s\x1b[0m`, `<<< [Step ${step.id}] Finished successfully.\n`);
        i++;
      } catch (error: any) {
        step.status = 'failed';
        const errMsg = error.message || String(error);
        console.error(`\x1b[31m%s\x1b[0m`, `<<< [Step ${step.id}] Failed: ${errMsg}`);

        if (replansUsed < this.maxReplans) {
          replansUsed++;
          console.log(
            `\x1b[33m%s\x1b[0m`,
            `[Planner] Attempting dynamic re-plan (${replansUsed}/${this.maxReplans})...`
          );

          try {
            const newSteps = await this.replanRemaining(
              plan.objective, completedSteps, step, errMsg
            );
            console.log('[Planner] Revised steps:');
            newSteps.forEach(s => console.log(`  - ${s.id}: ${s.description}`));

            // Replace remaining steps with the new plan
            steps = newSteps;
            i = 0; // restart from the first new step
          } catch (replanError: any) {
            console.error(`\x1b[31m%s\x1b[0m`, `[Planner] Re-planning failed: ${replanError.message}`);
            throw error; // throw the original step error
          }
        } else {
          console.error(`\x1b[31m%s\x1b[0m`, `[Planner] Max re-plans (${this.maxReplans}) exhausted. Aborting.`);
          throw error;
        }
      }
    }

    console.log(`\n[Planner] Objective reached successfully!`);
  }
}

