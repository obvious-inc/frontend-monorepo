import React from "react";
import { parseString } from "../utils/message";
import { array as arrayUtils } from "@shades/common/utils";

const NEYNAR_V1_ENDPOINT = "https://api.neynar.com/v1/farcaster";
const NEYNAR_V2_ENDPOINT = "https://api.neynar.com/v2/farcaster";

const NEYNAR_API_KEY = import.meta.env.PUBLIC_NEYNAR_API_KEY;

const DEFAULT_PAGE_SIZE = 75;

export async function fetchNeynarFeedCasts({
  parentUrl,
  fid,
  cursor,
  limit = DEFAULT_PAGE_SIZE,
}) {
  if (!parentUrl && !fid) return [];

  let params = new URLSearchParams({
    api_key: NEYNAR_API_KEY,
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
    api_key: NEYNAR_API_KEY,
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
    api_key: NEYNAR_API_KEY,
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
    api_key: NEYNAR_API_KEY,
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
    api_key: NEYNAR_API_KEY,
    fid: Number(fid),
  });

  return fetch(NEYNAR_V1_ENDPOINT + "/user?" + params)
    .then((result) => {
      return result.json();
    })
    .then((jsonResult) => {
      if (!jsonResult.result?.user) {
        console.warn("user not found", fid);
        return null;
      }
      return parseUser({ user: jsonResult.result.user });
    })
    .catch((err) => {
      throw err;
    });
};

export const fetchUserByUsername = async (username) => {
  const params = new URLSearchParams({
    api_key: NEYNAR_API_KEY,
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

export async function fetchNotifications({
  fid,
  cursor,
  limit = 50, //limit for notificatons is different
}) {
  let params = new URLSearchParams({
    api_key: NEYNAR_API_KEY,
    fid,
    cursor,
    limit,
  });

  return fetch(NEYNAR_V2_ENDPOINT + "/notifications?" + params)
    .then((result) => {
      return result.json();
    })
    .then((data) => {
      return data.notifications;
    })
    .then((notifications) => {
      return notifications
        ?.map((notification) => {
          return parseNotification({ notification });
        })
        .filter((n) => n);
    })
    .catch((err) => {
      throw err;
    });
}

export async function searchUsersByUsername({ fid, query }) {
  let params = new URLSearchParams({
    api_key: NEYNAR_API_KEY,
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
  if (!user) return null;
  const { fid, username, profile } = user;

  // todo: better understand why this would be called 2x..
  if (user.bioBlocks) return user;

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
  const { type, most_recent_timestamp: mostRecentTimestamp } = notification;

  const parsedNotification = { ...notification, type, mostRecentTimestamp };

  if (type != "follows") {
    const parsedCast = parseCast({ cast: notification.cast });
    if (parsedCast.deleted) return null;
    parsedNotification.cast = parsedCast;
  }

  if (notification.reactions) {
    // reactions include duplicate users... so we need to filter them out
    const reactors = [];
    parsedNotification.reactions = notification.reactions
      .map((r) => {
        if (reactors.includes(r.user.fid)) return null;
        reactors.push(r.user.fid);
        return { cast: r.cast, user: parseUser({ user: r.user }) };
      })
      .filter((r) => r);
  }

  parsedNotification.id = `${parsedNotification.type}-${parsedNotification.cast?.hash}`;

  if (notification.follows) {
    const timestamp = new Date(
      parsedNotification.mostRecentTimestamp
    ).getTime();
    parsedNotification.id = `${parsedNotification.type}-${timestamp}`;
    parsedNotification.follows = notification.follows.map((f) => {
      return { user: parseUser({ user: f.user }) };
    });
  }

  return parsedNotification;
};

export const extractUsersFromNeynarCast = (cast) => {
  if (!cast) return [];

  const author = parseUser({ user: cast.author });
  const mentionedProfiles = cast.mentionedProfiles || cast.mentioned_profiles;
  const mentionedUsers = mentionedProfiles.map((p) => parseUser({ user: p }));

  return arrayUtils.unique([author, ...mentionedUsers], (u) => u.fid);
};
