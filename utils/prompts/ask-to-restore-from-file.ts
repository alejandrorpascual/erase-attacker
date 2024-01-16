import { select } from "@clack/prompts";
import { config } from "@utils/env.ts";
import { promptWrapper } from "@utils/prompt.ts";
import { getExistingPlaylistFiles } from "@utils/version-control.ts";
import path from "node:path";
import invariant from "tiny-invariant";

const gitRepoPath = config.spotify.gitRepoPath;
export async function askToRestoreFromFile(playlistId: string) {
  const files = await getExistingPlaylistFiles({ playlistId });
  let choice: string | null = null;

  if (files.length === 0) return;

  if (files.length === 1) {
    const [file] = files;
    invariant(file, "File should exist");
    choice = file;
  }

  if (files.length > 1) {
    choice = await promptWrapper(() =>
      select({
        message: "Select a playlist to restore",
        initialValue: files.at(0),
        options: files.map((file, idx) => {
          const option: {
            label: string;
            value: string;
            hint?: string;
          } = {
            label: file,
            value: file,
          };

          if (idx === 0) {
            option.hint = "this is the most recent playlist";
          }

          return option;
        }),
      }),
    );
  }
  if (!choice) return;
  return path.join(gitRepoPath, choice);
}
