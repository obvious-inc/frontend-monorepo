import { kv } from "@vercel/kv";
import { isAddress } from "viem";
import { fetchAccountsWithVerifiedAddress } from "../farcaster-utils.js";

// Returns Farcaster accounts matching a verified Ethereum account address
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ethAddress = searchParams.get("eth-address");

  if (!isAddress(ethAddress))
    return new Response(JSON.stringify({ error: "invalid-eth-address" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    });

  const accounts = await fetchAccountsWithVerifiedAddress(ethAddress);

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
