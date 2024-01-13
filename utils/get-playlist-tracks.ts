import { paginationResponseSchema } from "../spotify-responses/pagination.ts";
import { trackResponseSchema } from "../spotify-responses/track.ts";
import { userResponseSchema } from "../spotify-responses/user.ts";
import { z } from "zod";
import { pipeline } from "node:stream/promises";
import { fetcher } from "./fetcher.ts";

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
  options: PlaylistTracksOptions,
) {
  const pathname = `v1/playlists/${playlistId}/tracks`;
  const response = await fetcher(pathname, options);

  if (!response.ok) {
    return { type: "error", message: response.statusText } as const;
  }

  return {
    type: "success",
    data: playlistTracksSchema.parse(await response.json()),
  } as const;
}

export async function getPlaylistTracksByUserId(
  playlistId: string,
  {
    token,
    logProcess, // can be use to log progress
    ...options
  }: PlaylistTracksOptions & { logProcess?: (progress: number) => void },
) {
  const res = await getPlaylistTracks(playlistId, { token, limit: 1 });
  if (res.type === "error") return res;

  const limit = options.limit ?? 50;
  const { total } = res.data;
  const offsets = Array.from({ length: Math.ceil(total / limit) }).map(
    (_, i) => i * limit,
  );

  const errors: number[] = [];

  type UserId = string;
  type TrackId = string;
  const userTracksMap = new Map<UserId, TrackId[]>();

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
          continue;
        }

        for (const item of res.data.items) {
          const userId = item.added_by?.id;
          if (!userId) continue;

          const trackId = item.track.id;
          const tracks = userTracksMap.get(userId) ?? [];
          userTracksMap.set(userId, [...tracks, trackId]);
        }

        yield { offset, res };
      }
    },
    async function* (stream) {
      for await (const res of stream) {
        yield res;
      }
    },
    logProcess
      ? async function* (stream) {
          let i = 0;
          for await (const { offset, res } of stream) {
            i++;
            const progress = Math.round((i / offsets.length) * 100);
            logProcess(progress);
            yield { offset, res };
          }
        }
      : process.stderr,
  );

  if (userTracksMap?.size === 0) {
    return {
      type: "error",
      message: "No users found",
      errors,
    } as const;
  }

  if (errors.length > 0) {
    return {
      type: "partial",
      userTracksMap,
      errors,
    } as const;
  }

  return {
    type: "success",
    userTracksMap,
  } as const;
}

export async function isPlaylistCollaborative(
  playlistId: string,
  { token }: { token: string },
) {
  const pathname = `v1/playlists/${playlistId}`;
  const response = await fetcher(pathname, { token, limit: 1 });

  if (!response.ok) {
    return { type: "error", message: response.statusText } as const;
  }

  const data = z
    .object({ collaborative: z.boolean() })
    .parse(await response.json());

  return {
    type: "success",
    data: data.collaborative,
  } as const;
}
