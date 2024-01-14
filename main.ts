import { tracksFilePath } from "./init.ts";
import "./utils/env.ts";
import {
  cancel,
  intro,
  text,
  isCancel,
  outro,
  log,
  spinner,
  multiselect,
} from "@clack/prompts";
import { getTokenFromFile } from "./utils/token-storage.ts";
import { getServer } from "./server.ts";
import { getPlaylistTracksByUserId } from "./utils/get-playlist-tracks.ts";
import { getPlaylistId } from "./utils/general.ts";
import { type TableUserConfig, table } from "table";
import { green, yellow } from "kolorist";
import fsExtra from "fs-extra/esm";
import { checkIfTokenExpired } from "./utils/check-expiration.ts";
import { refreshToken } from "./utils/refresh-token.ts";
import invariant from "tiny-invariant";
import { setInterval, setTimeout } from "timers/promises";
import { z } from "zod";
import { deleteAllAttackerItems } from "./utils/delete-items.ts";

let server: Awaited<ReturnType<typeof getServer>> | undefined;
try {
  intro(`🔥 Spotify Playlist Cleaner 🔥`);
  log.info(
    "This tool will help you to clean your Spotify playlists, from tracks added by a specific user (spammer? 🙄)",
  );

  const s = spinner();
  let tokenData = await getTokenFromFile();

  server = await getServer();
  if (!tokenData) {
    log.info("You need to authenticate first.");
    await fetch("http://localhost:3000");

    s.start("Waiting for token...");
    let timeoutDone = false;
    setTimeout(10_000).then(() => {
      timeoutDone = true;
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of setInterval(500)) {
      tokenData = await getTokenFromFile();
      if (tokenData) {
        break;
      }
      if (timeoutDone) {
        cancel("Operation cancelled.");
        process.exit(1);
      }
    }
    s.stop();

    invariant(tokenData, "Token data should be defined.");
  }

  if (await checkIfTokenExpired(tokenData.last_generated)) {
    tokenData = await refreshToken({
      refresh_token: tokenData.refresh_token,
    });
  }

  const playlistUrl = await text({
    message: "Enter the playlist URL",
    validate: (value) => {
      try {
        const url = new URL(value);
        if (!url.hostname.includes("spotify.com")) {
          return "Invalid URL";
        }
      } catch (e) {
        return "Invalid URL";
      }
    },
  });
  //
  if (isCancel(playlistUrl)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  const playlistId = getPlaylistId(playlistUrl);
  s.start("Fetching playlist data...");
  const res = await getPlaylistTracksByUserId(playlistId, {
    token: tokenData.access_token,
    limit: 50,
    logProgress: (progress) => {
      s.message(`Fetching playlist data... ${progress}%`);
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

  const final = [...res.userTracksMap.entries()]
    .map(([userId, tracks]) => [userId, tracks.length] as const)
    .toSorted((a, b) => b[1] - a[1])
    .map(([userId, tracks]) => [userId, tracks.toString()] as const);

  const config: TableUserConfig = {
    header: {
      content: green("RESULTS"),
      alignment: "center",
    },
  };

  const tracks = [
    ["User ID", "Tracks Added"].map((item) => yellow(item)),
    ...final,
  ];

  // WARN: silly fix for typescript
  console.log(table(tracks as string[][], config));

  const choices = await multiselect({
    message: "attacker?",
    options: final.map(([userId, tracks], index) => {
      const options: { label: string; value: string; hint?: string } = {
        label: `${userId} (${tracks})`,
        value: userId,
        hint: undefined,
      };

      if (index === 0) {
        options.hint = "probably the attacker";
      }

      return options;
    }),
  });

  if (isCancel(choices)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  const parsedChoices = z.string().array().parse(choices);

  const tracksToDelete = parsedChoices.flatMap(
    (userId) => res.userTracksMap.get(userId) ?? [],
  );

  s.start("Deleting tracks...");
  const deleteRes = await deleteAllAttackerItems(tracksToDelete, {
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
