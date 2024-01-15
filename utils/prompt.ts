import { cancel, isCancel } from "@clack/prompts";

export async function promptWrapper<T>(fn: () => Promise<T | symbol>) {
  const result = await fn();

  if (isCancel(result)) {
    cancel("Operation cancelled.");
    process.exit(0);
  }

  return result;
}
