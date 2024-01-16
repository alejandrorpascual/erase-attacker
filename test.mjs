import { execaCommand } from "execa";
import os from "node:os";
import path from "node:path";

const gitRepoPath = path.join(os.homedir(), "spotify-playlists");
await execaCommand("git init", { cwd: gitRepoPath, cleanup: false });
