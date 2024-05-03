import { hexToBytes } from "viem";
import {
  FarcasterNetwork,
  Message,
  makeCastAdd,
  NobleEd25519Signer,
} from "@farcaster/core";
import { array as arrayUtils } from "@shades/common/utils";
import { subgraphFetch } from "../../nouns-subgraph.js";

export const submitCastAdd = async (fid, privateAccountKey, body) => {
  const messageResult = await makeCastAdd(
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
        throw new Error();
      }

      return body;
    },
    (error) => Promise.reject(error),
  );
};

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

const parseNeynarUsers = async ({ chainId }, users) => {
  const verifiedAddresses = arrayUtils.unique(
    users.flatMap((u) => u.verifications.map((v) => v.toLowerCase())),
  );

  const { delegates } = await subgraphFetch({
    chainId,
    query: `
      query {
        delegates(where: { id_in: [${verifiedAddresses.map((a) => `"${a}"`)}] }) {
          id
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

    if (delegate != null) account.nounerAddress = delegate.id;

    return account;
  });
};

export const fetchAccountsWithVerifiedAddress = async (
  address,
  { chainId = 1 } = {},
) => {
  const searchParams = new URLSearchParams({
    addresses: address,
    address_types: "verified_addresss",
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
    console.error(body);
    return null;
  }

  const neynarUsers = body[address] ?? [];

  if (neynarUsers.length === 0) return 0;

  const sortedUsers = arrayUtils.sortBy(
    { value: (u) => u.follower_count, order: "desc" },
    neynarUsers,
  );

  return parseNeynarUsers({ chainId }, sortedUsers);
};

export const fetchCastsByParentUrl = async (chainId, parentUrl) => {
  const searchParams = new URLSearchParams({
    feed_type: "filter",
    filter_type: "parent_url",
    parent_url: parentUrl,
    limit: 100,
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
    { chainId },
    arrayUtils.unique(
      (u1, u2) => u1.fid === u2.fid,
      rawCasts.map((c) => c.author),
    ),
  );

  return { casts, accounts };
};
