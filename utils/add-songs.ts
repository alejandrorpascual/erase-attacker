import { z } from "zod";
import { fetcher } from "@utils/fetcher.ts";
import { pipeline } from "stream/promises";
import {
  getConcurrentSourcePlaylistTracksGenerator,
  getLogProgressFromPlaylistTracksStream,
} from "@utils/get-playlist-tracks.ts";

export async function addSongsToPlaylist(
  trackIds: string[],
  { token, playlistId }: { token: string; playlistId: string },
) {
  const pathname = `v1/playlists/${playlistId}/tracks`;
  const response = await fetcher(pathname, {
    method: "POST",
    token,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      uris: trackIds.map((id) => `spotify:track:${id}`),
    }),
  });

  if (response.status !== 201) {
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

export async function simulateAttack({
  fromPlaylistId,
  toPlaylistId,
  token,
  limit = 50,
  total,
  logProgress,
  controller,
}: {
  fromPlaylistId: string;
  toPlaylistId: string;
  token: string;
  limit?: number;
  total: number;
  controller: AbortController;
  logProgress(input: {
    progress: number;
    total: number;
    offset: number;
    timeCalculation: string;
  }): void;
}) {
  const timeCalculation = {
    startTime: Date.now(),
    totalBytes: 0,
    iteration: 0,
    averageSpeed: 0,
  };

  await pipeline(
    getConcurrentSourcePlaylistTracksGenerator({
      token,
      playlistId: fromPlaylistId,
      limit,
      total,
      concurrency: 2,
    }),

    async function* (stream) {
      for await (const { res, offset } of stream) {
        if (res?.type === "error") {
          continue;
        }

        const trackIds = res?.data.items.map((item) => item.track.id) ?? [];

        const addRes = await addSongsToPlaylist(trackIds, {
          token,
          playlistId: toPlaylistId,
        });

        yield { addRes, res: res?.data, offset };
      }
    },
    getLogProgressFromPlaylistTracksStream({
      total,
      logProgress,
      timeCalculation,
    }),
    { signal: controller.signal },
  );
}
