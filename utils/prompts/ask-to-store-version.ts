import { confirm, text } from "@clack/prompts";
import { config } from "@utils/env.ts";
import { promptWrapper } from "@utils/prompt.ts";
import fsExtra from "fs-extra/esm";

export async function askToStoreInVersionControl() {
  const isStore = await promptWrapper(() =>
    confirm({
      message:
        "Do you want store this playlist in a local repo for version control?",
      initialValue: true,
    }),
  );

  if (!isStore) return { type: "no-store" } as const;

  const path = await promptWrapper(() =>
    text({
      message: "This is the default path for the local repo, type to change it",
      initialValue: config.spotify.gitRepoPath,
      validate: (input) => {
        try {
          fsExtra.ensureDirSync(input);
        } catch (e) {
          return "Something went wrong, are you sure this is a valid path?";
        }
      },
    }),
  );

  return { type: "store", path } as const;
}
