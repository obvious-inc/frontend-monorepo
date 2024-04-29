import { kv } from "@vercel/kv";
import { isAddress } from "viem";
import { array as arrayUtils } from "@shades/common/utils";
import { parseNeynarUsers } from "../utils.js";

const fetchAccountsWithVerifiedAddress = async (
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

// Returns Farcaster accounts matching a verified Ethereum account address
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ethAddress = searchParams.get("eth-address");
  const chainId = searchParams.get("chain");

  if (!isAddress(ethAddress))
    return new Response(JSON.stringify({ error: "invalid-eth-address" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });

  if (chainId == null)
    return new Response(JSON.stringify({ error: "chain-required" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });

  const accounts = await fetchAccountsWithVerifiedAddress(ethAddress, {
    chainId,
  });

  const accountsWithKeyData = await Promise.all(
    accounts.map(async (account) => {
      // `exists` returns the number of existing keys
      const hasAccountKey =
        (await kv.exists(`fid:${account.fid}:account-key`)) > 0;
      return { ...account, hasAccountKey };
    }),
  );

  return new Response(JSON.stringify({ accounts: accountsWithKeyData }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
