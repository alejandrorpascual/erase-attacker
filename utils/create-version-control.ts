import os from "node:os";
import { execaCommand } from "execa";
import fsExtra from "fs-extra/esm";
import fsP from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { select } from "@clack/prompts";
import { promptWrapper } from "@utils/prompt.ts";
import invariant from "tiny-invariant";

const gitRepoPath = path.join(os.homedir(), "spotify-playlists");

export async function createReadStreamFromPlaylistChoice(playlistId: string) {
  // get existing playlist files
  const files = await getExistingPlaylistFiles({ playlistId });
  // prompt the user to select
  if (files.length === 0) return;

  let choice: string | null = null;
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
  return fs.createReadStream(path.join(gitRepoPath, choice));
}

export async function createRepo() {
  await fsExtra.ensureDir(gitRepoPath);
  const isGitRepo = await checkIfRepoExists();
  if (!isGitRepo) {
    await execaCommand("git init", {
      cwd: gitRepoPath,
    });
  }
}

export async function checkIfRepoExists() {
  const isGitRepo = await fsExtra.pathExists(path.join(gitRepoPath, ".git"));
  return isGitRepo;
}

export async function checkIfRepoDirIsEmpty() {
  const files = await fsP.readdir(gitRepoPath);
  return files.length === 0;
}

export async function commitChanges({
  playlistId,
  snapshotId,
}: {
  playlistId: string;
  snapshotId: string;
}) {
  await execaCommand("git add .", {
    cwd: gitRepoPath,
  });
  await execaCommand(
    `git commit -m "chore: update tracks [ID: ${playlistId}, SNAPSHOT: ${snapshotId}]"`,
    {
      cwd: gitRepoPath,
    },
  );
}

export async function createPlaylistFile({
  playlistId,
  playlistName,
}: {
  playlistId: string;
  playlistName: string;
}) {
  // change spaces to snake case, get rid of special characters
  playlistName = playlistName
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");

  const playlistFilePath = path.join(
    gitRepoPath,
    `${playlistId}_${playlistName}.txt`,
  );

  await fsExtra.ensureFile(playlistFilePath);
}

export async function getExistingPlaylistFiles({
  playlistId,
}: {
  playlistId: string;
}) {
  const files = await fsP.readdir(gitRepoPath);
  const playlistFiles = files.filter((file) => file.startsWith(playlistId));
  const stats = await Promise.all(
    playlistFiles.map(async (file) => {
      return {
        file,
        mtime: (await fsP.stat(path.join(gitRepoPath, file))).mtimeMs,
      };
    }),
  );
  return stats.toSorted((a, b) => b.mtime - a.mtime).map((stat) => stat.file);
}
