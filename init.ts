import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const here = (...p: string[]) => path.join(__dirname, ...p);

const DEFAULT_TOKEN_FILENAME = "token.json";
const DEFAULT_TRACKS_FILENAME = "tracks.txt";

export const tokenFilePath = here(DEFAULT_TOKEN_FILENAME);
export const tracksFilePath = here(DEFAULT_TRACKS_FILENAME);
