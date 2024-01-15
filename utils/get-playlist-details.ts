import { fetcher } from "@utils/fetcher.ts";
import { z } from "zod";
import { imageResponseSchema } from "~/spotify-responses/image.ts";
import { userResponseSchema } from "~/spotify-responses/user.ts";

export const playlistDetailsResponseSchema = z.object({
  images: imageResponseSchema.array(),
  name: z.string(),
  owner: userResponseSchema,
  tracks: z.object({
    total: z.number(),
  }),
  snapshot_id: z.string(),
});

export async function getPlaylistDetails(
  playlistId: string,
  { token }: { token: string },
) {
  const pathname = `v1/playlists/${playlistId}`;
  const response = await fetcher(pathname, { token });

  if (response.status !== 200) {
    return {
      type: "error",
      message: response.statusText,
      status: response.status,
      response: await response.json(),
    } as const;
  }

  const jsonResponse = await response.json();
  return {
    type: "success",
    data: playlistDetailsResponseSchema.parse(jsonResponse),
  } as const;
}
