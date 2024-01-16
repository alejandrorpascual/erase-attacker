import { execa, execaCommand } from "execa";
import fsExtra from "fs-extra/esm";
import fsP from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pipeline } from "node:stream/promises";
import {
  TimeCalculation,
  getFilterOutErrorsGenerator,
  getSourcePlaylistTracksGenerator,
  logPlaylistTracksStreamProgress,
} from "@utils/get-playlist-tracks.ts";
import { getPlaylistDetails } from "@utils/get-playlist-details.ts";
import { config } from "@utils/env.ts";

type CommitAction = "update" | "create" | "delete";

const gitRepoPath = config.spotify.gitRepoPath;
type StorePlaylistInputBase = {
  trackIds: string[];
  playlistId: string;
  commitAction: CommitAction;
  repoPath?: string;
};
export async function storePlaylist({
  trackIds,
  playlistId,
  commitAction,
  playlistName,
  token,
  repoPath,
}: StorePlaylistInputBase &
  (
    | {
        playlistName?: undefined;
        token: string;
      }
    | {
        playlistName: string;
        token?: undefined;
      }
  )) {
  if (!playlistName && token) {
    const res = await getPlaylistDetails(playlistId, { token });
    if (res.type === "error") {
      playlistName = "unknown";
    } else {
      playlistName = res.data.name;
    }
  }

  if (!playlistName) {
    playlistName = "unknown";
  }

  const playlistFilePath = await createPlaylistFile({
    playlistId,
    playlistName,
    repoPath,
  });

  await fsP.writeFile(playlistFilePath, trackIds.join("\n"));
  await commitChanges({ playlistId, snapshotId: "initial", commitAction });
}

export async function storePlaylistInChunks(
  playlistId: string,
  {
    token,
    logProgress,
    repoPath = gitRepoPath,
    ...options
  }: {
    limit?: number;
    token: string;
    signal?: AbortSignal;
    repoPath?: string;
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

  await fsExtra.ensureDir(repoPath);
  const filePath = path.join(repoPath, `${playlistId}_${playlistName}.txt`);

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
    fs.createWriteStream(filePath),
    { signal: options.signal },
  );

  return {
    type: res.type,
    data: { snapshotId: res.data.snapshot_id, playlistName, filePath },
  };
}

export async function createRepo({
  repoPath = gitRepoPath,
  logger = console.log,
}: { repoPath?: string; logger?(msg: string): void } = {}) {
  const cwd = repoPath;
  await fsExtra.ensureDir(cwd);

  const isGitRepo = await checkIfRepoExists();
  if (!isGitRepo) {
    const { stdout } = await execaCommand("git init", {
      cwd,
      stdio: "inherit",
    });
    logger(stdout);
  }
}

export async function checkIfRepoExists(repoPath = gitRepoPath) {
  const isGitRepo = await fsExtra.pathExists(path.join(repoPath, ".git"));
  return isGitRepo;
}

const userConfigDirPath = path.join(os.homedir(), ".config", "spotify");
export async function storeCustomUserPathToRepo(repoPath: string) {
  await fsExtra.ensureDir(userConfigDirPath);
  const repoPathExists = await fsExtra.pathExists(repoPath);
  if (!repoPathExists) {
    return {
      type: "error",
      message: `Path ${repoPath} does not exist`,
    } as const;
  }

  try {
    await fsP.writeFile(
      path.join(userConfigDirPath, "git-repo-path.txt"),
      repoPath,
      "utf-8",
    );

    return { type: "success" } as const;
  } catch (e) {
    return {
      type: "error",
      message: `Something went wrong while writing to ${userConfigDirPath}`,
    } as const;
  }
}

export async function getCustomRepoPathFromUser() {
  const userConfigFile = path.join(userConfigDirPath, "git-repo-path.txt");
  const userConfigFileExists = await fsExtra.pathExists(userConfigFile);
  if (!userConfigFileExists) {
    return null;
  }

  try {
    const contents = await fsP.readFile(userConfigFile, "utf-8");
    return contents;
  } catch (e) {
    return null;
  }
}

export async function checkIfRepoDirIsEmpty(repoPath = gitRepoPath) {
  const files = await fsP.readdir(repoPath);
  return files.length === 0;
}

export async function commitChanges({
  playlistId,
  snapshotId,
  repoPath = gitRepoPath,
  commitAction,
}: {
  playlistId: string;
  snapshotId: string;
  repoPath?: string;
  commitAction: CommitAction;
}) {
  const cwd = repoPath;
  await fsExtra.ensureDir(cwd);

  const repoExists = await checkIfRepoExists();
  if (!repoExists) {
    await createRepo();
  }

  await execaCommand("git add .", { cwd });
  const commitMessage = `"${commitAction} tracks ID=${playlistId}, SNAPSHOT=${snapshotId}"`;
  await execa("git", ["commit", "-m", commitMessage], { cwd });
}

export async function createPlaylistFile({
  playlistId,
  playlistName,
  repoPath = gitRepoPath,
}: {
  playlistId: string;
  playlistName: string;

  repoPath?: string;
}) {
  // change spaces to snake case, get rid of special characters
  playlistName = playlistName
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "");

  const playlistFilePath = path.join(
    repoPath,
    `${playlistId}_${playlistName}.txt`,
  );

  await fsExtra.ensureFile(playlistFilePath);
  return playlistFilePath;
}

export async function getExistingPlaylistFiles({
  playlistId,
  repoPath = gitRepoPath,
}: {
  playlistId: string;
  repoPath?: string;
}) {
  const files = await fsP.readdir(repoPath);
  const playlistFiles = files.filter((file) => file.startsWith(playlistId));
  const stats = await Promise.all(
    playlistFiles.map(async (file) => {
      return {
        file,
        mtime: (await fsP.stat(path.join(repoPath, file))).mtimeMs,
      };
    }),
  );
  return stats.toSorted((a, b) => b.mtime - a.mtime).map((stat) => stat.file);
}
