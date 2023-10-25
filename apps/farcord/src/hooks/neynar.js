import React from "react";
import { parseString } from "../utils/message";
import { array as arrayUtils } from "@shades/common/utils";

const NEYNAR_V1_ENDPOINT = "https://api.neynar.com/v1/farcaster";
const NEYNAR_V2_ENDPOINT = "https://api.neynar.com/v2/farcaster";

const DEFAULT_PAGE_SIZE = 30;

export async function fetchNeynarFeedCasts({
  parentUrl,
  fid,
  cursor,
  limit = DEFAULT_PAGE_SIZE,
}) {
  if (!parentUrl && !fid) return [];

  let params = new URLSearchParams({
    api_key: process.env.NEYNAR_API_KEY,
    limit,
  });

  if (parentUrl) {
    params.set("feed_type", "filter");
    params.set("filter_type", "parent_url");
    params.set("parent_url", parentUrl);
  } else if (fid) {
    params.set("fid", fid);
  }

  if (cursor) params.set("cursor", cursor);

  return fetch(NEYNAR_V2_ENDPOINT + "/feed?" + params)
    .then((result) => {
      return result.json();
    })
    .then((data) => {
      return data.casts;
    })
    .then(async (casts) => {
      return await Promise.all(
        casts.map(async (cast) => {
          return parseCast({ cast });
        })
      );
    })
    .then((parsedCasts) => {
      return parsedCasts.reverse();
    })
    .catch((err) => {
      throw err;
    });
}

export async function fetchNeynarRecentCasts({ cursor }) {
  let params = new URLSearchParams({
    api_key: process.env.NEYNAR_API_KEY,
    limit: DEFAULT_PAGE_SIZE,
  });

  if (cursor) params.set("cursor", cursor);

  return fetch(NEYNAR_V1_ENDPOINT + "/recent-casts?" + params)
    .then((result) => {
      return result.json();
    })
    .then((data) => {
      return data.result.casts;
    })
    .then(async (casts) => {
      return await Promise.all(
        casts.map(async (cast) => {
          return parseCast({ cast });
        })
      );
    })
    .then((parsedCasts) => {
      return parsedCasts.reverse();
    })
    .catch((err) => {
      throw err;
    });
}

export async function fetchNeynarThreadCasts({ threadCastHash, cursor }) {
  if (!threadCastHash) return [];

  const params = new URLSearchParams({
    api_key: process.env.NEYNAR_API_KEY,
    threadHash: threadCastHash,
  });

  if (cursor) params.set("cursor", cursor);

  return fetch(NEYNAR_V1_ENDPOINT + "/all-casts-in-thread?" + params)
    .then((result) => {
      return result.json();
    })
    .then((data) => {
      return data.result.casts;
    })
    .then(async (casts) => {
      return await Promise.all(
        casts.map(async (cast) => {
          return parseCast({ cast });
        })
      );
    })
    .then((parsedCasts) => {
      return parsedCasts.slice(1);
    })
    .catch((err) => {
      throw err;
    });
}

export async function fetchNeynarCast(castHash) {
  const params = new URLSearchParams({
    api_key: process.env.NEYNAR_API_KEY,
    hash: castHash,
  });

  if (!castHash) return null;

  return fetch(NEYNAR_V1_ENDPOINT + "/cast?" + params)
    .then((result) => {
      return result.json();
    })
    .then(async (data) => {
      return parseCast({ cast: data.result?.cast, hash: castHash });
    })
    .catch((err) => {
      throw err;
    });
}

export const fetchUserByFid = async (fid) => {
  const params = new URLSearchParams({
    api_key: process.env.NEYNAR_API_KEY,
    fid: Number(fid),
  });

  return fetch(NEYNAR_V1_ENDPOINT + "/user?" + params)
    .then((result) => {
      return result.json();
    })
    .then((jsonResult) => {
      return parseUser({ user: jsonResult.result.user });
    })
    .catch((err) => {
      throw err;
    });
};

export const fetchUserByUsername = async (username) => {
  const params = new URLSearchParams({
    api_key: process.env.NEYNAR_API_KEY,
    username,
  });

  return fetch(NEYNAR_V1_ENDPOINT + "/user-by-username?" + params)
    .then((result) => {
      return result.json();
    })
    .then((data) => {
      if (data.code) throw new Error(data.message);
      return parseUser({ user: data.result.user });
    })
    .catch((err) => {
      throw err;
    });
};

export const fetchCustodyAddressByUsername = async (username) => {
  return await fetchUserByUsername(username);
};

export async function fetchMentionAndReplies({
  fid,
  cursor,
  limit = DEFAULT_PAGE_SIZE,
}) {
  if (!fid) return [];

  let params = new URLSearchParams({
    api_key: process.env.NEYNAR_API_KEY,
    fid: Number(fid),
    limit,
  });

  if (cursor) params.set("cursor", cursor);

  return fetch(NEYNAR_V1_ENDPOINT + "/mentions-and-replies?" + params)
    .then((result) => {
      return result.json();
    })
    .then((data) => {
      return data.result.notifications?.map((notification) => {
        return parseNotification({ notification });
      });
    })
    .catch((err) => {
      throw err;
    });
}

export async function fetchReactionsAndRecasts({
  fid,
  cursor,
  limit = DEFAULT_PAGE_SIZE,
}) {
  if (!fid) return [];

  let params = new URLSearchParams({
    api_key: process.env.NEYNAR_API_KEY,
    fid: Number(fid),
    limit,
  });

  if (cursor) params.set("cursor", cursor);

  return fetch(NEYNAR_V1_ENDPOINT + "/reactions-and-recasts?" + params)
    .then((result) => {
      return result.json();
    })
    .then((data) => {
      return data.result.notifications?.map((notification) => {
        return parseNotification({ notification });
      });
    })
    .catch((err) => {
      throw err;
    });
}

export async function searchUsersByUsername({ fid, query }) {
  let params = new URLSearchParams({
    api_key: process.env.NEYNAR_API_KEY,
    viewer_fid: fid ? Number(fid) : 3, // required...
    q: query,
  });

  return fetch(NEYNAR_V2_ENDPOINT + "/user/search?" + params)
    .then((result) => {
      return result.json();
    })
    .then((data) => {
      return data.result.users;
    })
    .then((users) => {
      return users.map((user) => {
        return parseUser({ user });
      });
    })
    .catch((err) => {
      throw err;
    });
}

export const useSearchUsersByUsername = ({ fid, query, enabled }) => {
  const [results, setResults] = React.useState([]);

  React.useEffect(() => {
    if (!query) return;
    if (!enabled) return;

    const searchUsers = async () => {
      const results = await searchUsersByUsername({ fid, query });
      setResults(results);
    };

    searchUsers();
  }, [fid, query, enabled]);

  return results;
};

const parseUser = ({ user }) => {
  const { fid, username, profile } = user;

  const bio = profile?.bio?.text;
  const bioMentionedProfiles = profile?.bio?.mentionedProfiles ?? [];
  const bioBlocks = bio ? parseString(bio, bioMentionedProfiles) : [];

  const pfpUrl = user.pfp_url ?? user.pfp?.url;

  return {
    fid,
    username,
    displayName: user.displayName ?? user.display_name,
    bio,
    bioBlocks,
    pfpUrl,
    custodyAddress: user.custodyAddress ?? user.custody_address,
    followerCount: user.followerCount ?? user.follower_count,
    followingCount: user.followingCount ?? user.following_count,
  };
};

const parseCast = ({ cast, hash }) => {
  if (!cast) return { hash: hash, deleted: true };

  const mentionedProfiles = cast.mentionedProfiles ?? cast.mentioned_profiles;
  const richText = parseString(cast.text, mentionedProfiles);

  const reactions =
    "recasts" in cast
      ? {
          likes: arrayUtils.unique(cast.reactions?.fids || []),
          recasts: arrayUtils.unique(cast.recasts?.fids || []),
        }
      : {
          likes: arrayUtils.unique(
            cast.reactions?.likes.map((r) => r.fid) || []
          ),
          recasts: arrayUtils.unique(
            cast.reactions?.recasts.map((r) => r.fid) || []
          ),
        };

  const author = parseUser({ user: cast.author });

  return {
    hash: cast.hash,
    author: author,
    embeds: cast.embeds,
    text: cast.text,
    parentAuthor: cast.parentAuthor ?? cast.parent_author,
    parentHash: cast.parentHash ?? cast.parent_hash,
    parentUrl: cast.parentUrl ?? cast.parent_url,
    replies: cast.replies,
    threadHash: cast.threadHash ?? cast.thread_hash,
    timestamp: cast.timestamp,
    richText: richText,
    reactions: reactions,
    mentionedProfiles: mentionedProfiles,
  };
};

const parseNotification = ({ notification }) => {
  const { hash, text, type, timestamp } = notification;

  const richText = parseString(text, notification.mentionedProfiles);
  const author = parseUser({ user: notification.author });

  const reactors = notification.reactors?.map((r) => {
    return parseUser({ user: r });
  });

  return {
    ...notification,
    text,
    hash,
    richText,
    type: type ?? notification.reactionType,
    timestamp,
    author,
    reactors,
  };
};

export const extractUsersFromNeynarCast = (cast) => {
  if (!cast) return [];

  const author = cast.author;
  const mentionedProfiles = cast.mentionedProfiles;

  return arrayUtils.unique([author, ...mentionedProfiles], (u) => u.fid);
};
