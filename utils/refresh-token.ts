import { z } from "zod";
import { config } from "@utils/env.ts";
import { saveTokenToFile } from "@utils/token-storage.ts";

const refreshTokenSchema = z.object({
  access_token: z.string(),
  token_type: z.literal("Bearer"),
  scope: z.string(),
  expires_in: z.number(),
});

export async function getNewToken({
  refresh_token,
}: {
  refresh_token: string;
}) {
  const url = new URL("https://accounts.spotify.com/api/token");

  const body = {
    grant_type: "refresh_token",
    refresh_token,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          config.spotify.clientId + ":" + config.spotify.clientSecret,
        ).toString("base64"),
    },
    body: new URLSearchParams(body),
  });

  if (response.status !== 200) {
    console.error("Error while refreshing token");
    console.error({ refresh_token });
    console.error("Status code:", response.status);
    console.error("Message:", response.statusText);
    console.error("Body:", await response.json());

    throw new Error("‼️ Error while refreshing token");
  }

  const jsonResponse = await response.json();
  return refreshTokenSchema.parse(jsonResponse);
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
    refresh_token,
    ...tokenData,
  };

  await saveTokenToFile(newTokenData);
  return newTokenData;
}
