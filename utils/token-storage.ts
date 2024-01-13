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
