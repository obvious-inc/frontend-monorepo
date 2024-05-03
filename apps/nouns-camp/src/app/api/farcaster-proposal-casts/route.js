import { kv } from "@vercel/kv";
import { verifyMessage, isAddress } from "viem";
import { subgraphFetch } from "../../../nouns-subgraph.js";
import {
  parseEpochTimestamp,
  buildProposalCastSignatureMessage,
} from "../../../utils/farcaster.js";
import { createUri as createTransactionReceiptUri } from "../../../utils/erc-2400.js";
import {
  fetchCastsByParentUrl,
  submitCastAdd,
  verifyEthAddress,
} from "../farcaster-utils.js";

const createCanonicalProposalUrl = async (chainId, proposalId) => {
  const { proposal } = await subgraphFetch({
    chainId,
    query: `
      query {
        proposal(id: ${proposalId}) {
          createdTransactionHash
        }
      }`,
  });

  if (proposal == null) throw new Error();

  return createTransactionReceiptUri(chainId, proposal.createdTransactionHash);
};

const jsonResponse = (statusCode, body, headers) =>
  new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "Content-Type": "application/json", ...headers },
  });

const fetchProposalCasts = async (chainId, proposalId) => {
  const url = await createCanonicalProposalUrl(chainId, proposalId);
  const { accounts, casts } = await fetchCastsByParentUrl(chainId, url);
  return { accounts, casts: casts.map((c) => ({ ...c, proposalId })) };
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const chainId = searchParams.get("chain");
  const proposalId = searchParams.get("proposal");

  if (chainId == null) return jsonResponse(400, { error: "chain-required" });
  if (proposalId == null)
    return jsonResponse(400, { error: "proposal-required" });

  const { casts, accounts } = await fetchProposalCasts(chainId, proposalId);

  return jsonResponse(
    200,
    { casts, accounts },
    { "Cache-Control": "max-age=10, stale-while-revalidate=20" },
  );
}

export async function POST(request) {
  const {
    chainId,
    proposalId,
    text,
    fid,
    timestamp,
    ethAddress,
    ethSignature,
  } = await request.json();

  if (chainId == null) return jsonResponse(400, { error: "chain-required" });
  if (proposalId == null)
    return jsonResponse(400, { error: "proposal-required" });
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
    message: buildProposalCastSignatureMessage({
      text,
      proposalId,
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
      parentUrl: await createCanonicalProposalUrl(chainId, proposalId),
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
