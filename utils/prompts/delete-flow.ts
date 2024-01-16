import { tracksFilePath } from "~/init.ts";
import { config } from "@utils/env.ts";
import { log, spinner } from "@clack/prompts";
import { deleteAllAttackerItems } from "@utils/delete-items.ts";
import { getPlaylistTracksByUserId } from "@utils/get-playlist-tracks.ts";
import { getUsersDisplayNames } from "@utils/get-user-profile.ts";
import { askToStoreInVersionControl } from "@utils/prompts/ask-to-store-version.ts";
import { getAttackerUsernameChoices } from "@utils/prompts/attacker-choices.ts";
import { displayTable } from "@utils/prompts/display-table.ts";
import { getPlaylistIdPrompt } from "@utils/prompts/get-playlist-id.ts";
import { storePlaylist } from "@utils/version-control.ts";
import fsExtra from "fs-extra/esm";
import { entireTokenFlow } from "@utils/get-token-data.ts";

export async function deleteFlow({
  controller,
}: {
  controller: AbortController;
}) {
  try {
    const s = spinner();
    const tokenData = await entireTokenFlow(s);

    const playlistId = await getPlaylistIdPrompt({
      initialValue: config.spotify.testAttack.toPlaylistURL,
    });

    s.start("Fetching playlist tracks");
    const res = await getPlaylistTracksByUserId(playlistId, {
      controller,
      token: tokenData.access_token,
      limit: 50,
      logProgress: ({ progress, offset, total, timeCalculation }) => {
        s.message(
          `Fetching playlist tracks: ${progress}% (${offset}/${total}) | ${timeCalculation}`,
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

    const tracksToStoreForVersionControl = [...res.userTracksMap.entries()]
      .filter(([userId]) => !choices.includes(userId))
      .flatMap(([, tracks]) => tracks);

    s.start("Deleting tracks...");
    const deleteRes = await deleteAllAttackerItems(tracksToDelete, {
      controller,
      playlistId,
      token: tokenData.access_token,
      logProgress: ({ progress, timeCalculation }) => {
        s.message(`Deleting tracks: ${progress}% | ${timeCalculation}`);
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

    const result = await askToStoreInVersionControl();
    if (result.type === "store") {
      const repoPath = result.path;

      await storePlaylist({
        playlistId,
        trackIds: tracksToStoreForVersionControl,
        commitAction: "create",
        repoPath,
        token: tokenData.access_token,
      });

      log.success(`🎉 Playlist stored in ${repoPath}`);
    }
  } finally {
    await fsExtra.remove(tracksFilePath);
  }
}
