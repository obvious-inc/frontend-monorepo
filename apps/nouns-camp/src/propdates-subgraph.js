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

const PROPDATES_QUERY = `
${PROPDATE_FIELDS}
query {
  propUpdates(orderBy: blockNumber, orderDirection: desc, first: 100) {
    ...PropdateFields
  }
}`;

const createPropdatesQuery = (proposalId) => `
${PROPDATE_FIELDS}
query {
  propUpdates(where: { prop: "${proposalId}" }, orderBy: blockNumber, orderDirection: desc, first: 100) {
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

export const fetchPropdates = (proposalId) =>
  fetch(process.env.PROPDATES_SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query:
        proposalId == null ? PROPDATES_QUERY : createPropdatesQuery(proposalId),
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

export const fetchPropdatesByAccount = (id) =>
  fetch(process.env.PROPDATES_SUBGRAPH_URL, {
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
