import { cancel, intro, text, isCancel, outro, log } from "@clack/prompts";
import "./utils/env.ts";
import { getTokenFromFile } from "./utils/token-storage.ts";
import { getServer } from "./server.ts";
import { isPlaylistCollaborative } from "./utils/get-playlist-tracks.ts";
import invariant from "tiny-invariant";
import { getPlaylistId } from "./utils/general.ts";

intro(`create-my-app`);

let token = await getTokenFromFile();

if (!token) {
  log.info("You need to authenticate first.");
  const server = getServer();
  await fetch("http://localhost:3000");
  token = await getTokenFromFile();
  if (token) {
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
// const playlistUrl = await text({
//   message: "Enter the playlist URL",
//   validate: (value) => {
//     try {
//       const url = new URL(value);
//       if (!url.hostname.includes("spotify.com")) {
//         return "Invalid URL";
//       }
//     } catch (e) {
//       return "Invalid URL";
//     }
//   },
// });
//
// if (isCancel(playlistUrl)) {
//   cancel("Operation cancelled.");
//   process.exit(0);
// }
//
// const playlistId = getPlaylistId(playlistUrl);
// invariant(tokenData, "Invalid playlist URL");
// const res = await isPlaylistCollaborative(playlistId, {
//   token: tokenData.access_token,
// });
//
// if (res.type === "error") {
//   log.error(res.message);
//   process.exit(1);
// }
//
// if (!res.data) {
//   log.error("Your playlist is not collaborative. 🤔");
//   process.exit(1);
// }

// outro(`You're all set!`);
