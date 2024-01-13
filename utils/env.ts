import { italic, red } from "kolorist";
import { z } from "zod";

export const REDIRECT_PATH = "auth/spotify/callback";
const BASE_API_URL = "https://api.spotify.com";

export const spotifyEnvSchema = z.object({
  SPOTIFY_CLIENT_ID: z.string(),
  SPOTIFY_CLIENT_SECRET: z.string(),
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

export const config = {
  env: processedEnv.NODE_ENV,
  spotify: {
    clientId: processedEnv.SPOTIFY_CLIENT_ID,
    clientSecret: processedEnv.SPOTIFY_CLIENT_SECRET,
    redirectUri: `http://localhost:3000/${REDIRECT_PATH}`,
    baseApiUrl: BASE_API_URL,
  },
};
