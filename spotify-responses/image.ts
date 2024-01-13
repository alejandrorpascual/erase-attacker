import { z } from "zod";

export const imageResponseSchema = z.object({
  height: z.number(),
  url: z.string().url(),
  width: z.number(),
});

export type ImageResponse = z.infer<typeof imageResponseSchema>;
