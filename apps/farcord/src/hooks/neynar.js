import React, { useEffect, useState } from "react";
import { useFarcasterChannel } from "./farcord";
import { message as messageUtils } from "@shades/common/utils";

const NEYNAR_V1_ENDPOINT = "https://api.neynar.com/v1/farcaster";
const NEYNAR_V2_ENDPOINT = "https://api.neynar.com/v2/farcaster";

const DEFAULT_PAGE_SIZE = 30;

export async function fetchNeynarCasts({ parentUrl, cursor }) {
  let params = new URLSearchParams({
    api_key: process.env.NEYNAR_API_KEY,
    feed_type: "filter",
    filter_type: "parent_url",
    parent_url: parentUrl,
    limit: DEFAULT_PAGE_SIZE,
  });

  if (cursor) params.set("cursor", cursor);

  return fetch(NEYNAR_V2_ENDPOINT + "/feed?" + params)
    .then((result) => {
      return result.json();
    })
    .then((data) => {
      return data.casts?.map((cast) => {
        return {
          ...cast,
          richText: cast.text ? messageUtils.parseString(cast.text) : null,
        };
      });
    })
    .then((parsedCasts) => {
      return parsedCasts.reverse();
    })
    .catch((err) => {
      throw err;
    });
}

export const useNeynarChannelCasts = (channelId) => {
  const [casts, setCasts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [pending, setPending] = useState(false);
  const channel = useFarcasterChannel(channelId);

  const fetchCasts = React.useCallback(
    async (query = {}) => {
      const { cursor } = query;
      let params = new URLSearchParams({
        api_key: process.env.NEYNAR_API_KEY,
        feed_type: "filter",
        filter_type: "parent_url",
        parent_url: channel?.parentUrl,
        limit: DEFAULT_PAGE_SIZE,
      });

      if (cursor) params.set("cursor", cursor);

      setPending(true);
      fetch(NEYNAR_V2_ENDPOINT + "/feed?" + params)
        .then((result) => {
          return result.json();
        })
        .then((data) => {
          setNextCursor(data.next.cursor);
          return data.casts?.map((cast) => {
            return {
              ...cast,
              richText: cast.text ? messageUtils.parseString(cast.text) : null,
            };
          });
        })
        .then((parsedCasts) => {
          setCasts(parsedCasts.reverse());
        })
        .catch((err) => {
          throw err;
        })
        .finally(() => {
          setPending(false);
        });
    },
    [channel?.parentUrl]
  );

  useEffect(() => {
    if (!channel?.parentUrl) return;

    fetchCasts();
  }, [channel, fetchCasts]);

  return { casts, nextCursor, fetchCasts, pending };
};

export const useNeynarRecentCasts = ({ cursor, fid }) => {
  const [casts, setCasts] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);

  useEffect(() => {
    let params = new URLSearchParams({
      api_key: process.env.NEYNAR_API_KEY,
      viewerFid: fid,
      limit: DEFAULT_PAGE_SIZE,
    });

    if (cursor) params.set("cursor", cursor);

    async function fetchCasts() {
      fetch(NEYNAR_V1_ENDPOINT + "/recent-casts?" + params)
        .then((result) => {
          return result.json();
        })
        .then((data) => {
          setNextCursor(data.result.next.cursor);
          return data.result.casts?.map((cast) => {
            return {
              ...cast,
              richText: cast.text ? messageUtils.parseString(cast.text) : null,
            };
          });
        })
        .then((parsedCasts) => {
          setCasts(parsedCasts.reverse());
        })
        .catch((err) => {
          throw err;
        });
    }

    fetchCasts();
  }, [fid, cursor]);

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
          setCast({
            ...data.result.cast,
            richText: data.result.cast.text
              ? messageUtils.parseString(data.result.cast.text)
              : null,
          });
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
          return data.result.casts?.map((cast) => {
            return {
              ...cast,
              richText: cast.text ? messageUtils.parseString(cast.text) : null,
            };
          });
        })
        .then((parsedCasts) => {
          setCasts(parsedCasts.slice(1));
        })
        .catch((err) => {
          throw err;
        });
    }

    fetchCast();
  }, [castHash]);

  return casts;
};

export const useNeynarUser = (fid) => {
  const [user, setUser] = useState(null);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (!fid) return;

    setIsFetching(true);

    async function fetchCast() {
      const params = new URLSearchParams({
        api_key: process.env.NEYNAR_API_KEY,
        fid,
      });

      fetch(NEYNAR_V1_ENDPOINT + "/user?" + params)
        .then((result) => {
          return result.json();
        })
        .then((data) => {
          setUser(data.result.user);
        })
        .catch((err) => {
          throw err;
        })
        .finally(() => {
          setIsFetching(false);
        });
    }

    fetchCast();
  }, [fid]);

  return { user, isFetching };
};
