import { z } from "zod";
import { fetcher } from "./fetcher.ts";
import { pipeline } from "stream/promises";
import { Writable } from "node:stream";

type Options = { token: string; playlistId: string };
export async function deletePlaylistItems(
  trackIds: string[],
  { token, playlistId }: Options,
) {
  const pathname = `/v1/playlists/${playlistId}/tracks`;

  const response = await fetcher(pathname, {
    token,
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      tracks: trackIds.map((id) => ({ uri: `spotify:track:${id}` })),
    }),
  });

  if (response.status !== 200) {
    const errorResponse = await response.json();
    return {
      type: "error",
      message: response.statusText,
      response: errorResponse,
    } as const;
  }

  const data = await response.json();

  return {
    type: "success",
    data: z.object({ snapshot_id: z.string() }).parse(data),
  } as const;
}

export async function deleteAllAttackerItems(
  trackIds: string[],
  {
    token,
    playlistId,
    logProgress,
    limit = 100,
    controller,
  }: Options & {
    limit?: number;
    logProgress: (progress: number) => void;
    controller: AbortController;
  },
) {
  async function* sourceStream() {
    const rest = trackIds.length % limit;

    for (let i = 0; i < trackIds.length; i += limit) {
      yield { slice: trackIds.slice(i, i + limit), offset: i };
    }

    if (rest > 0 && rest < limit) {
      yield { slice: trackIds.slice(-rest), offset: trackIds.length - rest };
    }
  }

  let snapshotId: string | undefined;

  try {
    await pipeline(
      sourceStream,
      getDeleteGenerator({ token, playlistId }),
      async function* (stream) {
        for await (const { snapshot_id, offset } of stream) {
          snapshotId = snapshot_id;
          yield { offset };
        }
      },
      getLoggerStream({ trackIds, logProgress }),
      { signal: controller.signal },
    );

    return { type: "success", data: { snapshot_id: snapshotId } } as const;
  } catch (e) {
    if (e instanceof Error) {
      return { type: "error", message: e.message } as const;
    }

    return { type: "error", message: "Unknown error" } as const;
  }
}

function getDeleteGenerator({ token, playlistId }: Options) {
  return async function* (
    stream: AsyncIterable<{ slice: string[]; offset: number }>,
  ) {
    for await (const { slice, offset } of stream) {
      const res = await deletePlaylistItems(slice, { token, playlistId });
      if (res.type === "error") {
        continue;
      }

      yield { snapshot_id: res.data.snapshot_id, offset };
    }
  };
}

function getLoggerStream({
  trackIds,
  logProgress,
}: {
  trackIds: string[];
  logProgress: (progress: number) => void;
}) {
  return new Writable({
    objectMode: true,
    write(chunk, _encoding, callback) {
      const { offset } = z.object({ offset: z.number() }).parse(chunk);
      const progress = Math.round((offset / trackIds.length) * 100);
      logProgress(progress);
      callback();
    },
  });
}
