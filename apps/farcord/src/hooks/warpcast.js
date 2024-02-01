const WARPCAST_DEFAULT_LIMIT = 30;
const WARPCAST_API_ENDPOINT = "https://api.warpcast.com/v2";

export async function fetchWarpcastFollowedChannels({ fid }) {
  if (!fid) return [];

  const params = new URLSearchParams({
    fid,
    limit: WARPCAST_DEFAULT_LIMIT,
  });

  const headers = new Headers({
    Authorization: import.meta.env.PUBLIC_WARPCAST_API_TOKEN,
  });

  return fetch(WARPCAST_API_ENDPOINT + "/user-following-channels?" + params, {
    headers,
  })
    .then((result) => {
      return result.json();
    })
    .then((data) => {
      return data.result.channels;
    })
    .then((channels) => {
      channels.forEach((c) => {
        c.id = c.key;
      });
      return channels;
    })
    .catch((err) => {
      throw err;
    });
}
