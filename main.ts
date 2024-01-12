const PLAYLIST_ID = "6K8IXTvP1W4PvOAxPQQ5cs";
const playlistItemsUrl = new URL(
  `v1/playlists/${PLAYLIST_ID}/tracks`,
  "https://api.spotify.com/",
);

new Headers();
headers.set("Authorization", `Bearer ${token}`);

