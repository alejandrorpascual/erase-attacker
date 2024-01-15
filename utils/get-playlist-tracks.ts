import { paginationResponseSchema } from "~/spotify-responses/pagination.ts";
import { trackResponseSchema } from "~/spotify-responses/track.ts";
import { userResponseSchema } from "~/spotify-responses/user.ts";
import { z } from "zod";
import { pipeline } from "node:stream/promises";
import { fetcher } from "@utils/fetcher.ts";
import fsExtra from "fs-extra";
import { tracksFilePath } from "~/init.ts";
import { Writable } from "node:stream";
import { getTime, getTimeCalculation } from "@utils/get-time.ts";

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
    return {
      type: "error",
      message: response.statusText,
      response: await response.json(),
    } as const;
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
    controller,
    ...options
  }: PlaylistTracksOptions & {
    logProgress(input: {
      progress: number;
      offset: number;
      total: number;
      timeCalculation: string;
    }): void;
    storeTracks?: boolean;
    controller: AbortController;
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

  const timeCalculation = {
    startTime: Date.now(),
    totalBytes: 0,
    iteration: 0,
    averageSpeed: 0,
  };

  await pipeline(
    getSourcePlaylistTracksGenerator({ total, playlistId, token, limit }),
    getFilterOutErrorsGenerator(errors),
    getStoreInMapGenerator({ userTracksMap }),
    getStoreTracksGenerator({ storeTracks, userTracksMap }),
    getLogProgressFromPlaylistTracksStream({
      total,
      logProgress,
      timeCalculation,
    }),
    { signal: controller.signal },
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

export type InitialPlaylistTracksStream = AsyncIterable<{
  offset: number;
  res:
    | {
        type: "success";
        data: PlaylistTracksResponse;
      }
    | {
        type: "error";
        message: string;
        response: Response;
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

export function getSourcePlaylistTracksGenerator({
  total,
  playlistId,
  token,
  limit,
}: Params) {
  return async function* () {
    const rest = total % limit;

    for (let offset = 0; offset < total; offset += limit) {
      const res = await getPlaylistTracks(playlistId, {
        token,
        offset,
        limit,
      });
      yield { res, offset };
    }

    if (rest > 0 && rest < limit) {
      const offset = total - rest;
      const res = await getPlaylistTracks(playlistId, {
        token,
        offset,
        limit: rest,
      });
      yield { res, offset };
    }
  };
}

export function getConcurrentSourcePlaylistTracksGenerator({
  total,
  playlistId,
  token,
  limit,
  concurrency,
}: Params & { concurrency: number }) {
  return async function* () {
    const rest = total % limit;

    for (let offset = 0; offset < total; offset += limit * concurrency) {
      const responses = await Promise.all(
        Array.from({ length: concurrency }).map((_, i) => {
          return getPlaylistTracks(playlistId, {
            token,
            offset: offset + i * limit,
            limit,
          });
        }),
      );

      let res: (typeof responses)[number] | null = null;

      const itemsToFlat: Pick<PlaylistTracksResponse, "items">["items"][] = [];

      for (const concurrentRes of responses) {
        if (concurrentRes.type === "error") {
          res = concurrentRes;
          break;
        }

        itemsToFlat.push(concurrentRes.data.items);

        res = {
          ...concurrentRes,
          data: {
            ...concurrentRes.data,
            items: itemsToFlat.flat(),
          },
        };
      }

      yield { res, offset };
    }

    if (rest > 0 && rest < limit * concurrency) {
      const offset = total - rest * concurrency;
      const responses = await Promise.all(
        Array.from({ length: concurrency }).map((_, i) => {
          return getPlaylistTracks(playlistId, {
            token,
            offset: offset + i * limit,
            limit,
          });
        }),
      );

      let res: (typeof responses)[number] | null = null;

      const itemsToFlat: Pick<PlaylistTracksResponse, "items">["items"][] = [];

      for (const concurrentRes of responses) {
        if (concurrentRes.type === "error") {
          res = concurrentRes;
          break;
        }

        itemsToFlat.push(concurrentRes.data.items);

        res = {
          ...concurrentRes,
          data: {
            ...concurrentRes.data,
            items: itemsToFlat.flat(),
          },
        };
      }

      yield { res, offset };
    }
  };
}

export function getFilterOutErrorsGenerator(errors: number[]) {
  return async function* filterOutErrors(stream: InitialPlaylistTracksStream) {
    for await (const { res, offset } of stream) {
      if (res.type === "error") {
        errors.push(offset);
        continue;
      }

      yield { res, offset };
    }
  };
}

function getStoreInMapGenerator({
  userTracksMap,
}: {
  userTracksMap: Map<string, string[]>;
}) {
  return async function* (stream: SuccessStream) {
    for await (const { res, offset } of stream) {
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

export type TimeCalculation = {
  startTime: number;
  totalBytes: number;
  iteration: number;
  averageSpeed: number;
};

export function getLogProgressFromPlaylistTracksStream({
  total,
  logProgress,
  timeCalculation: tc,
}: {
  total: number;
  timeCalculation: TimeCalculation;
  logProgress({
    progress,
    offset,
    total,
    timeCalculation,
  }: {
    progress: number;
    offset: number;
    total: number;
    timeCalculation: string;
  }): void;
}) {
  return new Writable({
    objectMode: true,
    write(chunk, _encoding, callback) {
      logPlaylistTracksStreamProgress(chunk, {
        total,
        logProgress,
        timeCalculation: tc,
      });

      callback();
    },
  });
}
export async function logPlaylistTracksStreamProgress(
  chunk: unknown,
  {
    total,
    logProgress,
    timeCalculation: tc,
  }: {
    total: number;
    logProgress: ({
      progress,
      offset,
      total,
      timeCalculation,
    }: {
      progress: number;
      offset: number;
      total: number;
      timeCalculation: string;
    }) => void;
    timeCalculation: TimeCalculation;
  },
) {
  const { offset, res } = z
    .object({ offset: z.number(), res: playlistTracksResponseSchema })
    .parse(chunk);
  const progress = Math.round((offset / total) * 100);

  tc.totalBytes += res.items.length;
  tc.iteration++;

  let timeCalculation: string | null = null;
  if (tc.iteration <= 10) {
    timeCalculation = "🧮 Calculating ETA";
  } else {
    const elapsedSeconds = (Date.now() - tc.startTime) / 1000;
    tc.averageSpeed = tc.totalBytes / elapsedSeconds;
    const remainingBytes = total - tc.totalBytes;
    const eta = (remainingBytes > 0 ? remainingBytes : 0) / tc.averageSpeed;

    timeCalculation = getTimeCalculation(getTime(eta * 1000));
  }

  logProgress({ progress, offset, total, timeCalculation });
}

function getStoreTracksGenerator({
  storeTracks,
  userTracksMap,
}: {
  storeTracks: boolean;
  userTracksMap: Map<string, string[]>;
}) {
  return async function* (stream: SuccessStream) {
    for await (const { res, offset } of stream) {
      if (storeTracks) {
        await storeMapInFilesystem(tracksFilePath, userTracksMap);
      }

      yield { offset, res: res.data };
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
