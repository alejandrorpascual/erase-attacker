export function getPlaylistId(url: string) {
  return new URL(url).pathname.replace("/playlist/", "");
}
