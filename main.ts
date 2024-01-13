import { serve } from "@hono/node-server";
import { Hono, type Context } from "hono";
import { config } from "./utils/env.ts";
import { scopes } from "./utils/scopes.ts";
import { randomUUID } from "node:crypto";
import open from "open";
import { getToken } from "./utils/get-token.ts";

const app = new Hono();

app.get("/", entryHandler);

async function entryHandler(c: Context) {
  const params = new URLSearchParams({
    client_id: config.spotify.clientId,
    response_type: "code",
    redirect_uri: "http://localhost:3000/callback",
    scope: scopes.join(" "),
    state: randomUUID(),
  });

  await open(`https://accounts.spotify.com/authorize?${params.toString()}`);
  return c.text("Check your browser!");
}

app.get("/callback", callbackHandler);

export async function callbackHandler(c: Context) {
  const url = new URL(c.req.url);
  const code = String(url.searchParams.get("code"));

  await getToken({ code });
}

const server = serve(app);
