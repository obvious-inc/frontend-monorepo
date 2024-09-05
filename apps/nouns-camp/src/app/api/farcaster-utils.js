import { kv } from "@vercel/kv";
import { hexToBytes } from "viem";
import {
  FarcasterNetwork,
  Message,
  makeCastAdd,
  makeCastRemove,
  makeReactionAdd,
  makeReactionRemove,
  NobleEd25519Signer,
} from "@farcaster/core";
import { array as arrayUtils } from "@shades/common/utils";
import { subgraphFetch } from "../../nouns-subgraph.js";

const fetchAccounts = async (fids) => {
  if (fids.length === 0) return [];

  const response = await fetch(
    `https://api.neynar.com/v2/farcaster/user/bulk?${new URLSearchParams({ fids: fids.join(",") })}`,
    {
      headers: {
        accept: "application/json",
        api_key: process.env.NEYNAR_API_KEY,
      },
    },
  );

  if (!response.ok) {
    console.error(await response.text());
    throw new Error();
  }

  const { users } = await response.json();
  return parseNeynarUsers(users);
};

export const getAccountKey = (fid) => kv.get(`fid:${fid}:account-key`);

export const deleteAccountKey = (fid) => kv.del(`fid:${fid}:account-key`);

export const fetchAccount = async (fid) => {
  const [account] = await fetchAccounts([fid]);
  return account;
};

export const fetchNounerLikesByTargetUrl = async (targetUrl) => {
  const searchParams = new URLSearchParams({ url: targetUrl });
  const response = await fetch(
    `${process.env.FARCASTER_HUB_HTTP_ENDPOINT}/v1/reactionsByTarget?${searchParams}`,
    {
      method: "GET",
      headers: {
        api_key: process.env.NEYNAR_API_KEY,
      },
    },
  );

  if (!response.ok) {
    console.error(await response.text());
    throw new Error();
  }

  const { messages } = await response.json();

  const likes = messages
    .filter((m) => m.data.type === "MESSAGE_TYPE_REACTION_ADD")
    .map((m) => ({ fid: m.data.fid }));

  const accounts = await fetchAccounts(likes.map((l) => l.fid));
  const accountsByFid = arrayUtils.indexBy((a) => a.fid, accounts);

  const nounerLikes = likes.reduce((acc, l) => {
    const account = accountsByFid[l.fid];
    if (account.nounerAddress == null) return acc;
    acc.push(account);
    return acc;
  }, []);

  // Only count one Farcaster account per nouner ethereum address
  return arrayUtils.unique(
    (a1, a2) => a1.nounerAddress === a2.nounerAddress,
    nounerLikes,
  );
};

export const fetchNounerLikesByCast = async (hash) => {
  const response = await fetch(
    `https://api.neynar.com/v2/farcaster/reactions/cast?${new URLSearchParams({
      hash,
      types: "likes",
      limit: 100,
    })}`,
    {
      headers: {
        accept: "application/json",
        api_key: process.env.NEYNAR_API_KEY,
      },
    },
  );

  if (!response.ok) {
    console.error(await response.text());
    throw new Error();
  }

  const { reactions } = await response.json();

  const likes = reactions.map((r) => ({ fid: r.user.fid }));

  const accounts = await fetchAccounts(likes.map((l) => l.fid));
  const accountsByFid = arrayUtils.indexBy((a) => a.fid, accounts);

  const nounerLikes = likes.reduce((acc, l) => {
    const account = accountsByFid[l.fid];
    if (account.nounerAddress == null) return acc;
    acc.push(account);
    return acc;
  }, []);

  // Only count one Farcaster account per nouner ethereum address
  return arrayUtils.unique(
    (a1, a2) => a1.nounerAddress === a2.nounerAddress,
    nounerLikes,
  );
};

const submitMessage = async (
  buildMessage,
  { fid, privateAccountKey },
  body,
) => {
  const messageResult = await buildMessage(
    body,
    { fid: Number(fid), network: FarcasterNetwork.MAINNET },
    new NobleEd25519Signer(hexToBytes(privateAccountKey)),
  );
  return messageResult.match(
    async (message) => {
      const response = await fetch(
        `${process.env.FARCASTER_HUB_HTTP_ENDPOINT}/v1/submitMessage`,
        {
          method: "POST",
          body: Buffer.from(Message.encode(message).finish()),
          headers: {
            api_key: process.env.NEYNAR_API_KEY,
            "Content-Type": "application/octet-stream",
          },
        },
      );

      const body = await response.json();

      if (!response.ok) {
        console.error(body);
        if (
          body.errCode === "bad_request.validation_failure" &&
          body.details.startsWith("invalid signer")
        )
          throw new Error("invalid-account-key");
        throw new Error();
      }

      return body;
    },
    (error) => Promise.reject(error),
  );
};

export const submitCastAdd = async (data, body) =>
  submitMessage(makeCastAdd, data, body);

export const submitCastRemove = async (data, { targetHash }) =>
  submitMessage(makeCastRemove, data, { targetHash });

export const submitReactionAdd = async (
  data,
  {
    type, // 1 = like, 2 = recast
    targetCastId,
    targetUrl,
  },
) => submitMessage(makeReactionAdd, data, { type, targetCastId, targetUrl });

export const submitReactionRemove = async (
  data,
  {
    type, // 1 = like, 2 = recast
    targetCastId,
    targetUrl,
  },
) => submitMessage(makeReactionRemove, data, { type, targetCastId, targetUrl });

const fetchVerificiation = async (fid, address) => {
  const searchParams = new URLSearchParams({ fid, address });
  const response = await fetch(
    `${process.env.FARCASTER_HUB_HTTP_ENDPOINT}/v1/verificationsByFid?${searchParams}`,
    {
      headers: {
        api_key: process.env.NEYNAR_API_KEY,
      },
    },
  );

  const body = await response.json();

  if (!response.ok) {
    if (body.errCode === "not_found") return null;
    console.error(body);
    throw new Error();
  }

  return body;
};

export const verifyEthAddress = async (fid, address) => {
  const verification = await fetchVerificiation(fid, address);
  // TODO: verify the verification
  return verification != null;
};

const parseNeynarUsers = async (users) => {
  const verifiedAddresses = arrayUtils.unique(
    users.flatMap((u) => u.verifications.map((v) => v.toLowerCase())),
  );

  const { delegates } = await subgraphFetch({
    query: `
      query {
        delegates(where: { id_in: [${verifiedAddresses.map((a) => `"${a}"`)}] }) {
          id
          delegatedVotes
        }
      }`,
  });

  return users.map((user) => {
    const account = {
      fid: user.fid,
      username: user.username === `!${user.fid}` ? null : user.username,
      displayName: user["display_name"],
      pfpUrl: user["pfp_url"],
    };

    const verifiedAddresses = user.verifications.map((a) => a.toLowerCase());

    const delegate = delegates.find((d) => verifiedAddresses.includes(d.id));

    if (delegate != null) {
      account.nounerAddress = delegate.id;
      account.votingPower = Number(delegate.delegatedVotes);
    }

    return account;
  });
};

export const fetchAccountsWithVerifiedAddress = async (address) => {
  const searchParams = new URLSearchParams({
    addresses: address,
    address_types: "verified_address",
  });

  const response = await fetch(
    `https://api.neynar.com/v2/farcaster/user/bulk-by-address?${searchParams}`,
    {
      headers: {
        accept: "application/json",
        api_key: process.env.NEYNAR_API_KEY,
      },
    },
  );

  const body = await response.json();

  if (!response.ok) {
    if (body.code === "NotFound") return [];
    console.error(`Error fetching farcaster accounts for "${address}"`, body);
    return Promise.reject(new Error("unexpected-response"));
  }

  // Neynar sometimes return duplicate users
  const neynarUsers = arrayUtils.unique(
    (u1, u2) => u1.fid === u2.fid,
    body[address] ?? [],
  );

  if (neynarUsers.length === 0) return [];

  const sortedUsers = arrayUtils.sortBy(
    { value: (u) => u.follower_count, order: "desc" },
    neynarUsers,
  );

  return parseNeynarUsers(sortedUsers);
};

export const fetchCastsByParentUrl = async (
  parentUrl,
  { limit = 100 } = {},
) => {
  const searchParams = new URLSearchParams({
    feed_type: "filter",
    filter_type: "parent_url",
    parent_url: parentUrl,
    limit,
  });

  const response = await fetch(
    `https://api.neynar.com/v2/farcaster/feed?${searchParams}`,
    {
      headers: {
        accept: "application/json",
        api_key: process.env.NEYNAR_API_KEY,
      },
    },
  );

  if (!response.ok) {
    console.error(await response.text());
    throw new Error();
  }

  const { casts: rawCasts } = await response.json();

  // TODO: Recursively fetch all casts
  // TODO: Somehow include replies (and reactions/replies to relevant onchain stuff we display)

  const casts = rawCasts.map((c) => ({
    hash: c.hash,
    fid: c.author.fid,
    text: c.text,
    timestamp: c.timestamp,
  }));

  const accounts = await parseNeynarUsers(
    arrayUtils.unique(
      (u1, u2) => u1.fid === u2.fid,
      rawCasts.map((c) => c.author),
    ),
  );

  return { casts, accounts };
};
