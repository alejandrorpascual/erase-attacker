import { z } from "zod";

export const artistResponseSchema = z.object({
  external_urls: z.object({
    spotify: z.string().url(),
  }),
  href: z.string().url(),
  id: z.string(),
  name: z.string(),
  type: z.literal("artist"),
  uri: z.string().url(),
});

export type ArtistResponse = z.infer<typeof artistResponseSchema>;
