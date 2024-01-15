import { z } from "zod";

export const imageResponseSchema = z.object({
  height: z.number().nullable(),
  url: z.string().url(),
  width: z.number().nullable(),
});

export type ImageResponse = z.infer<typeof imageResponseSchema>;
