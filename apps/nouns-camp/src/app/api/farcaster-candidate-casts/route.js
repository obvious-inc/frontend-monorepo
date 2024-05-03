import { kv } from "@vercel/kv";
import { verifyMessage, isAddress } from "viem";
import { subgraphFetch } from "../../../nouns-subgraph.js";
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

const createCanonicalCandidateUrl = async (chainId, candidateId) => {
  const { proposalCandidate } = await subgraphFetch({
    chainId,
    query: `
      query {
        proposalCandidate(id: ${JSON.stringify(candidateId)}) {
          createdTransactionHash
        }
      }`,
  });

  if (proposalCandidate == null) throw new Error();

  return createTransactionReceiptUri(
    chainId,
    proposalCandidate.createdTransactionHash,
  );
};

const jsonResponse = (statusCode, body, headers) =>
  new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "Content-Type": "application/json", ...headers },
  });

const fetchCandidateCasts = async (chainId, candidateId) => {
  const url = await createCanonicalCandidateUrl(chainId, candidateId);
  return fetchCastsByParentUrl(chainId, url);
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const chainId = searchParams.get("chain");
  const candidateId = searchParams.get("candidate");

  if (chainId == null) return jsonResponse(400, { error: "chain-required" });
  if (candidateId == null)
    return jsonResponse(400, { error: "candidate-required" });

  const { casts, accounts } = await fetchCandidateCasts(chainId, candidateId);

  return jsonResponse(
    200,
    { casts, accounts },
    { "Cache-Control": "max-age=10, stale-while-revalidate=20" },
  );
}

export async function POST(request) {
  const {
    chainId,
    candidateId,
    text,
    fid,
    timestamp,
    ethAddress,
    ethSignature,
  } = await request.json();

  if (chainId == null) return jsonResponse(400, { error: "chain-required" });
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
      chainId,
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
      parentUrl: await createCanonicalCandidateUrl(chainId, candidateId),
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
