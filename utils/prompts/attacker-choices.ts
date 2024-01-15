import { multiselect } from "@clack/prompts";
import { promptWrapper } from "../prompt.ts";
import { z } from "zod";

export async function getAttackerUsernameChoices(
  final: (readonly [string, string, string])[],
) {
  const choices = await promptWrapper(() =>
    multiselect({
      message: "attacker?",
      options: final.map(([userId, username, tracks], index) => {
        const options: { label: string; value: string; hint?: string } = {
          label: `${username} (${tracks})`,
          value: userId,
          hint: undefined,
        };

        if (index === 0) {
          options.hint = "probably the attacker";
        }

        return options;
      }),
    }),
  );

  return z.string().array().parse(choices);
}
