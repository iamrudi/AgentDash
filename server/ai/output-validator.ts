import { z } from "zod";

export type OutputValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; errors: z.ZodIssue[] };

export function validateAIOutput<T>(
  outputSchema: z.ZodSchema<T>,
  output: unknown
): OutputValidationResult<T> {
  const validation = outputSchema.safeParse(output);

  if (!validation.success) {
    const message = validation.error.errors.map((err) => err.message).join(", ");
    return { success: false, error: message, errors: validation.error.errors };
  }

  return { success: true, data: validation.data };
}
