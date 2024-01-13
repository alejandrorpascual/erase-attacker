import { z } from "zod";
import { config } from "./env.ts";

export const tokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal("Bearer"),
  expires_in: z.number().default(3600),
  refresh_token: z.string(),
  scope: z.string(),
});

export async function getTokenResponse({ code }: { code: string }) {
  const tokenUrl = new URL("https://accounts.spotify.com/api/token");
  const payload = {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          config.spotify.clientId + ":" + config.spotify.clientSecret,
        ).toString("base64"),
    },
    body: new URLSearchParams({
      code,
      redirect_uri: config.spotify.redirectUri,
      grant_type: "authorization_code",
    }),
  };

  const response = await fetch(tokenUrl, payload);

  return tokenResponseSchema.parse(await response.json());
}
