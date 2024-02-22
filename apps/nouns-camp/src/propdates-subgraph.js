const subgraphUrl = process.env.NEXT_PUBLIC_PROPDATES_SUBGRAPH_URL;

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

const createPropdatesQuery = ({ startBlock, endBlock }) => `
${PROPDATE_FIELDS}
query {
  propUpdates(where: {blockNumber_gte: ${startBlock}, blockNumber_lte: ${endBlock}}, orderBy: blockNumber, orderDirection: desc, first: 1000) {
    ...PropdateFields
  }
}`;

const createPropdatesForProposalQuery = (proposalId) => `
${PROPDATE_FIELDS}
query {
  propUpdates(where: { prop: "${proposalId}" }, orderBy: blockNumber, orderDirection: desc, first: 1000) {
    ...PropdateFields
  }
}`;

const createPropdatesByAccountQuery = (id) => `
${PROPDATE_FIELDS}
query {
  propUpdates(where: { admin: "${id}" }, orderBy: blockNumber, orderDirection: desc, first: 100) {
    ...PropdateFields
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

export const fetchPropdates = async (chainId, ...args) => {
  return [];
  // eslint-disable-next-line no-unreachable
  if (chainId !== 1) return [];
  return fetch(subgraphUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: createPropdatesQuery(...args),
    }),
  })
    .then((res) => {
      if (res.ok) return res.json();
      return Promise.reject(new Error(res.statusText));
    })
    .then((body) => {
      if (body.data.propUpdates == null) throw new Error("not-found");
      return body.data.propUpdates.map(parseUpdate);
    });
};

export const fetchPropdatesForProposal = async (chainId, ...args) => {
  return [];
  // eslint-disable-next-line no-unreachable
  if (chainId !== 1) return [];
  return fetch(subgraphUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: createPropdatesForProposalQuery(...args),
    }),
  })
    .then((res) => {
      if (res.ok) return res.json();
      return Promise.reject(new Error(res.statusText));
    })
    .then((body) => {
      if (body.data.propUpdates == null) throw new Error("not-found");
      return body.data.propUpdates.map(parseUpdate);
    });
};

export const fetchPropdatesByAccount = async (chainId, id) => {
  if (chainId !== 1) return [];
  return fetch(subgraphUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: createPropdatesByAccountQuery(id.toLowerCase()),
    }),
  })
    .then((res) => {
      if (res.ok) return res.json();
      return Promise.reject(new Error(res.statusText));
    })
    .then((body) => {
      if (body.data.propUpdates == null) throw new Error("not-found");
      return body.data.propUpdates.map(parseUpdate);
    });
};
