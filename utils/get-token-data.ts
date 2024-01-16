import { log, type spinner } from "@clack/prompts";
import { authenticate } from "@utils/auth.ts";
import { checkIfTokenExpired } from "@utils/check-expiration.ts";
import { refreshToken } from "@utils/refresh-token.ts";
import { getTokenFromFile } from "@utils/token-storage.ts";
import { getServer } from "~/server.ts";

export async function getTokenDataFromFile() {
  let tokenData = await getTokenFromFile();
  if (!tokenData) throw new Error("No token data found in file");

  if (await checkIfTokenExpired(tokenData.last_generated)) {
    tokenData = await refreshToken({
      refresh_token: tokenData.refresh_token,
    });
  }

  return tokenData;
}

export async function entireTokenFlow(s: ReturnType<typeof spinner>) {
  let tokenData = await getTokenFromFile();

  if (!tokenData) {
    const server = getServer();

    log.info("You need to authenticate first.");

    s.start("Waiting for token...");
    tokenData = await authenticate().finally(() => {
      server.close();
    });
    s.stop();
  }

  if (await checkIfTokenExpired(tokenData.last_generated)) {
    tokenData = await refreshToken({
      refresh_token: tokenData.refresh_token,
    });
  }

  return tokenData;
}
