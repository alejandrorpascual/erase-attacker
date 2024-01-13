import { cancel, intro, isCancel, outro, log } from "@clack/prompts";
import "./utils/env.ts";
import { getTokenFromFile, tokenFilePath } from "./utils/token-storage.ts";
import { getServer } from "./server.ts";

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
