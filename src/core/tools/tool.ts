import { z } from 'zod';

export interface Tool<T extends z.ZodTypeAny = any> {
  name: string;
  description: string;
  parameters: T;
  execute(args: z.infer<T>): Promise<string | any>;
}
