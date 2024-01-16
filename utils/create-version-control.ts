import os from "node:os";
import { execa, execaCommand } from "execa";
import fsExtra from "fs-extra/esm";
import fsP from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { select, spinner } from "@clack/prompts";
import { promptWrapper } from "@utils/prompt.ts";
import invariant from "tiny-invariant";
import { pipeline } from "node:stream/promises";
import {
  TimeCalculation,
  getFilterOutErrorsGenerator,
  getSourcePlaylistTracksGenerator,
  logPlaylistTracksStreamProgress,
} from "@utils/get-playlist-tracks.ts";
import { getPlaylistDetails } from "@utils/get-playlist-details.ts";
import { getTokenDataFromFile } from "@utils/get-token-data.ts";
import { setTimeout } from "node:timers/promises";

const gitRepoPath = path.join(os.homedir(), "spotify-playlists");

export async function createReadStreamFromPlaylistChoice(playlistId: string) {
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

export async function storePlaylist(
  playlistId: string,
  {
    token,
    logProgress,
    ...options
  }: {
    limit?: number;
    token: string;
    logProgress(input: {
      progress: number;
      offset: number;
      total: number;
      timeCalculation: string;
    }): void;
  },
) {
  const res = await getPlaylistDetails(playlistId, { token });
  if (res.type === "error") return res;

  const limit = options.limit ?? 50;
  const { total } = res.data.tracks;
  const { name: playlistName } = res.data;

  const timeCalculation: TimeCalculation = {
    startTime: Date.now(),
    averageSpeed: 0,
    iteration: 0,
    totalBytes: 0,
  };

  await fsExtra.ensureDir(gitRepoPath);

  await pipeline(
    getSourcePlaylistTracksGenerator({ total, limit, token, playlistId }),
    getFilterOutErrorsGenerator([]),
    async function* (stream) {
      for await (const chunk of stream) {
        logPlaylistTracksStreamProgress(
          { ...chunk, res: chunk.res.data },
          {
            total,
            logProgress,
            timeCalculation,
          },
        );
        yield chunk;
      }
    },
    async function* (stream) {
      for await (const chunk of stream) {
        const res = chunk.res.data.items
          .map((item) => item.track.id)
          .join("\n");
        yield chunk.offset > 0 ? "\n" + res : res;
      }
    },
    fs.createWriteStream(
      path.join(gitRepoPath, `${playlistId}_${playlistName}.txt`),
    ),
  );

  return res;
}

export async function createRepo() {
  await fsExtra.ensureDir(gitRepoPath);
  const isGitRepo = await checkIfRepoExists();
  if (!isGitRepo) {
    try {
      await execa("git", ["init"], {
        cwd: gitRepoPath,
        cleanup: true,
      });
    } catch (e) {
      console.error("EXECA ERRORED: ", e);
    }
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

  return fsExtra.ensureFile(playlistFilePath);
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

try {
  const playlistId = "2zffrd9L3584PhQT79EbXb";
  await createRepo();
  throw new Error("test");

  const s = spinner();
  s.start("Storing playlist...");
  const res = await storePlaylist(playlistId, {
    token: (await getTokenDataFromFile()).access_token,
    logProgress: (input) => {
      s.message(
        `${input.progress}% (${input.offset}/${input.total}) | ${input.timeCalculation}`,
      );
    },
  });
  s.stop();
  if (res.type === "error") {
    console.log(" ============== THERE WAS AN ERROR ===================");
    console.error(res.response);
    console.log(" ============== ****************** ===================");
    process.exit(1);
  }

  s.start("Committing changes...");
  await setTimeout(1000);
  await commitChanges({
    playlistId,
    snapshotId: res.data.snapshot_id,
  });
  s.stop();
} catch (e) {
  console.log(" ============== THERE WAS AN ERROR ===================");
  console.error(e);
  await fsExtra.emptyDir(gitRepoPath);
}
