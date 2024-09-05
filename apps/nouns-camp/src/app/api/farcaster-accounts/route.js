// import { kv } from "@vercel/kv";
// import { isAddress } from "viem";
// import { fetchAccountsWithVerifiedAddress } from "../farcaster-utils.js";

export const runtime = "edge";

// Returns Farcaster accounts matching a verified Ethereum account address
// eslint-disable-next-line no-unused-vars
export async function GET(request) {
  // const { searchParams } = new URL(request.url);
  // const ethAddress = searchParams.get("eth-address");

  // if (!isAddress(ethAddress))
  //   return Response.json({ error: "invalid-eth-address" }, { status: 400 });

  // const accounts = await fetchAccountsWithVerifiedAddress(ethAddress);
  //
  // const accountsWithKeyData = await Promise.all(
  //   accounts.map(async (account) => {
  //     // `exists` returns the number of existing keys
  //     const hasAccountKey =
  //       (await kv.exists(`fid:${account.fid}:account-key`)) > 0;
  //     return { ...account, hasAccountKey };
  //   }),
  // );

  const hasAccountKey = null // accountsWithKeyData.some((a) => a.hasAccountKey);

  // Don’t cache if no account key exists, 24 hours otherwise
  const cacheTime = hasAccountKey ? 24 * 60 * 60 : 0;

  return Response.json(
    { accounts: [] /*accountsWithKeyData*/ },
    {
      headers: {
        "Cache-Control": `public, immutable, max-age=${cacheTime}`,
      },
    },
  );
}
