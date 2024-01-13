import { z } from "zod";
import fsExtra from "fs-extra";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const tokenSchema = z.object({
  access_token: z.string(),
  token_type: z.literal("bearer"),
  expires_in: z.number(),
});

type GetTokenParams = (
  | {
      savedToken?: undefined;
      lastTokenDate?: undefined;
    }
  | {
      savedToken: string;
      lastTokenDate: Date;
    }
) & { saveToFile?: boolean };

export async function getToken(
  { saveToFile, ...rest }: GetTokenParams = {
    saveToFile: true,
  },
) {
  let lastTokenDate = rest.lastTokenDate;
  let savedToken = rest.savedToken;

  if (!savedToken && !lastTokenDate) {
    const tokenFromFile = await getTokenFromFile();

    if (tokenFromFile) {
      lastTokenDate = tokenFromFile.lastUsed;
      savedToken = tokenFromFile.token;
    }
  }

  if (lastTokenDate && !checkIfTokenExpired(lastTokenDate)) {
    return savedToken;
  }

  const tokenResponse = await getTokenResponse();

  if (saveToFile) {
    await saveTokenToFile({
      token: tokenResponse.access_token,
      lastUsed: new Date(),
    });
  }

  return tokenResponse.access_token;
}

async function getTokenResponse() {
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64"),
    },
  });

  return tokenSchema.parse(await response.json());
}

async function checkIfTokenExpired(lastTokenDate: Date) {
  const now = new Date();
  const diff = now.getTime() - lastTokenDate.getTime();

  return diff > 3600 * 1000;
}

const saveTokenSchema = z.object({
  token: z.string(),
  lastUsed: z.date(),
});

type SaveToken = z.infer<typeof saveTokenSchema>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const here = (...p: string[]) => path.join(__dirname, ...p);

export async function saveTokenToFile(
  data: SaveToken,
  filename = ".token.json",
) {
  const filePath = here(filename);
  return fsExtra.writeJSON(filePath, data);
}

export async function getTokenFromFile(filename = ".token.json") {
  const filePath = here(filename);
  const exists = await fsExtra.exists(filePath);

  if (!exists) return null;

  return saveTokenSchema.parse(await fsExtra.readJSON(filePath));
}
