import { kv } from "@vercel/kv";
import { verifyMessage, isAddress } from "viem";
import { subgraphFetch } from "../../../nouns-subgraph.js";
import { CHAIN_ID } from "../../../constants/env.js";
import {
  parseEpochTimestamp,
  buildCandidateCastSignatureMessage,
} from "../../../utils/farcaster.js";
import { createUri as createTransactionReceiptUri } from "../../../utils/erc-2400.js";
import {
  submitCastAdd,
  fetchCastsByParentUrl,
  verifyEthAddress,
} from "../farcaster-utils.js";

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

const jsonResponse = (statusCode, body, headers) =>
  new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "Content-Type": "application/json", ...headers },
  });

const fetchCandidateCasts = async (candidateId) => {
  const url = await createCanonicalCandidateUrl(candidateId);
  const { accounts, casts } = await fetchCastsByParentUrl(url);
  return { accounts, casts: casts.map((c) => ({ ...c, candidateId })) };
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const candidateId = searchParams.get("candidate");

  if (candidateId == null)
    return jsonResponse(400, { error: "candidate-required" });

  const { casts, accounts } = await fetchCandidateCasts(candidateId);

  return jsonResponse(
    200,
    { casts, accounts },
    { "Cache-Control": "max-age=10, stale-while-revalidate=20" },
  );
}

export async function POST(request) {
  const { candidateId, text, fid, timestamp, ethAddress, ethSignature } =
    await request.json();

  if (candidateId == null)
    return jsonResponse(400, { error: "candidate-required" });
  if (fid == null) return jsonResponse(400, { error: "fid-required" });
  if (timestamp == null)
    return jsonResponse(400, { error: "timestamp-required" });
  if (!isAddress(ethAddress))
    return jsonResponse(400, { error: "eth-address-required" });
  if (ethSignature == null)
    return jsonResponse(400, { error: "eth-signature-required" });

  // Allow up to 10 minute old signatures
  if (new Date() + 10 * 60 * 1000 > new Date(timestamp))
    return jsonResponse(400, { error: "signature-expired" });

  const isValidSignature = await verifyMessage({
    address: ethAddress,
    message: buildCandidateCastSignatureMessage({
      text,
      candidateId,
      chainId: CHAIN_ID,
      timestamp,
    }),
    signature: ethSignature,
  });

  if (!isValidSignature)
    return jsonResponse(401, { error: "invalid-signature" });

  const isVerifiedEthAddress = await verifyEthAddress(fid, ethAddress);

  if (!isVerifiedEthAddress)
    return jsonResponse(401, { error: "invalid-address" });

  const privateAccountKey = await kv.get(`fid:${fid}:account-key`);

  if (privateAccountKey == null)
    return jsonResponse(401, { error: "no-account-key-for-eth-address" });

  try {
    const castMessage = await submitCastAdd(fid, privateAccountKey, {
      text,
      parentUrl: await createCanonicalCandidateUrl(candidateId),
    });
    return jsonResponse(201, {
      hash: castMessage.hash,
      fid: castMessage.data.fid,
      timestamp: parseEpochTimestamp(castMessage.data.timestamp).toISOString(),
      text: castMessage.data.castAddBody.text,
    });
  } catch (e) {
    return jsonResponse(500, { error: "submit-failed" });
  }
}
