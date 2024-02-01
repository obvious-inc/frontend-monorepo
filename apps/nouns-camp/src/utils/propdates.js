export const buildFeed = (propdates) =>
  propdates.map((p) => ({
    type: "event",
    eventType: p.markedCompleted
      ? "propdate-marked-completed"
      : "propdate-posted",
    id: `propdate-${p.id}`,
    body: p.update,
    blockNumber: p.blockNumber,
    authorAccount: p.authorAccount,
    timestamp: p.blockTimestamp,
    proposalId: p.proposalId,
  }));
