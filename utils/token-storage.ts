import { z } from "zod";
import fsExtra from "fs-extra";
import { tokenFilePath } from "~/init.ts";

const saveTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  last_generated: z.string().transform((date) => new Date(date)),
});

export type SaveToken = z.infer<typeof saveTokenSchema>;

export async function saveTokenToFile(
  data: SaveToken,
  filePath = tokenFilePath,
) {
  return fsExtra.writeJSON(filePath, data);
}

export async function getTokenFromFile(filePath = tokenFilePath) {
  const exists = await fsExtra.pathExists(filePath);
  if (!exists) return null;

  return saveTokenSchema.parse(await fsExtra.readJSON(filePath));
}
