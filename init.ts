import path from "node:path";

process.on("SIGINT", () => {
  process.exit();
});

process.on("SIGTERM", () => {
  process.exit();
});

const DEFAULT_TOKEN_FILENAME = "token.json";
const DEFAULT_TRACKS_FILENAME = "tracks.json";

export const tokenFilePath = path.join(process.cwd(), DEFAULT_TOKEN_FILENAME);
export const tracksFilePath = path.join(process.cwd(), DEFAULT_TRACKS_FILENAME);

