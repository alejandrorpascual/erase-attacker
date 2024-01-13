import { z } from "zod";

export const paginationResponseSchema = z.object({
  limit: z.number(),
  next: z.nullable(z.string().url()),
  offset: z.number(),
  previous: z.nullable(z.string().url()),
  total: z.number(),
});

export type PaginationResponse = z.infer<typeof paginationResponseSchema>;
