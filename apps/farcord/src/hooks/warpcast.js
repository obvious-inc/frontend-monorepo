import React from "react";

const WARPCAST_DEFAULT_LIMIT = 30;
const WARPCAST_API_ENDPOINT = "https://api.warpcast.com/v2";

const WARPCAST_API_TOKEN = import.meta.env.PUBLIC_WARPCAST_API_TOKEN;

export const useRecentCasts = (cursor, fid) => {
  const [casts, setCasts] = React.useState(null);
  const [nextCursor, setNextCursor] = React.useState(null);

  React.useEffect(() => {
    const params = new URLSearchParams({
      limit: WARPCAST_DEFAULT_LIMIT,
    });

    const headers = new Headers({ Authorization: WARPCAST_API_TOKEN });

    async function fetchCasts() {
      fetch(WARPCAST_API_ENDPOINT + "/recent-casts?" + params, { headers })
        .then((result) => {
          return result.json();
        })
        .then((data) => {
          setCasts(data.result.casts.reverse());
          setNextCursor(data.next.cursor);
        })
        .catch((err) => {
          throw err;
        });
    }

    fetchCasts();
  }, [cursor, fid]);

  return { casts, nextCursor };
};

export const useFollowedChannels = (fid) => {
  const [channels, setChannels] = React.useState(null);

  React.useEffect(() => {
    if (!fid) return;

    const params = new URLSearchParams({
      fid,
      limit: WARPCAST_DEFAULT_LIMIT,
    });

    const headers = new Headers({ Authorization: WARPCAST_API_TOKEN });

    async function fetchCasts() {
      fetch(WARPCAST_API_ENDPOINT + "/user-following-channels?" + params, {
        headers,
      })
        .then((result) => {
          return result.json();
        })
        .then((data) => {
          setChannels(data.result.channels);
        })
        .catch((err) => {
          throw err;
        });
    }

    fetchCasts();
  }, [fid]);

  return channels;
};
