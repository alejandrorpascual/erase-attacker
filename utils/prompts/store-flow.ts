import { log, spinner } from "@clack/prompts";
import { entireTokenFlow } from "@utils/get-token-data.ts";
import { askForPath } from "@utils/prompts/ask-to-store-version.ts";
import fs from "node:fs/promises";
import { getPlaylistIdPrompt } from "@utils/prompts/get-playlist-id.ts";
import {
  commitChanges,
  getCustomRepoPathFromUser,
  storePlaylistInChunks,
} from "@utils/version-control.ts";
import { getPlaylistDetails } from "@utils/get-playlist-details.ts";
import path from "node:path";
import { setTimeout } from "node:timers/promises";

export async function storeFlow({
  controller,
}: {
  controller: AbortController;
}) {
  const playlistId = await getPlaylistIdPrompt();

  const s = spinner();
  const tokenData = await entireTokenFlow(s);
  const detailsResponse = await getPlaylistDetails(playlistId, {
    token: tokenData.access_token,
  });
  if (detailsResponse.type === "error") {
    log.error(detailsResponse.message);
    process.exit(1);
  }

  const playlistName = detailsResponse.data.name;

  let repoPath = await getCustomRepoPathFromUser();
  if (!repoPath) {
    repoPath = await askForPath();
  }
  const repoDir = await fs.readdir(repoPath);
  const filePath = path.join(repoPath, `${playlistId}_${playlistName}.txt`);
  const fileExistsAlready = repoDir.find((file) => file === filePath);

  s.start("Storing playlist...");
  const res = await storePlaylistInChunks(playlistId, {
    token: tokenData.access_token,
    logProgress({ progress, total, offset, timeCalculation }) {
      s.message(
        `Storing playlist: ${progress}% (${offset}/${total}) | ${timeCalculation}`,
      );
    },
    signal: controller.signal,
  });
  if (res.type === "error") {
    log.error(res.message);
    process.exit(1);
  }
  s.stop();

  s.start("Committing changes...");
  await setTimeout(1500);
  await commitChanges({
    playlistId,
    snapshotId: res.data.snapshotId,
    repoPath,
    commitAction: fileExistsAlready ? "update" : "create",
  });
  s.stop();
}
