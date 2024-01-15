import { tracksFilePath } from "./init.ts";
import { config } from "./utils/env.ts";
import { intro, outro, log, spinner } from "@clack/prompts";
import { getTokenFromFile } from "./utils/token-storage.ts";
import { getServer } from "./server.ts";
import { getPlaylistTracksByUserId } from "./utils/get-playlist-tracks.ts";
import fsExtra from "fs-extra/esm";
import { checkIfTokenExpired } from "./utils/check-expiration.ts";
import { refreshToken } from "./utils/refresh-token.ts";
import { deleteAllAttackerItems } from "./utils/delete-items.ts";
import { authenticate } from "./utils/auth.ts";
import { getUsersDisplayNames } from "./utils/get-user-profile.ts";
import { getPlaylistIdPrompt } from "./utils/prompts/get-playlist-id.ts";
import { displayTable } from "./utils/prompts/display-table.ts";
import { getAttackerUsernameChoices } from "./utils/prompts/attacker-choices.ts";

let server: Awaited<ReturnType<typeof getServer>> | undefined;

const controller = new AbortController();
process.on("SIGINT", () => {
  controller.abort();
});

try {
  intro(`🔥 Spotify Playlist Cleaner 🔥`);
  log.info(
    "This tool will help you to clean your Spotify playlists, from tracks added by a specific user (spammer? 🙄)",
  );

  const s = spinner();

  let tokenData = await getTokenFromFile();

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

  const playlistId = await getPlaylistIdPrompt({
    initialValue: config.spotify.testAttack.toPlaylistURL,
  });

  s.start("Fetching playlist data...");
  const res = await getPlaylistTracksByUserId(playlistId, {
    controller,
    token: tokenData.access_token,
    limit: 50,
    logProgress: ({ progress, offset, total, timeCalculation }) => {
      s.message(
        `Fetching playlist data... ${progress}% (${offset}/${total}) | ${timeCalculation}`,
      );
    },
  });
  s.stop();

  if (res.type === "error") {
    log.error(res.message);
    process.exit(1);
  }

  if (res.type === "partial") {
    log.warn("Some tracks could not be fetched.");
  }

  const userIds = [...res.userTracksMap.keys()];

  s.start("Fetching usernames...");
  const userProfileMap = await getUsersDisplayNames(userIds, {
    token: tokenData.access_token,
  });
  s.stop();

  const final = displayTable({
    userTracksMap: res.userTracksMap,
    userProfileMap,
  });

  const choices = await getAttackerUsernameChoices(final);

  const tracksToDelete = choices.flatMap(
    (userId) => res.userTracksMap.get(userId) ?? [],
  );

  s.start("Deleting tracks...");
  const deleteRes = await deleteAllAttackerItems(tracksToDelete, {
    controller,
    playlistId,
    token: tokenData.access_token,
    logProgress: (progress) => {
      s.message(`Deleting tracks... ${progress}%`);
    },
  });
  s.stop();

  if (deleteRes.type === "error") {
    log.error(deleteRes.message);
    process.exit(1);
  }

  log.success(
    `${tracksToDelete.length} Tracks deleted! Snapshot ID: ${deleteRes.data.snapshot_id}`,
  );

  outro(`✅ Done!`);
} finally {
  await fsExtra.remove(tracksFilePath);
  server?.close();
}
