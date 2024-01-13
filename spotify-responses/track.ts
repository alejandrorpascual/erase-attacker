import { z } from "zod";
import { albumResponseSchema } from "./album.ts";
import { artistResponseSchema } from "./artist.ts";

export const trackResponseSchema = z.object({
  album: albumResponseSchema,
  artists: z.array(artistResponseSchema),
  episode: z.boolean(),
  explicit: z.boolean(),
  external_ids: z.object({
    isrc: z.string(),
  }),
  external_urls: z.object({
    spotify: z.string().url(),
  }),
  href: z.string().url(),
  id: z.string(),
  is_local: z.boolean(),
  is_playable: z.boolean(),
  name: z.string(),
  popularity: z.number(),
  preview_url: z.nullable(z.string().url()),
  track: z.boolean(),
  track_number: z.number(),
  type: z.literal("track"),
  uri: z.string().url(),
});

export type TrackResponse = z.infer<typeof trackResponseSchema>;
