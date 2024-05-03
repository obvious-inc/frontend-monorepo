import { array as arrayUtils } from "@shades/common/utils";
import { subgraphFetch } from "../../../nouns-subgraph.js";
import { createUri as createTransactionReceiptUri } from "../../../utils/erc-2400.js";
import { fetchCastsByParentUrl } from "../farcaster-utils.js";

const DAY_THRESHOLD = 14;
const CAST_LIMIT_PER_PROP = 20;

const fetchRecentCasts = async (chainId) => {
  const threshold = Math.floor(
    (new Date() - 1000 * 60 * 60 * 24 * DAY_THRESHOLD) / 1000,
  );
  const { proposals, proposalCandidates } = await subgraphFetch({
    chainId,
    query: `
    query {
      proposals(where: {createdTimestamp_gt: "${threshold}"}) {
        id
        createdTransactionHash
      }
      proposalCandidates(where: {canceled: false, lastUpdatedTimestamp_gt: "${threshold}"}) {
        id
        createdTransactionHash
      }
    }`,
  });

  const casts = [];
  const accounts = [];

  // Waterfall requests to play nicely with Neynar and Goldsky

  for (const proposal of proposals) {
    const { casts: proposalCasts, accounts: authorAccounts } =
      await fetchCastsByParentUrl(
        chainId,
        createTransactionReceiptUri(chainId, proposal.createdTransactionHash),
        { limit: CAST_LIMIT_PER_PROP },
      );
    casts.push(
      ...proposalCasts.map((c) => ({ ...c, proposalId: proposal.id })),
    );
    accounts.push(...authorAccounts);
  }

  for (const candidate of proposalCandidates) {
    const { casts: candidateCasts, accounts: authorAccounts } =
      await fetchCastsByParentUrl(
        chainId,
        createTransactionReceiptUri(chainId, candidate.createdTransactionHash),
        { limit: CAST_LIMIT_PER_PROP },
      );
    casts.push(
      ...candidateCasts.map((c) => ({ ...c, candidateId: candidate.id })),
    );
    accounts.push(...authorAccounts);
  }

  return {
    casts,
    accounts: arrayUtils.unique((a1, a2) => a1.fid === a2.fid, accounts),
  };
};

const jsonResponse = (statusCode, body, headers) =>
  new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "Content-Type": "application/json", ...headers },
  });

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const chainId = searchParams.get("chain");

  if (chainId == null) return jsonResponse(400, { error: "chain-required" });

  const { casts, accounts } = await fetchRecentCasts(chainId);

  return jsonResponse(
    200,
    { casts, accounts },
    { "Cache-Control": "max-age=300, stale-while-revalidate=600" },
  );
}
