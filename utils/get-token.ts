import { getTokenResponse } from "./get-token-response.ts";
import { getNewToken } from "./refresh-token.ts";
import { checkIfTokenExpired } from "./check-expiration.ts";
import { getTokenFromFile, saveTokenToFile } from "./token-storage.ts";

type GetTokenParams = { saveToFile?: boolean; code: string };

export async function getToken({ saveToFile, code }: GetTokenParams) {
  saveToFile ??= true;

  const tokenFromFile = await getTokenFromFile();

  if (tokenFromFile) {
    const isExpired = checkIfTokenExpired(tokenFromFile.last_generated);

    if (!isExpired) {
      return tokenFromFile.access_token;
    }

    const { access_token: newToken, refresh_token } = await getNewToken({
      refresh_token: tokenFromFile.refresh_token,
    });

    if (saveToFile) {
      await saveTokenToFile({
        access_token: newToken,
        last_generated: new Date(),
        refresh_token,
      });
    }

    return newToken;
  }

  const tokenResponse = await getTokenResponse({ code });

  if (saveToFile) {
    await saveTokenToFile({
      access_token: tokenResponse.access_token,
      last_generated: new Date(),
      refresh_token: tokenResponse.refresh_token,
    });
  }

  return tokenResponse.access_token;
}
