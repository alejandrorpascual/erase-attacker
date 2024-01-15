import { setInterval, setTimeout } from "timers/promises";
import { log } from "@clack/prompts";
import { SaveToken, getTokenFromFile } from "./token-storage.ts";
import invariant from "tiny-invariant";
import { config } from "./env.ts";

export async function authenticate() {
  await fetch(config.serverUri);

  let timeoutDone = false;

  setTimeout(10_000).then(() => {
    timeoutDone = true;
  });

  let tokenData: SaveToken | null = null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _ of setInterval(500)) {
    tokenData = await getTokenFromFile();
    if (tokenData) {
      break;
    }
    if (timeoutDone) {
      log.error("Operation cancelled.");
      process.exit(1);
    }
  }

  invariant(tokenData, "Token data should be defined.");
  return tokenData;
}
