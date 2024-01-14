import { z } from "zod";
import { fetcher } from "./fetcher.ts";
import { pipeline } from "stream/promises";

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
  }: Options & { logProgress?: (progress: number) => void },
) {
  async function* sourceStream() {
    for (let i = 0; i < trackIds.length; i += 100) {
      yield { slice: trackIds.slice(i, i + 100), offset: i };
    }
  }

  let snapshotId: string | undefined;

  try {
    await pipeline(
      sourceStream,
      async function* (stream) {
        for await (const { slice, offset } of stream) {
          const res = await deletePlaylistItems(slice, { token, playlistId });
          if (res.type === "error") {
            continue;
          }

          yield { snapshot_id: res.data.snapshot_id, offset };
        }
      },
      logProgress
        ? async function* (stream) {
            for await (const { snapshot_id, offset } of stream) {
              const progress = Math.round((offset / trackIds.length) * 100);
              logProgress(progress);
              snapshotId = yield snapshot_id;
            }
          }
        : process.stderr,
    );

    return { type: "success", data: { snapshot_id: snapshotId } } as const;
  } catch (e) {
    if (e instanceof Error) {
      return { type: "error", message: e.message } as const;
    }

    return { type: "error", message: "Unknown error" } as const;
  }
}
