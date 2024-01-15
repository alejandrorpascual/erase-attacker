import { z } from "zod";
import { fetcher } from "./fetcher.ts";

const userProfileSchema = z.object({
  display_name: z.string().nullable(),
  external_urls: z.object({
    spotify: z.string(),
  }),
  followers: z.object({
    href: z.string().nullable(),
    total: z.number(),
  }),
  href: z.string(),
  id: z.string(),
  images: z.array(
    z.object({
      height: z.number(),
      url: z.string(),
      width: z.number(),
    }),
  ),
  type: z.string(),
  uri: z.string(),
});

export async function getUserPorfile(
  userId: string,
  { token }: { token: string },
) {
  const pathname = `/v1/users/${userId}`;
  const response = await fetcher(pathname, { token });

  if (response.status !== 200) {
    const errorResponse = await response.json();
    return {
      type: "error",
      status: response.status,
      message: response.statusText,
      response: errorResponse,
    } as const;
  }

  const data = await response.json();

  return {
    type: "success",
    data: userProfileSchema.parse(data),
  } as const;
}

export async function getUsersDisplayNames(
  userIds: string[],
  { token }: { token: string },
) {
  const responses = await Promise.all(
    userIds.map((userId) => getUserPorfile(userId, { token })),
  );

  // map: userId -> displayName
  const map = new Map<string, string>();
  responses.forEach((response, idx) => {
    if (response.type === "error") {
      map.set(userIds[idx], "Unknown");
    } else {
      map.set(response.data.id, response.data.display_name ?? "Unknown");
    }
  });

  return map;
}
