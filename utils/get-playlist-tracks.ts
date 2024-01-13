import { paginationResponseSchema } from "../spotify-responses/pagination.ts";
import { trackResponseSchema } from "../spotify-responses/track.ts";
import { userResponseSchema } from "../spotify-responses/user.ts";
import { config } from "./env.ts";
import { z } from "zod";
import { pipeline } from "node:stream/promises";

const playlistTracksSchema = z
  .object({
    href: z.string(),
    items: z.array(
      z.object({
        added_at: z.string().datetime(),
        added_by: userResponseSchema.optional(),
        is_local: z.boolean(),
        track: trackResponseSchema,
        video_thumbnail: z.object({
          url: z.nullable(z.string().url()),
        }),
      }),
    ),
  })
  .merge(paginationResponseSchema);

type PlaylistTracksOptions = { token: string; offset?: number; limit?: number };

export async function getPlaylistTracks(
  playlistId: string,
  { token, ...options }: PlaylistTracksOptions,
) {
  const pathname = `v1/playlists/${playlistId}/tracks`;
  const url = new URL(pathname, config.spotify.baseApiUrl);
  if (options.offset) {
    url.searchParams.set("offset", String(options.offset));
  }
  if (options.limit) {
    url.searchParams.set("limit", String(options.limit));
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return { type: "error", message: response.statusText } as const;
  }

  return {
    type: "success",
    data: playlistTracksSchema.parse(await response.json()),
  } as const;
}

export async function getAllPlaylistTracks(
  playlistId: string,
  { token, ...options }: PlaylistTracksOptions,
) {
  const res = await getPlaylistTracks(playlistId, { token, limit: 1 });
  if (res.type === "error") return res;

  const limit = options.limit ?? 50;
  const { total } = res.data;
  const offsets = Array.from({ length: Math.ceil(total / limit) }).map(
    (_, i) => i * limit,
  );

  const errors: number[] = [];

  await pipeline(
    async function* () {
      for (const offset of offsets) {
        const res = await getPlaylistTracks(playlistId, {
          token,
          offset,
          limit,
        });
        yield { res, offset };
      }
    },
    async function* (stream) {
      for await (const { res, offset } of stream) {
        if (res.type === "error") {
          errors.push(offset);
        }


        yield res;
      }
    },
    process.stderr,
  );
}
