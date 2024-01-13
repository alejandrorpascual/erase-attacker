import { z } from "zod";
import fsExtra from "fs-extra";
import path from "node:path";
import { fileURLToPath } from "node:url";

const saveTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  last_generated: z.date(),
});

type SaveToken = z.infer<typeof saveTokenSchema>;

const DEFAULT_TOKEN_FILENAME = ".token.json";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const here = (...p: string[]) => path.join(__dirname, ...p);
export const tokenFilePath = here("..", DEFAULT_TOKEN_FILENAME);

export async function saveTokenToFile(
  data: SaveToken,
  filename = ".token.json",
) {
  const filePath = here(filename);
  return fsExtra.writeJSON(filePath, data);
}

export async function getTokenFromFile(filePath = tokenFilePath) {
  const exists = await fsExtra.exists(filePath);

  if (!exists) return null;

  return saveTokenSchema.parse(await fsExtra.readJSON(filePath));
}
