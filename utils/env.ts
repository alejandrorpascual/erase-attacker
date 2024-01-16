import { italic, red } from "kolorist";
import { z } from "zod";

export const REDIRECT_PATH = "auth/spotify/callback";
const BASE_API_URL = "https://api.spotify.com";

export const spotifyEnvSchema = z.object({
  SPOTIFY_CLIENT_ID: z.string(),
  SPOTIFY_CLIENT_SECRET: z.string(),
  FROM_PLAYLIST_URL: z.string().optional(),
  TO_PLAYLIST_URL: z.string().optional(),
});

const schema = z
  .object({
    NODE_ENV: z
      .enum(["production", "development", "test"] as const)
      .default("development"),
  })
  .merge(spotifyEnvSchema);

declare global {
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof schema> {}
  }
}

const parsedEnv = schema.safeParse(process.env);
process.env.dd;

if (!parsedEnv.success) {
  console.log(
    red(
      `Missing ${italic("SPOTIFY_CLIENT_ID")} and ${italic(
        "SPOTIFY_CLIENT_SECRET",
      )} enviroment variables. You can add them to your .env file.`,
    ),
  );
  process.exit(1);
}

const processedEnv = parsedEnv.data;

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
export const config = {
  env: processedEnv.NODE_ENV,
  port: PORT,
  serverUri: `http://localhost:${PORT}`,
  spotify: {
    clientId: processedEnv.SPOTIFY_CLIENT_ID,
    clientSecret: processedEnv.SPOTIFY_CLIENT_SECRET,
    testAttack: {
      fromPlaylistURL: process.env.FROM_PLAYLIST_URL,
      toPlaylistURL: process.env.TO_PLAYLIST_URL,
    },
    redirectUri: `http://localhost:${PORT}/${REDIRECT_PATH}`,
    baseApiUrl: BASE_API_URL,
  },
};
