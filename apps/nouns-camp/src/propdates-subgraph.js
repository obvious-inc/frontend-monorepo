import { CHAIN_ID } from "./constants/env.js";

const PROPDATE_FIELDS = `
  fragment PropdateFields on PropUpdate {
    id
    update
    isCompleted
    admin
    blockNumber
    blockTimestamp
    prop {
      id
    }
  }`;

const parseUpdate = (u) => ({
  id: u.id,
  update: u.update.trim() === "" ? null : u.update.trim(),
  markedCompleted: u.isCompleted,
  blockNumber: BigInt(u.blockNumber),
  blockTimestamp: new Date(parseInt(u.blockTimestamp) * 1000),
  authorAccount: u.admin,
  proposalId: u.prop.id,
});

const subgraphUrl =
  typeof window === "undefined"
    ? process.env.PROPDATES_SUBGRAPH_URL
    : "/subgraphs/propdates";

const subgraphFetch = async (query) => {
  const response = await fetch(subgraphUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (response.ok) return response.json();
  return Promise.reject(new Error(response.statusText));
};

export const fetchPropdates = async ({ startBlock, endBlock }) => {
  return [];
  // eslint-disable-next-line no-unreachable
  if (CHAIN_ID !== 1) return [];
  const body = await subgraphFetch(`
    ${PROPDATE_FIELDS}
    query {
      propUpdates(
        where: {
          blockNumber_gte: ${startBlock},
          blockNumber_lte: ${endBlock}
        },
        orderBy: blockNumber,
        orderDirection: desc,
        first: 1000
      ) {
        ...PropdateFields
      }
    }`);
  if (body.data.propUpdates == null) throw new Error("not-found");
  return body.data.propUpdates.map(parseUpdate);
};

export const fetchPropdatesForProposal = async (proposalId) => {
  return [];
  // eslint-disable-next-line no-unreachable
  if (CHAIN_ID !== 1) return [];
  const body = await subgraphFetch(`
    ${PROPDATE_FIELDS}
    query {
      propUpdates(
        where: { prop: "${proposalId}" },
        orderBy: blockNumber,
        orderDirection: desc,
        first: 1000
      ) {
        ...PropdateFields
      }
    }`);
  if (body.data?.propUpdates == null) throw new Error("not-found");
  return body.data.propUpdates.map(parseUpdate);
};

export const fetchPropdatesByAccount = async (id) => {
  if (CHAIN_ID !== 1) return [];
  const body = await subgraphFetch(`
    ${PROPDATE_FIELDS}
    query {
      propUpdates(
        where: { admin: "${id.toLowerCase()}" },
        orderBy: blockNumber,
        orderDirection: desc,
        first: 1000
      ) {
        ...PropdateFields
      }
    }`);
  if (body.data?.propUpdates == null) throw new Error("not-found");
  return body.data.propUpdates.map(parseUpdate);
};
