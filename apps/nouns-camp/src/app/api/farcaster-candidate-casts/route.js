import { isLoggedIn, isLoggedInAccountFid } from "@/app/api/auth-utils";
import { subgraphFetch } from "../../../nouns-subgraph.js";
import { CHAIN_ID, APP_PRODUCTION_URL } from "../../../constants/env.js";
import { makeUrlId as makeCandidateUrlId } from "../../../utils/candidates.js";
import { parseEpochTimestamp } from "../../../utils/farcaster.js";
import { createUri as createTransactionReceiptUri } from "../../../utils/erc-2400.js";
import {
  submitCastAdd,
  fetchCastsByParentUrl,
  fetchAccount,
} from "../farcaster-utils.js";
import {
  getAccountKeyForFid,
  deleteAccountKeyForFid,
} from "../farcaster-account-key-utils.js";

const createCanonicalCandidateUrl = async (candidateId) => {
  const { proposalCandidate } = await subgraphFetch({
    query: `
      query {
        proposalCandidate(id: ${JSON.stringify(candidateId)}) {
          createdTransactionHash
        }
      }`,
  });

  if (proposalCandidate == null) throw new Error();

  return createTransactionReceiptUri(
    CHAIN_ID,
    proposalCandidate.createdTransactionHash,
  );
};

const fetchCandidateCasts = async (candidateId) => {
  const url = await createCanonicalCandidateUrl(candidateId);
  const { accounts, casts } = await fetchCastsByParentUrl(url);
  return { accounts, casts: casts.map((c) => ({ ...c, candidateId })) };
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const candidateId = searchParams.get("candidate");

  if (candidateId == null)
    return Response.json({ error: "candidate-required" }, { status: 400 });

  const { casts, accounts } = await fetchCandidateCasts(candidateId);

  return Response.json(
    { casts, accounts },
    {
      headers: {
        "Cache-Control": "max-age=10, s-maxage=10, stale-while-revalidate=20",
      },
    },
  );
}

export async function POST(request) {
  const { candidateId, text, fid } = await request.json();

  if (!(await isLoggedIn()))
    return Response.json({ error: "not-logged-in" }, { status: 401 });

  if (!(await isLoggedInAccountFid(fid)))
    return Response.json({ error: "address-not-verified" }, { status: 401 });

  const privateAccountKey = await getAccountKeyForFid(fid);

  if (privateAccountKey == null)
    return Response.json({ error: "no-account-key" }, { status: 401 });

  if (candidateId == null)
    return Response.json({ error: "candidate-required" }, { status: 400 });
  if (text == null)
    return Response.json({ error: "text-required" }, { status: 400 });

  try {
    const account = await fetchAccount(fid);
    const castMessage = await submitCastAdd(
      { fid, privateAccountKey },
      {
        text,
        parentUrl: await createCanonicalCandidateUrl(candidateId),
        embeds: [
          {
            url: `${APP_PRODUCTION_URL}/candidates/${encodeURIComponent(makeCandidateUrlId(candidateId))}`,
          },
        ],
      },
    );
    return Response.json(
      {
        hash: castMessage.hash,
        fid: castMessage.data.fid,
        timestamp: parseEpochTimestamp(
          castMessage.data.timestamp,
        ).toISOString(),
        text: castMessage.data.castAddBody.text,
        account,
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
