import { CHAIN_ID } from "@/constants/env";

const VOTE_FIELDS = `
  fragment VoteFields on Vote {
    id
    voter
    votesCount
    tokenId
    blockNumber
    blockTimestamp
    tokenId
    transactionHash
    recipientId
    recipient {
      id
      title
      tagline
      isFlow
    }
  }`;

const parseTimestamp = (unixSeconds) => new Date(parseInt(unixSeconds) * 1000);

const parseVote = (v) => ({
  ...v,
  id: v.id,
  blockNumber: BigInt(v.blockNumber),
  blockTimestamp: parseTimestamp(v.blockTimestamp),
});

const subgraphUrl =
  typeof window === "undefined"
    ? process.env.FLOW_SUBGRAPH_URL
    : "/subgraphs/flows";

const subgraphFetch = async (query) => {
  const response = await fetch(subgraphUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (response.ok) return response.json();

  // the flows graph is a bit fragile. return nothing instead of
  // throwing errors, to avoid activity feed not showing up at all.
  return { data: null };
};

export const fetchFlowVotes = async (startTimestamp, endTimestamp) => {
  if (CHAIN_ID !== 1) return [];

  // For now we ignore votes on specific projects, just top level flows
  const recipientsBody = await subgraphFetch(`
    query {
      grants(
        limit: 1000
        where: { isFlow: true }
      ) {
        items {
          id
        }
      }
    }`);

  if (recipientsBody.data?.grants == null) return [];

  const recipientIds = recipientsBody.data.grants.items.map((g) => g.id);

  const body = await subgraphFetch(`
    ${VOTE_FIELDS}
    query {
      votes(
        orderBy: "blockNumber",
        orderDirection: "desc",
        limit: 1000
        where: {
          recipientId_in: [${recipientIds.map((id) => `"${id}"`)}],
          blockTimestamp_gte: ${startTimestamp.getTime() / 1000},
          blockTimestamp_lte: ${endTimestamp.getTime() / 1000}
        }
      ) {
        items {
          ...VoteFields
        }
      }
    }`);

  if (body.data?.votes == null) return [];

  return body.data.votes.items.filter((v) => v.recipient.isFlow).map(parseVote);
};
