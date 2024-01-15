import { checkIfTokenExpired } from "@utils/check-expiration.ts";
import { refreshToken } from "@utils/refresh-token.ts";
import { getTokenFromFile } from "@utils/token-storage.ts";

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
