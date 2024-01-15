import "./init.ts";
import { config } from "./utils/env.ts";
import { intro, log, outro, spinner } from "@clack/prompts";
import { simulateAttack } from "./utils/add-songs.ts";
import { getPlaylistIdPrompt } from "./utils/prompts/get-playlist-id.ts";
import { getTokenFromFile } from "./utils/token-storage.ts";
import { getServer } from "./server.ts";
import { authenticate } from "./utils/auth.ts";
import { checkIfTokenExpired } from "./utils/check-expiration.ts";
import { refreshToken } from "./utils/refresh-token.ts";
import { bold } from "kolorist";
import { getPlaylistTracks } from "./utils/get-playlist-tracks.ts";

const s = spinner();
let server: Awaited<ReturnType<typeof getServer>> | undefined;
const controller = new AbortController();

process.on("SIGINT", () => {
  controller.abort();
});

let tokenData = await getTokenFromFile();

try {
  intro(`😅 Welcome to the ${bold("Spotify Attack")}! 😅`);
  if (!tokenData) {
    server = getServer();
    log.info("You need to authenticate first.");
    s.start("Waiting for token...");
    tokenData = await authenticate();
    s.stop();
  }

  if (await checkIfTokenExpired(tokenData.last_generated)) {
    tokenData = await refreshToken({
      refresh_token: tokenData.refresh_token,
    });
  }
  const initialValueFrom =
    config.env === "development"
      ? config.spotify.testAttack.fromPlaylistURL
      : undefined;
  const initialValueTo =
    config.env === "development"
      ? config.spotify.testAttack.toPlaylistURL
      : undefined;

  const playlistFromId = await getPlaylistIdPrompt({
    message: "Enter the playlist URL *from* which you want to copy songs",
    initialValue: initialValueFrom,
  });

  const playlistToId = await getPlaylistIdPrompt({
    message: "Enter the playlist URL *to* which you want to copy songs",
    initialValue: initialValueTo,
  });

  const res = await getPlaylistTracks(playlistFromId, {
    token: tokenData.access_token,
    limit: 1,
  });

  if (res.type === "error") {
    log.error(res.message);
    process.exit(1);
  }

  const limit = 50;
  const { total } = res.data;

  s.start("Starting attack...");
  await simulateAttack({
    fromPlaylistId: playlistFromId,
    toPlaylistId: playlistToId,
    token: tokenData.access_token,
    limit,
    total,
    controller,
    logProgress: ({ progress, total, offset, timeCalculation }) =>
      s.message(
        `Progress: ${progress.toFixed(
          2,
        )}% (${offset} / ${total}) | ${timeCalculation}`,
      ),
  });
  s.stop();
  outro("Attack finished!");
} finally {
  server?.close();
}
