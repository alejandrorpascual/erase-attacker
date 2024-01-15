import { text } from "@clack/prompts";
import { getPlaylistId } from "../general.ts";
import { promptWrapper } from "../prompt.ts";

export async function getPlaylistIdPrompt({
  message = "Enter the playlist URL",
  initialValue,
}: {
  message?: string;
  initialValue?: string;
} = {}) {
  const playlistUrl = await promptWrapper(() =>
    text({
      message,
      initialValue,
      validate: (value) => {
        try {
          const url = new URL(value);
          if (!url.hostname.includes("spotify.com")) {
            return "Invalid URL";
          }
        } catch (e) {
          return "Invalid URL";
        }
      },
    }),
  );

  return getPlaylistId(playlistUrl);
}
