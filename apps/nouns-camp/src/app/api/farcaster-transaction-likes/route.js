import { CHAIN_ID } from "@/constants/env";
import { parseEpochTimestamp } from "@/utils/farcaster";
import { createUri as createTransactionReceiptUri } from "@/utils/erc-2400";
import { isLoggedIn, isLoggedInAccountFid } from "@/app/api/auth-utils";
import {
  fetchNounerLikesByTargetUrlSql,
  submitReactionAdd,
  submitReactionRemove,
} from "@/app/api/farcaster-utils";
import {
  getAccountKeyForFid,
  deleteAccountKeyForFid,
} from "@/app/api/farcaster-account-key-utils";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get("hash");

  if (hash == null)
    return Response.json({ error: "hash-required" }, { status: 400 });

  const likes = await fetchNounerLikesByTargetUrlSql(
    createTransactionReceiptUri(CHAIN_ID, hash),
  );

  // const filteredLikes = likes.filter((l) => l.votingPower > 0);
  const filteredLikes = likes.filter((l) => l.nounerAddress != null);

  return Response.json(
    { likes: filteredLikes },
    {
      status: 200,
      headers: {
        "Cache-Control": "max-age=10, s-maxage=10, stale-while-revalidate=20",
      },
    },
  );
}

export async function POST(request) {
  const { transactionHash, fid, action } = await request.json();

  if (!(await isLoggedIn()))
    return Response.json({ error: "not-logged-in" }, { status: 401 });

  if (!(await isLoggedInAccountFid(fid)))
    return Response.json({ error: "address-not-verified" }, { status: 401 });

  const privateAccountKey = await getAccountKeyForFid(fid);

  if (privateAccountKey == null)
    return Response.json({ error: "no-account-key" }, { status: 401 });

  if (transactionHash == null)
    return Response.json(
      { error: "transaction-hash-required" },
      { status: 400 },
    );

  if (action == null)
    return Response.json({ error: "action-required" }, { status: 400 });

  try {
    const submit =
      action === "remove" ? submitReactionRemove : submitReactionAdd;

    const message = await submit(
      { fid, privateAccountKey },
      {
        type: 1,
        targetUrl: createTransactionReceiptUri(CHAIN_ID, transactionHash),
      },
    );
    return Response.json(
      {
        hash: message.hash,
        fid: message.data.fid,
        timestamp: parseEpochTimestamp(message.data.timestamp).toISOString(),
      },
      { status: 201 },
    );
  } catch (e) {
    // Delete revoked key
    if (e.message === "invalid-account-key") {
      await deleteAccountKeyForFid(fid);
      return Response.json({ error: "invalid-account-key" }, { status: 401 });
    }
    return Response.json({ error: "submit-failed" }, { status: 500 });
  }
}
