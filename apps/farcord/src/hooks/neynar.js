import { useEffect, useState } from "react";
import { useFarcasterChannel } from "./farcord";

const NEYNAR_V1_ENDPOINT = "https://api.neynar.com/v1/farcaster";
const NEYNAR_ENDPOINT = "https://api.neynar.com/v2/farcaster";

const DEFAULT_PAGE_SIZE = 30;

export const useNeynarChannelCasts = (channelId, cursor) => {
  const [casts, setCasts] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const channel = useFarcasterChannel(channelId);

  useEffect(() => {
    if (!channel?.parentUrl) return;

    const params = new URLSearchParams({
      api_key: process.env.NEYNAR_API_KEY,
      feed_type: "filter",
      filter_type: "parent_url",
      parent_url: channel?.parentUrl,
      limit: DEFAULT_PAGE_SIZE,
      cursor: cursor || null,
    });

    async function fetchCasts() {
      fetch(NEYNAR_ENDPOINT + "/feed?" + params)
        .then((result) => {
          return result.json();
        })
        .then((data) => {
          setCasts(data.casts.reverse());
          setNextCursor(data.next.cursor);
        })
        .catch((err) => {
          throw err;
        });
    }

    fetchCasts();
  }, [channelId, cursor, channel]);

  return { casts, nextCursor };
};

export const useNeynarCast = (castHash) => {
  const [cast, setCast] = useState(null);

  useEffect(() => {
    async function fetchCast() {
      const params = new URLSearchParams({
        api_key: process.env.NEYNAR_API_KEY,
        hash: castHash,
      });

      fetch(NEYNAR_V1_ENDPOINT + "/cast?" + params)
        .then((result) => {
          return result.json();
        })
        .then((data) => {
          setCast(data.result.cast);
        })
        .catch((err) => {
          throw err;
        });
    }

    fetchCast();
  }, [castHash]);

  return cast;
};

export const useNeynarThreadCasts = (castHash) => {
  const [casts, setCasts] = useState(null);

  useEffect(() => {
    async function fetchCast() {
      const params = new URLSearchParams({
        api_key: process.env.NEYNAR_API_KEY,
        threadHash: castHash,
      });

      fetch(NEYNAR_V1_ENDPOINT + "/all-casts-in-thread?" + params)
        .then((result) => {
          return result.json();
        })
        .then((data) => {
          setCasts(data.result.casts.slice(1));
        })
        .catch((err) => {
          throw err;
        });
    }

    fetchCast();
  }, [castHash]);

  return casts;
};

export const useNeynarRootCast = (castHash) => {
  const [rootCast, setRootCast] = useState(null);

  async function fetchCast(hash) {
    const params = new URLSearchParams({
      api_key: process.env.NEYNAR_API_KEY,
      hash: hash,
    });
    fetch(NEYNAR_V1_ENDPOINT + "/cast?" + params)
      .then((result) => {
        return result.json();
      })
      .then((data) => {
        const cast = data.result.cast;
        if (cast?.parentHash) {
          return fetchCast(cast.parentHash);
        } else {
          return cast;
        }
      })
      .then((cast) => {
        setRootCast(cast);
      })
      .catch((err) => {
        throw err;
      });
  }

  useEffect(() => {
    if (!castHash) return;
    fetchCast(castHash);
  }, [castHash]);

  return rootCast;
};
