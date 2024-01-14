import { z } from "zod";
import { config } from "./env.ts";
import { saveTokenToFile } from "./token-storage.ts";

const refreshTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
});

export async function getNewToken({
  refresh_token,
}: {
  refresh_token: string;
}) {
  const url = "https://accounts.spotify.com/api/token";

  const payload = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh_token,
      client_id: config.spotify.clientId,
    }),
  };
  const body = await fetch(url, payload);
  return refreshTokenSchema.parse(await body.json());
}

export async function refreshToken({
  refresh_token,
}: {
  refresh_token: string;
}) {
  const tokenData = await getNewToken({ refresh_token });
  const last_generated = new Date();
  const newTokenData = {
    last_generated,
    ...tokenData,
  };

  await saveTokenToFile(newTokenData);
  return newTokenData;
}
