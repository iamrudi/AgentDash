import { z } from "zod";

export const SkuCompositionRequestSchema = z.object({
  productSku: z.string().min(1),
  executionSkus: z.array(z.string()).min(1),
});

export type SkuCompositionRequest = z.infer<typeof SkuCompositionRequestSchema>;
