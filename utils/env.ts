import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["production", "development", "test"] as const),
  SPOTIFY_CLIENT_ID: z.string(),
  SPOTIFY_CLIENT_SECRET: z.string(),
});

declare global {
  namespace NodeJS {
    interface ProcessEnv extends z.infer<typeof schema> {}
  }
}

const processedEnv = schema.parse(process.env);

export const config = {
  env: processedEnv.NODE_ENV,
  spotify: {
    clientId: processedEnv.SPOTIFY_CLIENT_ID,
    clientSecret: processedEnv.SPOTIFY_CLIENT_SECRET,
  },
};
