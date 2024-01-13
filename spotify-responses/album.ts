import { z } from "zod";
import { artistResponseSchema } from "./artist.ts";
import { imageResponseSchema } from "./image.ts";

export const albumResponseSchema = z.object({
  album_type: z.string(),
  artists: z.array(artistResponseSchema),
  external_urls: z.object({
    spotify: z.string().url(),
  }),
  href: z.string().url(),
  id: z.string(),
  images: z.array(imageResponseSchema),
  name: z.string(),
  release_date: z.string(),
  release_date_precision: z.string(),
  total_tracks: z.number(),
  type: z.literal("album"),
  uri: z.string().url(),
});

export type AlbumResponse = z.infer<typeof albumResponseSchema>;
