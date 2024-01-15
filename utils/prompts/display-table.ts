import { log } from "@clack/prompts";
import { green, yellow } from "kolorist";
import { TableUserConfig, table } from "table";

export function displayTable({
  userTracksMap,
  userProfileMap,
}: {
  userTracksMap: Map<string, string[]>;
  userProfileMap: Map<string, string>;
}) {
  const final = [...userTracksMap.entries()]
    .map(
      ([userId, tracks]) =>
        [
          userId,
          userProfileMap.get(userId) ?? "unknown",
          tracks.length,
        ] as const,
    )
    .toSorted((a, b) => b[2] - a[2])
    .map(
      ([userId, username, tracks]) =>
        [userId, username, tracks.toString()] as const,
    );

  const config: TableUserConfig = {
    header: {
      content: green("RESULTS"),
      alignment: "center",
    },
  };

  const tracks = [
    ["User ID", "Username", "Tracks Added"].map((item) => yellow(item)),
    ...final,
  ];

  // WARN: silly fix for typescript
  log.info(table(tracks as string[][], config));
  return final;
}
