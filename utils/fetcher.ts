import { config } from "./env.ts";

export async function fetcher(
  pathname: string,
  { token, ...options }: { token: string; offset?: number; limit?: number },
) {
  const url = new URL(pathname, config.spotify.baseApiUrl);
  if (options.offset) {
    url.searchParams.set("offset", String(options.offset));
  }
  if (options.limit) {
    url.searchParams.set("limit", String(options.limit));
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response;
}
