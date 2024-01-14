import { paginationResponseSchema } from "../spotify-responses/pagination.ts";
import { trackResponseSchema } from "../spotify-responses/track.ts";
import { userResponseSchema } from "../spotify-responses/user.ts";
import { z } from "zod";
import { pipeline } from "node:stream/promises";
import { fetcher } from "./fetcher.ts";
import fsExtra from "fs-extra";
import { tracksFilePath } from "../init.ts";

const playlistTracksResponseSchema = z
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
type PlaylistTracksResponse = z.infer<typeof playlistTracksResponseSchema>;

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
    data: playlistTracksResponseSchema.parse(await response.json()),
  } as const;
}

export async function getPlaylistTracksByUserId(
  playlistId: string,
  {
    token,
    logProgress, // can be use to log progress
    storeTracks = true, // can be use to store tracks in a file
    ...options
  }: PlaylistTracksOptions & {
    logProgress?: (progress: number) => void;
    storeTracks?: boolean;
  },
) {
  const res = await getPlaylistTracks(playlistId, { token, limit: 1 });
  if (res.type === "error") return res;

  const limit = options.limit ?? 50;
  const { total } = res.data;

  const errors: number[] = [];

  type UserId = string;
  type TrackId = string;
  const userTracksMap = new Map<UserId, TrackId[]>();

  await pipeline(
    getSourceGenerator({ total, playlistId, token, limit }),
    getStoreInMapGenerator({ errors, userTracksMap }),
    getStoreTracksGenerator({ storeTracks, userTracksMap }),
    logProgress
      ? getLogProgressGenerator({ total, logProcess: logProgress })
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

  const jsonResponse = await response.json();
  const data = z
    .object({ collaborative: z.boolean() })
    .parse(await jsonResponse);

  return {
    type: "success",
    data: data.collaborative,
  } as const;
}

type InitialStream = AsyncIterable<{
  offset: number;
  res:
    | {
        type: "success";
        data: PlaylistTracksResponse;
      }
    | {
        type: "error";
        message: string;
      };
}>;
type SuccessStream = AsyncIterable<{
  offset: number;
  res: {
    type: "success";
    data: PlaylistTracksResponse;
  };
}>;

type Params = {
  total: number;
  playlistId: string;
  token: string;
  limit: number;
};

function getSourceGenerator({ total, playlistId, token, limit }: Params) {
  return async function* () {
    for (let offset = 0; offset < total; offset += limit) {
      const res = await getPlaylistTracks(playlistId, {
        token,
        offset,
        limit,
      });
      yield { res, offset };
    }
  };
}

function getStoreInMapGenerator({
  errors,
  userTracksMap,
}: {
  errors: number[];
  userTracksMap: Map<string, string[]>;
}) {
  return async function* (stream: InitialStream) {
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
  };
}

function getLogProgressGenerator({
  total,
  logProcess,
}: {
  total: number;
  logProcess: (progress: number) => void;
}) {
  return async function* (stream: SuccessStream) {
    for await (const { offset, res } of stream) {
      const progress = Math.round((offset / total) * 100);
      logProcess(progress);
      yield { offset, res };
    }
  };
}

function getStoreTracksGenerator({
  storeTracks,
  userTracksMap,
}: {
  storeTracks: boolean;
  userTracksMap: Map<string, string[]>;
}) {
  return async function* (stream: SuccessStream) {
    for await (const { offset, res } of stream) {
      if (storeTracks) {
        await storeMapInFilesystem(tracksFilePath, userTracksMap);
      }

      yield { offset, res };
    }
  };
}

function storeMapInFilesystem(filepath: string, data: Map<string, string[]>) {
  return fsExtra.writeJSON(filepath, Object.fromEntries(data.entries()));
}

/**
 * Gets a Map<UserId, TrackId[]> from a file in the file system.
 *
 * @param {string} filepath - The path to the file to load.
 * @returns {Promise<Map<string, string[]> | null>}
 *   A Promise resolving to the Map loaded from the file,
 *   or null if the file does not exist.
 */
export async function getMapFromFileSystem(filepath: string) {
  const exists = await fsExtra.pathExists(filepath);
  if (!exists) return null;

  const obj = z.record(z.string().array());
  return new Map(Object.entries(obj));
}
