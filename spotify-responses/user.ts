import { z } from "zod";

export const userResponseSchema = z.object({
  external_urls: z.object({
    spotify: z.string().url(),
  }),
  href: z.string().url(),
  id: z.string(),
  type: z.literal("user"),
  uri: z.string().url(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
