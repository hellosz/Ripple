import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
  sse_connections: z.number().int().nonnegative(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const cliVersionResponseSchema = z.object({
  latest: z.string(),
  npm_package: z.string(),
  install_hint: z.string(),
});
export type CliVersionResponse = z.infer<typeof cliVersionResponseSchema>;

export const heatRankQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(5),
});
export type HeatRankQuery = z.infer<typeof heatRankQuerySchema>;
