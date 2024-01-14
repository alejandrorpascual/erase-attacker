import { config } from "./env.ts";

type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type HTTPMethodLowercase = "get" | "post" | "put" | "delete" | "patch";

export async function fetcher(
  pathname: string,
  {
    token,
    ...options
  }: {
    token: string;
    offset?: number;
    limit?: number;
    method?: HTTPMethodLowercase | HTTPMethod;
    body?: BodyInit;
    headers?: HeadersInit;
  },
) {
  const url = new URL(pathname, config.spotify.baseApiUrl);
  if (options.offset) {
    url.searchParams.set("offset", String(options.offset));
  }
  if (options.limit) {
    url.searchParams.set("limit", String(options.limit));
  }

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }

  const response = await fetch(url, {
    headers,
    method: options.method ?? "GET",
    body: options.body,
  });

  return response;
}
