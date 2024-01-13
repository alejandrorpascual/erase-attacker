import "./init.ts";
import "./utils/env.ts";
import {
  cancel,
  intro,
  text,
  isCancel,
  outro,
  log,
  spinner,
} from "@clack/prompts";
import { getTokenFromFile } from "./utils/token-storage.ts";
import { getServer } from "./server.ts";
import { isPlaylistCollaborative } from "./utils/get-playlist-tracks.ts";
import { getPlaylistId } from "./utils/general.ts";
import invariant from "tiny-invariant";

intro(`create-my-app`);

let tokenData = await getTokenFromFile();

if (!tokenData) {
  log.info("You need to authenticate first.");
  const server = getServer();
  await fetch("http://localhost:3000");
  tokenData = await getTokenFromFile();
  invariant(tokenData, "Token data should be defined.");
  if (tokenData) {
    server.close();
  }
}

// if (isCancel(value)) {
//   cancel("Operation cancelled.");
//   process.exit(0);
// }
outro(`You're all set!`);

// let tokenData = await getTokenFromFile();
//
// if (!tokenData) {
//   log.info("You need to authenticate first.");
//   const server = getServer();
//   await fetch("http://localhost:3000");
//   tokenData = await getTokenFromFile();
//   if (tokenData) {
//     server.close();
//   }
// }
//
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
const s = spinner();
s.start("Checking if playlist is collaborative");

outro(`You're all set!`);
