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
    logProgress: (input: { progress: number; timeCalculation: string }) => void;
    controller: AbortController;
  },
) {
  const timeCalculation = {
    totalBytes: 0,
    iteration: 0,
    startTime: Date.now(),
    averageSpeed: 0,
    remainingBytes: 0,
  };

  async function* sourceStream() {
    const rest = trackIds.length % limit;

    for (let i = 0; i < trackIds.length; i += limit) {
      yield { slice: trackIds.slice(i, i + limit), offset: i };
    }

    if (rest > 0 && rest < limit) {
      yield { slice: trackIds.slice(-rest), offset: trackIds.length - rest };
    }
  }

  const snapshotIdWrapper = { snapshotId: "" };

  try {
    await pipeline(
      sourceStream,
      getDeleteGenerator({ token, playlistId }),
      getStoreSnapshotIdStream(snapshotIdWrapper),
      getLoggerStream({ trackIds, logProgress, timeCalculation }),
      { signal: controller.signal },
    );

    return {
      type: "success",
      data: { snapshot_id: snapshotIdWrapper.snapshotId },
    } as const;
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

function getStoreSnapshotIdStream(snapshotIdWrapper: { snapshotId: string }) {
  return async function* storeSnapshotIdStream(
    stream: AsyncIterable<{
      snapshot_id: string;
      offset: number;
    }>,
  ) {
    for await (const { snapshot_id, offset } of stream) {
      snapshotIdWrapper.snapshotId = snapshot_id;
      yield { offset };
    }
  };
}

function getLoggerStream({
  trackIds,
  logProgress,
  timeCalculation: tc,
}: {
  trackIds: string[];
  logProgress: (input: { progress: number; timeCalculation: string }) => void;
  timeCalculation: {
    totalBytes: number;
    iteration: number;
    startTime: number;
    averageSpeed: number;
  };
}) {
  return new Writable({
    objectMode: true,
    write(chunk, _encoding, callback) {
      // console.log("\n==========================");
      // console.log({ chunk });
      // console.log("============================\n");
      const { offset } = z.object({ offset: z.number() }).parse(chunk);
      const total = trackIds.length;
      const progress = Math.round((offset / total) * 100);

      tc.totalBytes = offset;
      tc.iteration++;

      let timeCalculation: string | null = null;
      if (tc.iteration <= 10) {
        timeCalculation = "🧮 Calculating ETA";
      } else {
        const elapsedSeconds = (Date.now() - tc.startTime) / 1000;
        tc.averageSpeed = tc.totalBytes / elapsedSeconds;
        const remainingBytes = total - tc.totalBytes;
        const eta = (remainingBytes > 0 ? remainingBytes : 0) / tc.averageSpeed;
        const etaDate = new Date(eta * 1000);
        const seconds = etaDate.getSeconds();
        const minutes = etaDate.getMinutes();

        if (minutes > 0) {
          timeCalculation = `⏳ ETA: ${minutes} min ${seconds} sec`;
        } else {
          timeCalculation = `⏳ ETA: ${seconds.toFixed(0)} seconds`;
        }
      }
      // console.log("\n==========================");
      // console.dir({ ...tc, total });
      // console.log("============================\n");

      logProgress({ progress, timeCalculation });

      callback();
    },
  });
}
