import { serve } from "@hono/node-server";
import { Hono, type Context } from "hono";
import { REDIRECT_PATH, config } from "@utils/env.ts";
import { scopes } from "@utils/scopes.ts";
import { randomUUID } from "node:crypto";
import open from "open";
import { saveTokenToFile } from "@utils/token-storage.ts";
import { getTokenResponse } from "@utils/get-token-response.ts";
import { log } from "@clack/prompts";

const app = new Hono();

app.get("/", entryHandler);

async function entryHandler(c: Context) {
  const params = new URLSearchParams({
    client_id: config.spotify.clientId,
    response_type: "code",
    redirect_uri: config.spotify.redirectUri,
    scope: scopes.join(" "),
    state: randomUUID(),
  });

  await open(`https://accounts.spotify.com/authorize?${params.toString()}`);

  return c.text("Check your browser!");
}

app.get(`/${REDIRECT_PATH}`, callbackHandler);

export async function callbackHandler(c: Context) {
  const url = new URL(c.req.url);
  const code = String(url.searchParams.get("code"));

  const tokenData = await getTokenResponse({ code });
  await saveTokenToFile({ ...tokenData, last_generated: new Date() });

  return c.text("You're all set!");
}

export function getServer() {
  const server = serve(
    {
      fetch: app.fetch,
      port: config.port,
    },
    ({ port }) => {
      if (config.env === "development") {
        log.info(`🚧 Server listening on http://localhost:${port}`);
      }
    },
  );
  return server;
}
