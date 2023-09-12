import React from "react";

const WARPCAST_DEFAULT_LIMIT = 30;
const WARPCAST_API_ENDPOINT = "https://api.warpcast.com/v2";

export const useRecentCasts = (cursor, fid) => {
  const [casts, setCasts] = React.useState(null);
  const [nextCursor, setNextCursor] = React.useState(null);

  React.useEffect(() => {
    const params = new URLSearchParams({
      limit: WARPCAST_DEFAULT_LIMIT,
    });

    const headers = new Headers({
      Authorization:
        "MK-CokW0//eUrS2EoC2FJZGfliATGAT+uD3466PlOC+Zx51Q2g3yUwNTru1v3hF73tqNZPL1q8K4bqGlWO2v01xxg==",
    });

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
