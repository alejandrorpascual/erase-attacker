import { intro, log, outro, select } from "@clack/prompts";
import { promptWrapper } from "@utils/prompt.ts";
import { deleteFlow } from "@utils/prompts/delete-flow.ts";
import { z } from "zod";

const controller = new AbortController();
process.on("SIGINT", () => {
  controller.abort();
});

async function storeFlow({ controller }: { controller: AbortController }) {
  console.log("STORING FLOW LOL!");
}

const flowKeysSchema = z.enum(["delete", "store"]);
type FlowKeys = z.infer<typeof flowKeysSchema>;

type FlowValue = {
  message: string;
  flow: (args: { controller: AbortController }) => Promise<void>;
};

const flows: Record<FlowKeys, FlowValue> = {
  delete: {
    message: "Delete tracks from a playlist",
    flow: deleteFlow,
  },
  store: {
    message: "Store a playlist for version control",
    flow: storeFlow,
  },
};

intro(`🔥 Spotify Playlist Cleaner 🔥`);
log.info(
  "This tool will help you to clean your Spotify playlists, from tracks added by a specific user (spammer? 🙄)",
);

const choice = (await promptWrapper(() =>
  select({
    message: "What do you want to do?",
    initialValue: "delete",
    options: Object.entries(flows).map((entry) => {
      const [key, { message }] = entry;
      const parsedKey = flowKeysSchema.parse(key);
      return {
        label: message,
        value: parsedKey,
      };
    }),
  }),
)) as keyof typeof flows;

await flows[choice].flow({ controller });
outro(`✅ Done!`);
