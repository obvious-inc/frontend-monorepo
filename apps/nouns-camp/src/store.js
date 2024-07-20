"use client";

import React from "react";
import {
  createStore as createZustandStore,
  useStore as useZustandStore,
} from "zustand";
import { normalize as normalizeEnsName } from "viem/ens";
import { useFetch, useLatestCallback } from "@shades/common/react";
import {
  array as arrayUtils,
  object as objectUtils,
  function as functionUtils,
} from "@shades/common/utils";
import {
  getState as getProposalState,
  isActiveState as isActiveProposalState,
} from "./utils/proposals.js";
import {
  buildAccountFeed,
  buildProposalFeed,
  buildCandidateFeed,
  buildPropdateFeedItem,
} from "./store-selectors/feeds.js";
import {
  extractSlugFromId as extractSlugFromCandidateId,
  getSponsorSignatures as getCandidateSponsorSignatures,
} from "./utils/candidates.js";
import usePublicClient from "./hooks/public-client.js";
import useBlockNumber from "./hooks/block-number.js";
import useSetting from "./hooks/setting.js";
import {
  useProposalCasts,
  useCandidateCasts,
  useRecentCasts,
} from "./hooks/farcaster.js";
import {
  parsedSubgraphFetch,
  FULL_PROPOSAL_FIELDS,
  VOTE_FIELDS,
  CANDIDATE_FEEDBACK_FIELDS,
  PROPOSAL_FEEDBACK_FIELDS,
  CANDIDATE_CONTENT_SIGNATURE_FIELDS,
  DELEGATION_EVENT_FIELDS,
  TRANSFER_EVENT_FIELDS,
} from "./nouns-subgraph.js";
import * as PropdatesSubgraph from "./propdates-subgraph.js";

const createFeedbackPostCompositeId = (post) =>
  [post.proposalId, post.candidateId, post.reason, post.support, post.voterId]
    .join("-")
    .trim()
    .toLowerCase();

const mergeProposals = (p1, p2) => {
  if (p1 == null) return p2;

  const mergedProposal = { ...p1, ...p2 };

  if (p1.feedbackPosts != null && p2.feedbackPosts != null)
    mergedProposal.feedbackPosts = arrayUtils.unique(
      (p1, p2) => {
        if (p1.id === p2.id) return true;
        if (!p1.isPending) return false;
        // Bit of a hack to clear optimistic entries without proper ids
        const [compositeId1, compositeId2] = [p1, p2].map(
          createFeedbackPostCompositeId,
        );
        return compositeId1 === compositeId2;
      },
      // p2 has to be first here to take precedence
      [...p2.feedbackPosts, ...p1.feedbackPosts],
    );

  if (p1.votes != null && p2.votes != null)
    mergedProposal.votes = arrayUtils.unique(
      (v1, v2) => {
        if (v1.id === v2.id) return true;
        if (!v1.isPending) return false;
        return v1.voterId === v2.voterId;
      },
      // p2 has to be first here to take precedence
      [...p2.votes, ...p1.votes],
    );

  return mergedProposal;
};

const mergeProposalCandidates = (p1, p2) => {
  if (p1 == null) return p2;

  const mergedCandidate = { ...p1, ...p2 };

  if (p1.feedbackPosts != null && p2.feedbackPosts != null)
    mergedCandidate.feedbackPosts = arrayUtils.unique(
      (p1, p2) => {
        if (p1.id === p2.id) return true;
        if (!p1.isPending) return false;
        // Bit of a hack to clear optimistic entries without proper ids
        const [compositeId1, compositeId2] = [p1, p2].map(
          createFeedbackPostCompositeId,
        );
        return compositeId1 === compositeId2;
      },
      // p2 has to be first here to take precedence
      [...p2.feedbackPosts, ...p1.feedbackPosts],
    );

  if (p1.versions != null && p2.versions != null)
    mergedCandidate.versions = arrayUtils.unique(
      (v1, v2) => v1.id === v2.id,
      // p2 has to be first here to take precedence
      [...p2.versions, ...p1.versions],
    );

  if (p1?.latestVersion == null || p2?.latestVersion == null)
    return mergedCandidate;

  mergedCandidate.latestVersion = { ...p1.latestVersion, ...p2.latestVersion };

  if (p2.latestVersion.content == null) return mergedCandidate;

  mergedCandidate.latestVersion.content = {
    ...p1.latestVersion.content,
    ...p2.latestVersion.content,
  };

  return mergedCandidate;
};

const mergeAccounts = (a1, a2) => {
  if (a1 == null) return a2;

  const mergedAccount = { ...a1, ...a2 };

  if (a1.events != null && a2.events != null)
    mergedAccount.events = arrayUtils.unique(
      // Delegation and transter events might have the same id (referencing the same tx)
      (e1, e2) => e1.id === e2.id && e1.type === e2.type,
      [...a2.events, ...a1.events],
    );

  return mergedAccount;
};

const mergeDelegates = (d1, d2) => {
  if (d1 == null) return d2;

  const mergedDelegate = { ...d1, ...d2 };

  // TODO: check if this can be removed
  if (d1.proposals != null && d2.proposals != null)
    mergedDelegate.proposals = arrayUtils.unique(
      (p1, p2) => p1.id === p2.id,
      [...d2.proposals, ...d1.proposals],
    );

  if (d1.votes != null && d2.votes != null)
    mergedDelegate.votes = arrayUtils.unique(
      (v1, v2) => v1.id === v2.id,
      [...d2.votes, ...d1.votes],
    );

  return mergedDelegate;
};

const mergeNouns = (n1, n2) => {
  if (n1 == null) return n2;
  const mergedNoun = { ...n1, ...n2 };
  if (n1.events != null && n2.events != null)
    mergedNoun.events = arrayUtils.unique(
      (e1, e2) => e1.id === e2.id,
      [...n2.events, ...n1.events],
    );
  return mergedNoun;
};

const mergeStoreState = (state1, state2) => {
  const getMergeFn = (key) => {
    const mergeFn = {
      accountsById: mergeAccounts,
      delegatesById: mergeDelegates,
      nounsById: mergeNouns,
      proposalsById: mergeProposals,
      proposalCandidatesById: mergeProposalCandidates,
    }[key];
    if (mergeFn == null) throw new Error(`Missing merge function for "${key}"`);
    return mergeFn;
  };

  return Object.entries(state2).reduce(
    (stateAcc, [key, value]) => ({
      ...stateAcc,
      [key]: objectUtils.merge(getMergeFn(key), stateAcc[key], value),
    }),
    state1,
  );
};

const fetchMissingProposalTimestamps = async ({ publicClient }, proposals) => {
  const mostRecentBlockNumber = await publicClient.getBlockNumber();
  const getBlockTimestamp = async (blockNumber) => {
    // const block = await publicClient.getBlock({ blockNumber });
    const response = await fetch(`/api/block-timestamps?block=${blockNumber}`);
    const { timestamp } = await response.json();
    return new Date(timestamp * 1000);
  };
  const fetchTimestamps = async (p) => {
    const [startTimestamp, endTimestamp, objectionPeriodEndTimestamp] =
      await Promise.all([
        (async () => {
          if (p.startTimestamp != null) return p.startTimestamp;
          if (p.startBlock > mostRecentBlockNumber) return null;
          return getBlockTimestamp(p.startBlock);
        })(),
        (async () => {
          if (p.endTimestamp != null) return p.endTimestamp;
          if (p.endBlock > mostRecentBlockNumber) return null;
          return getBlockTimestamp(p.endBlock);
        })(),
        (async () => {
          if (p.objectionPeriodEndTimestamp != null)
            return p.objectionPeriodEndTimestamp;
          if (
            p.objectionPeriodEndBlock == null ||
            p.objectionPeriodEndBlock > mostRecentBlockNumber
          )
            return null;
          return getBlockTimestamp(p.objectionPeriodEndBlock);
        })(),
      ]);
    return { startTimestamp, endTimestamp, objectionPeriodEndTimestamp };
  };
  return functionUtils.waterfall(
    proposals.map((p) => async () => {
      const timestamps = await fetchTimestamps(p);
      return { id: p.id, ...timestamps };
    }),
  );
};

const createStore = ({ initialState, publicClient }) =>
  createZustandStore((set) => {
    const mergeSubgraphEntitiesIntoStore = (storeState, subgraphEntities) =>
      Object.entries(subgraphEntities).reduce((stateAcc, [key, value]) => {
        const mergeIntoStore = (state) => mergeStoreState(stateAcc, state);
        switch (key) {
          case "account":
            if (value == null) return stateAcc;
            return mergeIntoStore({
              accountsById: { [value.id]: value },
            });

          case "accounts":
            return mergeIntoStore({
              accountsById: arrayUtils.indexBy((d) => d.id, value),
            });

          case "delegate":
            if (value == null) return stateAcc;
            return mergeIntoStore({
              delegatesById: { [value.id]: value },
              proposalsById: arrayUtils.indexBy(
                (p) => p.id,
                value.proposals ?? [],
              ),
              nounsById: arrayUtils.indexBy(
                (n) => n.id,
                value.nounsRepresented ?? [],
              ),
            });

          case "delegates": {
            return mergeIntoStore({
              delegatesById: arrayUtils.indexBy((d) => d.id, value),
              proposalsById: arrayUtils.indexBy(
                (p) => p.id,
                value.flatMap((d) => d.proposals ?? []),
              ),
              nounsById: arrayUtils.indexBy(
                (n) => n.id,
                value.flatMap((d) => d.nounsRepresented ?? []),
              ),
            });
          }

          case "nouns":
            return mergeIntoStore({
              nounsById: arrayUtils.indexBy((n) => n.id, value),
            });

          case "auctions": {
            const auctionsByNounId = arrayUtils.indexBy((a) => a.id, value);
            return mergeIntoStore({
              nounsById: objectUtils.mapValues(
                (auction, nounId) => ({ id: nounId, auction }),
                auctionsByNounId,
              ),
            });
          }

          case "proposal":
            if (value == null) return stateAcc;
            return mergeIntoStore({ proposalsById: { [value.id]: value } });

          case "proposals":
            return mergeIntoStore({
              proposalsById: arrayUtils.indexBy((p) => p.id, value),
            });

          case "proposalVersions": {
            const versionsByProposalId = arrayUtils.groupBy(
              (v) => v.proposalId,
              value,
            );
            return mergeIntoStore({
              proposalsById: objectUtils.mapValues(
                (versions, id) => ({ id, versions }),
                versionsByProposalId,
              ),
            });
          }

          case "proposalCandidate": {
            if (value == null) return stateAcc;

            if (value.proposalId == null)
              return mergeIntoStore({
                proposalCandidatesById: { [value.id]: value },
              });

            return mergeIntoStore({
              proposalCandidatesById: { [value.id]: value },
              // Merge the candidate id into the matching proposal
              proposalsById: {
                [value.proposalId]: {
                  id: value.proposalId,
                  candidateId: value.id,
                },
              },
            });
          }

          case "proposalCandidates":
            return mergeIntoStore({
              proposalCandidatesById: arrayUtils.indexBy((c) => c.id, value),
              // Merge the candidate ids into matching proposals
              proposalsById: value.reduce((acc, c) => {
                if (c.proposalId == null) return acc;
                return {
                  ...acc,
                  [c.proposalId]: { id: c.proposalId, candidateId: c.id },
                };
              }, {}),
            });

          case "proposalCandidateVersions": {
            const versionsByCandidateId = arrayUtils.groupBy(
              (v) => v.candidateId,
              value,
            );
            return mergeIntoStore({
              proposalsById: value.reduce((acc, v) => {
                if (v.proposalId == null) return acc;
                return {
                  ...acc,
                  [v.proposalId]: {
                    id: v.proposalId,
                    candidateId: v.candidateId,
                  },
                };
              }, {}),
              proposalCandidatesById: objectUtils.mapValues(
                (versions, id) => ({
                  id,
                  slug: extractSlugFromCandidateId(id),
                  versions,
                }),
                versionsByCandidateId,
              ),
            });
          }

          case "votes": {
            const votesByProposalId = arrayUtils.groupBy(
              (v) => v.proposalId,
              value,
            );
            return mergeIntoStore({
              proposalsById: objectUtils.mapValues(
                (votes, id) => ({ id, votes }),
                votesByProposalId,
              ),
            });
          }

          case "candidateFeedbacks": {
            const feedbackPostsByCandidateId = arrayUtils.groupBy(
              (f) => f.candidateId,
              value,
            );
            return mergeIntoStore({
              proposalCandidatesById: objectUtils.mapValues(
                (feedbackPosts, id) => ({
                  id,
                  slug: extractSlugFromCandidateId(id),
                  feedbackPosts,
                }),
                feedbackPostsByCandidateId,
              ),
            });
          }

          case "proposalFeedbacks": {
            const feedbackPostsByProposalId = arrayUtils.groupBy(
              (f) => f.proposalId,
              value,
            );
            return mergeIntoStore({
              proposalsById: objectUtils.mapValues(
                (feedbackPosts, id) => ({ id, feedbackPosts }),
                feedbackPostsByProposalId,
              ),
            });
          }

          case "delegationEvents":
          case "transferEvents": {
            // Putting events in all relevant nouns and accounts for now,
            // will likely normalize at some point

            // TODO: Move sorting closer to UI code?
            const sortEvents = (events) =>
              arrayUtils.sortBy(
                { value: (e) => e.blockTimestamp, order: "desc" },
                {
                  value: (e) => {
                    // delegate events should come after transfers chronologically
                    if (e.type === "transfer") return 0;
                    if (e.type === "delegate") return 1;
                    else return -1;
                  },
                  order: "desc",
                },
                events,
              );

            const eventsByNounId = arrayUtils.groupBy((e) => e.nounId, value);

            const eventsByAccountId = value.reduce((acc, event) => {
              for (const propName of [
                "newAccountId",
                "previousAccountId",
                "delegatorId",
              ]) {
                const accountId = event[propName];
                if (accountId == null) continue;
                if (acc[accountId] == null) acc[accountId] = [];
                acc[accountId].push(event);
              }
              return acc;
            }, {});

            return mergeIntoStore({
              accountsById: objectUtils.mapValues(
                (events, accountId) => ({
                  id: accountId,
                  events: sortEvents(events),
                }),
                eventsByAccountId,
              ),
              nounsById: objectUtils.mapValues(
                (events, nounId) => ({
                  id: nounId,
                  events: sortEvents(events),
                }),
                eventsByNounId,
              ),
            });
          }

          case "proposalCandidateSignatures":
            // Don’t cache
            return stateAcc;

          default:
            throw new Error(`Unknown subgraph entity "${key}"`);
        }
      }, storeState);

    const subgraphFetch = async (...args) => {
      const subgraphEntities = await parsedSubgraphFetch(...args);

      // Normalize and merge data into store
      set((storeState) =>
        mergeSubgraphEntitiesIntoStore(storeState, subgraphEntities),
      );

      return subgraphEntities;
    };

    const fetchProposalsVersions = async (proposalIds) =>
      subgraphFetch({
        query: `{
          proposalVersions(
            where: {
              proposal_in: [${proposalIds.map((id) => `"${id}"`)}]
            }
          ) {
            createdAt
            createdBlock
            updateMessage
            proposal { id }
          }
        }`,
      });

    const fetchCandidatesFeedbackPosts = (candidateIds) =>
      subgraphFetch({
        query: `
          ${CANDIDATE_FEEDBACK_FIELDS}
          query {
            candidateFeedbacks(
              where: {
                candidate_in: [${candidateIds.map((id) => JSON.stringify(id))}]
              },
              first: 1000
            ) {
              ...CandidateFeedbackFields
            }
          }`,
      });

    const fetchProposalCandidate = async (rawId) => {
      const [account, ...slugParts] = rawId.split("-");
      const id = [account.toLowerCase(), ...slugParts].join("-");

      const data = await subgraphFetch({
        query: `
          ${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
          ${CANDIDATE_FEEDBACK_FIELDS}
          query {
            proposalCandidate(id: ${JSON.stringify(id)}) {
              id
              slug
              proposer
              canceledTimestamp
              createdTimestamp
              lastUpdatedTimestamp
              createdBlock
              canceledBlock
              lastUpdatedBlock
              latestVersion {
                id
                content {
                  title
                  description
                  targets
                  values
                  signatures
                  calldatas
                  matchingProposalIds
                  proposalIdToUpdate
                  contentSignatures {
                    ...CandidateContentSignatureFields
                  }
                }
              }
              versions {
                id
                createdBlock
                createdTimestamp
                updateMessage
                content {
                  title
                  description
                  targets
                  values
                  signatures
                  calldatas
                }
              }
            }

            candidateFeedbacks(
              where: {
                candidate_: { id: ${JSON.stringify(id)} }
              }
            ) {
              ...CandidateFeedbackFields
            }
          }`,
      });

      if (data.proposalCandidate == null)
        return Promise.reject(new Error("not-found"));

      return data.proposalCandidate;
    };

    const fetchProposals = async (ids) => {
      if (ids == null || ids.length === 0) return [];
      return subgraphFetch({
        query: `
          ${FULL_PROPOSAL_FIELDS}
          query {
            proposals(
              where: {
                id_in: [${ids.map((id) => `"${id}"`)}]
              }
            ) {
              ...FullProposalFields
            }
          }`,
      });
    };

    const fetchProposalCandidates = async (ids) => {
      if (ids == null || ids.length === 0) return [];
      return subgraphFetch({
        query: `
          ${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
          query {
            proposalCandidates(
              where: {
                id_in: [${ids.map((id) => JSON.stringify(id))}]
              }
            ) {
              id
              slug
              proposer
              canceledTimestamp
              createdTimestamp
              lastUpdatedTimestamp
              createdBlock
              canceledBlock
              lastUpdatedBlock
              latestVersion {
                id
                content {
                  title
                  description
                  targets
                  values
                  signatures
                  calldatas
                  matchingProposalIds
                  proposalIdToUpdate
                  contentSignatures {
                    ...CandidateContentSignatureFields
                  }
                }
              }
            }
          }`,
      });
    };

    const fetchNounsByIds = async (ids) => {
      const quotedIds = ids.map((id) => `"${id}"`);
      return await subgraphFetch({
        query: `
          ${TRANSFER_EVENT_FIELDS}
          ${DELEGATION_EVENT_FIELDS}
          query {
            nouns(where: { id_in: [${quotedIds}] }) {
              id
              seed {
                head
                glasses
                body
                background
                accessory
              }
              owner {
                id
                delegate { id }
              }
            }
            transferEvents(
              orderBy: blockNumber,
              orderDirection: desc,
              where: { noun_in: [${quotedIds}] }
            ) {
              ...TransferEventFields
            }
            delegationEvents(
              orderBy: blockNumber,
              orderDirection: desc,
              where: { noun_in: [${quotedIds}] }
            ) {
              ...DelegationEventFields
            }
            auctions(where: { noun_in: [${quotedIds}] }) {
              id
              amount
              startTime
            }
          }`,
      });
    };

    const reverseResolveEnsAddresses = async (client, addresses) => {
      const reverse = (address) =>
        client.getEnsName({
          address,
        });
      const records = await Promise.all(
        addresses.map((address) =>
          reverse(address).then((name) => ({ address, name })),
        ),
      );

      const resolvedRecords = records.filter((r) => r.name != null);

      const ensNameByAddress = resolvedRecords.reduce(
        (acc, r) => ({ ...acc, [r.address]: r.name }),
        {},
      );
      const ensAddressByName = resolvedRecords.reduce(
        (acc, r) => ({ ...acc, [r.name]: r.address }),
        {},
      );

      set((s) => ({
        ensNameByAddress: { ...s.ensNameByAddress, ...ensNameByAddress },
        ensAddressByName: { ...s.ensAddressByName, ...ensAddressByName },
      }));
    };

    return {
      accountsById: {},
      delegatesById: {},
      nounsById: {},
      proposalsById: {},
      proposalCandidatesById: {},
      propdatesByProposalId: {},
      ensNameByAddress: {},
      ensAddressByName: {},
      ...initialState,

      // UI actions
      addOptimitisicProposalVote: (proposalId, vote) => {
        set((s) => {
          const proposal = s.proposalsById[proposalId];
          return {
            proposalsById: {
              ...s.proposalsById,
              [proposalId]: mergeProposals(proposal, {
                votes: [{ ...vote, isPending: true }],
              }),
            },
          };
        });
      },
      addOptimitisicProposalFeedbackPost: (proposalId, post) => {
        set((s) => {
          const proposal = s.proposalsById[proposalId];
          return {
            proposalsById: {
              ...s.proposalsById,
              [proposalId]: mergeProposals(proposal, {
                feedbackPosts: [{ ...post, proposalId, isPending: true }],
              }),
            },
          };
        });
      },
      addOptimitisicCandidateFeedbackPost: (candidateId, post) => {
        set((s) => {
          const candidate = s.proposalCandidatesById[candidateId];
          return {
            proposalCandidatesById: {
              ...s.proposalCandidatesById,
              [candidateId]: mergeProposalCandidates(candidate, {
                feedbackPosts: [{ ...post, candidateId, isPending: true }],
              }),
            },
          };
        });
      },

      // ENS resolution
      resolveEnsNames: async (client, names) => {
        const resolve = (name) =>
          client.getEnsAddress({ name: normalizeEnsName(name) });

        // Assuming the client batches calls here
        const records = await Promise.all(
          names.map((name) =>
            resolve(name).then((address) => ({ address, name })),
          ),
        );

        const resolvedRecords = records.filter((r) => r.address != null);

        const ensNameByAddress = resolvedRecords.reduce(
          (acc, r) => ({ ...acc, [r.address]: r.name }),
          {},
        );
        const ensAddressByName = resolvedRecords.reduce(
          (acc, r) => ({ ...acc, [r.name]: r.address }),
          {},
        );

        set((s) => ({
          ensNameByAddress: { ...s.ensNameByAddress, ...ensNameByAddress },
          ensAddressByName: { ...s.ensAddressByName, ...ensAddressByName },
        }));
      },
      reverseResolveEnsAddresses,

      // Subgraph reads
      subgraphFetch,
      fetchProposals,
      fetchProposal: async (id) => {
        const data = await subgraphFetch({
          query: `
            ${FULL_PROPOSAL_FIELDS}
            query {
              proposal(id: "${id}") {
                ...FullProposalFields
              }
            # proposalVersions(where: {proposal: "${id}"}) {
            #   createdAt
            #   createdBlock
            #   updateMessage
            #   proposal {
            #     id
            #   }
            # }
            # proposalCandidateVersions(
            #   where: {
            #     content_: {
            #       matchingProposalIds_contains: ["${id}"]
            #     }
            #   }
            # ) {
            #   createdBlock
            #   createdTimestamp
            #   updateMessage
            #   proposal { id }
            #   content { matchingProposalIds }
            # }
            }`,
        });

        if (data.proposal == null)
          return Promise.reject(new Error("not-found"));

        const candidateId = data?.proposalCandidateVersions?.[0]?.proposal?.id;

        // Fetch candidate async
        if (candidateId != null) fetchProposalCandidate(candidateId);

        (async () => {
          const proposalsWithTimestamps = await fetchMissingProposalTimestamps(
            { publicClient },
            [data.proposal],
          );

          set((storeState) =>
            mergeSubgraphEntitiesIntoStore(storeState, {
              proposals: proposalsWithTimestamps,
            }),
          );
        })();

        return data.proposal;
      },
      fetchActiveProposals: (referenceBlock) =>
        subgraphFetch({
          query: `
            ${FULL_PROPOSAL_FIELDS}
            query {
              proposals(
                where: {
                  and: [
                    { status_not_in: ["CANCELLED", "VETOED"] },
                    {
                      or: [
                        { endBlock_gt: ${referenceBlock} },
                      # { objectionPeriodEndBlock_gt: ${referenceBlock} }
                      ]
                    }
                  ]
                }
              ) {
                ...FullProposalFields
              }
            }`,
        }),
      fetchProposalCandidate,
      fetchDelegates: async (
        client,
        { includeVotes = false, includeZeroVotingPower = false },
      ) => {
        const { delegates } = await subgraphFetch({
          query: `{
            delegates(
              first: 1000
              ${
                !includeZeroVotingPower
                  ? ", where: { nounsRepresented_: {} }"
                  : ", where: { votes_: {} }"
              }
            ) {
              id
              delegatedVotes
              ${
                includeVotes
                  ? `
                votes(first: 1000, orderBy: blockNumber, orderDirection: desc) {
                  id
                  blockNumber
                  supportDetailed
                  reason
                }`
                  : ""
              }
              nounsRepresented(first: 1000) {
                id
                seed {
                  head
                  glasses
                  body
                  background
                  accessory
                }
                owner {
                  id
                  delegate { id }
                }
              }
            }
          }`,
        });

        // Resolse ENS async
        reverseResolveEnsAddresses(
          client,
          delegates.map((d) => d.id),
        );

        return delegates;
      },
      fetchDelegate: async (id) => {
        const delegate = await subgraphFetch({
          query: `
            ${VOTE_FIELDS}
            query {
              delegate(id: "${id.toLowerCase()}") {
                id
                delegatedVotes
                nounsRepresented(first: 1000) {
                  id
                  seed {
                    head
                    glasses
                    body
                    background
                    accessory
                  }
                  owner {
                    id
                    delegate { id }
                  }
                }
                votes(first: 1000, orderBy: blockNumber, orderDirection: desc) {
                  ...VoteFields
                }
                proposals(first: 1000, orderBy: createdBlock, orderDirection: desc) {
                  id
                  description
                  title
                  status
                  createdBlock
                  createdTimestamp
                # lastUpdatedBlock
                # lastUpdatedTimestamp
                  startBlock
                  endBlock
                # updatePeriodEndBlock
                # objectionPeriodEndBlock
                # canceledBlock
                # canceledTimestamp
                # queuedBlock
                # queuedTimestamp
                # executedBlock
                # executedTimestamp
                  forVotes
                  againstVotes
                  abstainVotes
                  quorumVotes
                  executionETA
                  proposer { id }
                # signers { id }
                }
              }
          }`,
        });

        if (delegate == null) return Promise.reject(new Error("not-found"));

        const nounIds = arrayUtils.unique(
          delegate.nounsRepresented.map((n) => n.id),
        );

        // Fetch nouns async
        fetchNounsByIds(nounIds);

        return delegate;
      },
      fetchAccount: async (id_) => {
        const id = id_.toLowerCase();
        const { account, transferEvents, delegationEvents } =
          await subgraphFetch({
            query: `
              ${DELEGATION_EVENT_FIELDS}
              ${TRANSFER_EVENT_FIELDS}
              query {
                account(id: "${id.toLowerCase()}") {
                  id
                  delegate { id }
                  nouns {
                    id
                    seed {
                      head
                      glasses
                      body
                      background
                      accessory
                    }
                    owner {
                      id
                      delegate { id }
                    }
                  }
                }
                transferEvents(
                  orderBy: blockNumber,
                  orderDirection: desc,
                  where: {
                    or: [
                      { newHolder: "${id}" },
                      { previousHolder: "${id}" }
                    ]
                  }
                ) {
                  ...TransferEventFields
                }
                delegationEvents(
                  orderBy: blockNumber,
                  orderDirection: desc,
                  where: {
                    or: [
                      { newDelegate: "${id}" },
                      { previousDelegate: "${id}" },
                    # { delegator: "${id}" }
                    ]
                  }
                ) {
                  ...DelegationEventFields
                }
              }
            `,
          });

        const nounIds = arrayUtils.unique([
          ...(account?.nouns.map((n) => n.id) ?? []),
          ...transferEvents.map((e) => e.nounId),
          ...delegationEvents.map((e) => e.nounId),
        ]);

        // fetch nouns async ...
        fetchNounsByIds(nounIds);
      },
      fetchNoun: (id) => fetchNounsByIds([id]),
      fetchProposalCandidatesByAccount: (accountAddress) =>
        subgraphFetch({
          query: `
            ${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
            query {
              proposalCandidates(
                where: { proposer: "${accountAddress}" }
              ) {
                id
                slug
                proposer
                createdBlock
                canceledBlock
                lastUpdatedBlock
                canceledTimestamp
                createdTimestamp
                lastUpdatedTimestamp
                latestVersion {
                  id
                  content {
                    title
                    matchingProposalIds
                    proposalIdToUpdate
                    contentSignatures {
                      ...CandidateContentSignatureFields
                    }
                  }
                }
              }
            }`,
        }),
      fetchBrowseScreenData: async (client, { skip = 0, first = 1000 }) => {
        const proposalCandidates = []
        const { proposals/*, proposalCandidates*/ } = await subgraphFetch({
          query: `
            ${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
            query {
              proposals(
                orderBy: createdBlock,
                orderDirection: desc,
                skip: ${skip},
                first: ${first}
              ) {
                id
                title
                status
                createdBlock
                createdTimestamp
              # lastUpdatedBlock
              # lastUpdatedTimestamp
                startBlock
                endBlock
              # updatePeriodEndBlock
              # objectionPeriodEndBlock
              # canceledBlock
              # canceledTimestamp
              # queuedBlock
              # queuedTimestamp
              # executedBlock
              # executedTimestamp
                forVotes
                againstVotes
                abstainVotes
                quorumVotes
                executionETA
                proposer { id }
              # signers { id }
              }
            # proposalCandidates(
            #   orderBy: createdBlock,
            #   orderDirection: desc,
            #   skip: ${skip},
            #   first: ${first}
            # ) {
            #   id
            #   slug
            #   proposer
            #   createdBlock
            #   canceledBlock
            #   lastUpdatedBlock
            #   canceledTimestamp
            #   createdTimestamp
            #   lastUpdatedTimestamp
            #   latestVersion {
            #     id
            #     content {
            #       title
            #       matchingProposalIds
            #       proposalIdToUpdate
            #       contentSignatures {
            #         ...CandidateContentSignatureFields
            #       }
            #     }
            #   }
            # }
            }`,
        });

        const accountAddresses = [];

        for (const p of proposals)
          accountAddresses.push(
            p.proposerId,
            ...(p.signers ?? []).map((s) => s ? s.id : undefined),
          );

        for (const c of proposalCandidates)
          accountAddresses.push(
            c.proposerId,
            ...(c.latestVersion?.content.contentSignatures ?? []).map(
              (s) => s.signer.id,
            ),
          );

        // Populate ENS cache async
        reverseResolveEnsAddresses(client, arrayUtils.unique(accountAddresses));

        (async () => {
          const fetchedCandidateIds = proposalCandidates.map((c) => c.id);

          const { proposalCandidateVersions } = await subgraphFetch({
            query: `{
              proposalCandidateVersions(
                where: {
                  or: [${proposals.map(
                    (p) => `{
                      content_: { matchingProposalIds_contains: ["${p.id}"] }
                    }`,
                  )}]
                },
                first: 1000
              ) {
                content { matchingProposalIds }
                proposal { id }
              }
            }`,
          });

          const missingCandidateIds = arrayUtils.unique(
            proposalCandidateVersions
              .map((v) => v.proposal.id)
              .filter((id) => !fetchedCandidateIds.includes(id)),
          );

          subgraphFetch({
            query: `
              ${CANDIDATE_FEEDBACK_FIELDS}
              query {
                candidateFeedbacks(
                  where: {
                    candidate_in: [${missingCandidateIds.map((id) => JSON.stringify(id))}]
                  },
                  first: 1000
                ) {
                  ...CandidateFeedbackFields
                }
              }`,
          });
        })();

        // Fetch less urgent data async
        subgraphFetch({
          query: `
            ${VOTE_FIELDS}
            ${CANDIDATE_FEEDBACK_FIELDS}
            ${PROPOSAL_FEEDBACK_FIELDS}
            query {
              proposals(
                where: {
                  id_in: [${proposals.map((p) => `"${p.id}"`)}]
                }
              ) {
                id
                votes { ...VoteFields }
              }

            # proposalVersions(
            #   where: {
            #     proposal_in: [${proposals.map((p) => `"${p.id}"`)}]
            #   }
            # ) {
            #   createdAt
            #   createdBlock
            #   updateMessage
            #   proposal { id }
            # }

            # proposalCandidateVersions(
            #   where: {
            #     proposal_in: [${proposalCandidates.map((c) => JSON.stringify(c.id))}]
            #   }
            # ) {
            #   id
            #   createdBlock
            #   createdTimestamp
            #   updateMessage
            #   proposal { id }
            # }

            # proposalFeedbacks(
            #   where: {
            #     proposal_in: [${proposals.map((p) => `"${p.id}"`)}]
            #   },
            #   first: 1000
            # ) {
            #   ...ProposalFeedbackFields
            # }

            # candidateFeedbacks(
            #   where: {
            #     candidate_in: [${proposalCandidates.map((c) => JSON.stringify(c.id))}]
            #   },
            #   first: 1000
            # ) {
            #   ...CandidateFeedbackFields
            # }
            }`,
        });
      },
      fetchVoterScreenData: async (id_, { skip = 0, first = 1000 } = {}) => {
        const id = id_.toLowerCase();
        const [
          {
            proposals,
            proposalCandidates,
            votes,
            proposalFeedbacks,
            candidateFeedbacks,
            nouns,
            transferEvents,
            delegationEvents,
          },
          { proposalCandidates: sponsoredProposalCandidates },
          propdates,
        ] = await Promise.all([
          subgraphFetch({
            query: `
                ${VOTE_FIELDS}
                ${CANDIDATE_FEEDBACK_FIELDS}
                ${PROPOSAL_FEEDBACK_FIELDS}
                ${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
                ${DELEGATION_EVENT_FIELDS}
                ${TRANSFER_EVENT_FIELDS}
                query {
                  proposals(
                    orderBy: createdBlock,
                    orderDirection: desc,
                    skip: ${skip},
                    first: ${first},
                    where: { proposer: "${id}" }
                  ) {
                    id
                    description
                    title
                    status
                    createdBlock
                    createdTimestamp
                  # lastUpdatedBlock
                  # lastUpdatedTimestamp
                    startBlock
                    endBlock
                  # updatePeriodEndBlock
                  # objectionPeriodEndBlock
                  # canceledBlock
                  # canceledTimestamp
                  # queuedBlock
                  # queuedTimestamp
                  # executedBlock
                  # executedTimestamp
                    forVotes
                    againstVotes
                    abstainVotes
                    quorumVotes
                    executionETA
                    proposer { id }
                  # signers { id }
                    votes { ...VoteFields }
                  }

                # proposalCandidates(
                #   orderBy: createdBlock,
                #   orderDirection: desc,
                #   skip: ${skip},
                #   first: ${first},
                #   where: { proposer: "${id}" }
                # ) {
                #   id
                #   slug
                #   proposer
                #   createdBlock
                #   canceledBlock
                #   lastUpdatedBlock
                #   canceledTimestamp
                #   createdTimestamp
                #   lastUpdatedTimestamp
                #   latestVersion {
                #     id
                #     content {
                #       title
                #       matchingProposalIds
                #       proposalIdToUpdate
                #       contentSignatures {
                #         ...CandidateContentSignatureFields
                #       }
                #     }
                #   }
                # }
                  votes(
                    orderBy: blockNumber,
                    orderDirection: desc,
                    skip: ${skip},
                    first: ${first},
                    where: { voter: "${id}" }
                  ) {
                    ...VoteFields
                  }
                # candidateFeedbacks(
                #   skip: ${skip},
                #   first: ${first},
                #   where: { voter: "${id}" }
                # ) {
                #   ...CandidateFeedbackFields
                # }
                # proposalFeedbacks(
                #   skip: ${skip},
                #   first: ${first},
                #   where: { voter: "${id}" }
                # ) {
                #   ...ProposalFeedbackFields
                # }
                  nouns(where: { owner: "${id}" }) {
                    id
                    seed {
                      head
                      glasses
                      body
                      background
                      accessory
                    }
                    owner {
                      id
                      delegate { id }
                    }
                  }
                  transferEvents(
                    orderBy: blockNumber,
                    orderDirection: desc,
                    skip: ${skip},
                    first: ${first},
                    where: {
                    or: [
                      { newHolder: "${id}" },
                      { previousHolder: "${id}" }
                    ]
                  }
                  ) {
                    ...TransferEventFields
                  }
                  delegationEvents(
                    orderBy: blockNumber,
                    orderDirection: desc,
                    skip: ${skip},
                    first: ${first},
                    where: {
                    or: [
                      { newDelegate: "${id}" },
                      { previousDelegate: "${id}" },
                      # { delegator: "${id}" }
                    ]
                  }
                  ) {
                    ...DelegationEventFields
                  }
                } `,
          }),

          (async () => {
            // Fetch signatures, then content IDs, and finally the candidate versions
            const { proposalCandidateSignatures } = await subgraphFetch({
              query: `
                query {
                  proposalCandidateSignatures(
                    where: { signer: "${id.toLowerCase()}" }
                  ) {
                    content { id }
                  }
                } `,
            });

            const contentIds = arrayUtils.unique(
              proposalCandidateSignatures.map((s) => s.content.id),
            );

            const { proposalCandidateVersions } = await subgraphFetch({
              query: `
                query {
                  proposalCandidateVersions(
                    where: {
                      content_in: [${contentIds.map((id) => `"${id}"`)}]
                    }
                  ) {
                    id
                  }
                } `,
            });

            return subgraphFetch({
              query: `
                ${CANDIDATE_CONTENT_SIGNATURE_FIELDS}
                query {
                  proposalCandidates(
                    where: {
                      latestVersion_in: [${proposalCandidateVersions.map((v) => `"${v.id}"`)}]
                    }
                  ) {
                    id
                    slug
                    proposer
                    canceledTimestamp
                    createdTimestamp
                    lastUpdatedTimestamp
                    createdBlock
                    canceledBlock
                    lastUpdatedBlock
                    latestVersion {
                      id
                        content {
                        title
                        description
                        targets
                        values
                        signatures
                        calldatas
                        matchingProposalIds
                        proposalIdToUpdate
                        contentSignatures {
                          ...CandidateContentSignatureFields
                        }
                      }
                    }
                    versions { id }
                  }
                }`,
            });
          })(),

          PropdatesSubgraph.fetchPropdatesByAccount(id),
        ]);

        // TODO: Merge all below into a single request

        // Fetch all versions of created proposals
        fetchProposalsVersions(proposals.map((p) => p.id));
        // Fetch feedback for voter's candies (candidates tab)
        fetchCandidatesFeedbackPosts(proposalCandidates.map((c) => c.id));
        // Fetch Candidates the voter has commented on
        fetchProposalCandidates(
          arrayUtils.unique(candidateFeedbacks.map((p) => p.candidateId)),
        );
        // Fetch relevant noun data
        fetchNounsByIds(
          arrayUtils.unique([
            ...nouns.map((n) => n.id),
            ...transferEvents.map((e) => e.nounId),
            ...delegationEvents.map((e) => e.nounId),
          ]),
        );

        // Fetch proposals voted or commented on by voter, sponsored proposals,
        // and proposals with propdates
        fetchProposals(
          arrayUtils.unique([
            ...votes.map((p) => p.proposalId),
            ...proposalFeedbacks.map((p) => p.proposalId),
            ...sponsoredProposalCandidates.map(
              (c) => c.latestVersion?.proposalId,
            ),
            ...propdates.map((p) => p.proposalId),
          ]),
        );

        set(() => ({
          propdatesByProposalId: arrayUtils.groupBy(
            (d) => d.proposalId,
            propdates,
          ),
        }));
      },
      fetchNounsActivity: async ({ startBlock, endBlock }) => {
        const [propdates, { proposals }] = await Promise.all([
          PropdatesSubgraph.fetchPropdates({ startBlock, endBlock }),
          subgraphFetch({
            query: `
              ${CANDIDATE_FEEDBACK_FIELDS}
              ${PROPOSAL_FEEDBACK_FIELDS}
              ${VOTE_FIELDS}
              query {
                proposals(
                  where: {
                    or: [
                      { startBlock_gte: ${startBlock}, startBlock_lte: ${endBlock} },
                      { endBlock_gte: ${startBlock}, endBlock_lte: ${endBlock} },
                    # { objectionPeriodEndBlock_gte: ${startBlock}, objectionPeriodEndBlock_lte: ${endBlock} },
                    ]
                  },
                  first: 1000
                ) {
                  id
                  startBlock
                  endBlock
                # objectionPeriodEndBlock
                }
              # candidateFeedbacks(
              #   where: {
              #     createdBlock_gte: ${startBlock},
              #     createdBlock_lte: ${endBlock}
              #   },
              #   first: 1000
              # ) {
              #   ...CandidateFeedbackFields
              # }
              # proposalFeedbacks(
              #   where: {
              #     createdBlock_gte: ${startBlock},
              #     createdBlock_lte: ${endBlock}
              #   },
              #   first: 1000
              # ) {
              #   ...ProposalFeedbackFields
              # }
                votes(
                  where: {
                    blockNumber_gte: ${startBlock},
                    blockNumber_lte: ${endBlock}
                  },
                  orderBy: blockNumber,
                  orderDirection: desc,
                  first: 1000
                ) {
                  ...VoteFields
                  proposal { id }
                }
              }`,
          }),
        ]);

        (async () => {
          const proposalsWithTimestamps = await fetchMissingProposalTimestamps(
            { publicClient },
            proposals,
          );

          set((storeState) =>
            mergeSubgraphEntitiesIntoStore(storeState, {
              proposals: proposalsWithTimestamps,
            }),
          );
        })();

        set((s) => ({
          propdatesByProposalId: objectUtils.merge(
            (ps1 = [], ps2 = []) =>
              arrayUtils.unique((p1, p2) => p1.id === p2.id, [...ps1, ...ps2]),
            s.propdatesByProposalId,
            arrayUtils.groupBy((d) => d.proposalId, propdates),
          ),
        }));
      },
      fetchVoterActivity: async (voterAddress_, { startBlock, endBlock }) => {
        const voterAddress = voterAddress_.toLowerCase();
        const { proposalFeedbacks, candidateFeedbacks } = {
          proposalFeedbacks: [],
          candidateFeedbacks: [],
        };
        const { votes /*, proposalFeedbacks, candidateFeedbacks*/ } =
          await subgraphFetch({
            query: `
              ${CANDIDATE_FEEDBACK_FIELDS}
              ${PROPOSAL_FEEDBACK_FIELDS}
              ${VOTE_FIELDS}
              ${TRANSFER_EVENT_FIELDS}
              ${DELEGATION_EVENT_FIELDS}
              query {
              # candidateFeedbacks(
              #   where: {
              #     voter: "${voterAddress}",
              #     createdBlock_gte: ${startBlock},
              #     createdBlock_lte: ${endBlock}
              #   },
              #   first: 1000
              # ) {
              #   ...CandidateFeedbackFields
              # }
              # proposalFeedbacks(
              #   where: {
              #     voter: "${voterAddress}",
              #     createdBlock_gte: ${startBlock},
              #     createdBlock_lte: ${endBlock}
              #   },
              #   first: 1000
              # ) {
              #   ...ProposalFeedbackFields
              # }
                votes(
                  where: {
                    voter: "${voterAddress}",
                    blockNumber_gte: ${startBlock},
                    blockNumber_lte: ${endBlock}
                  },
                  orderBy: blockNumber,
                  orderDirection: desc,
                  first: 1000
                ) {
                  ...VoteFields
                  proposal { id }
                }
                transferEvents(
                  orderBy: blockNumber,
                  orderDirection: desc,
                  first: 1000,
                  where: {
                    and: [
                      {
                        blockNumber_gte: ${startBlock},
                        blockNumber_lte: ${endBlock}
                      },
                      {
                        or: [
                          { newHolder: "${voterAddress}" },
                          { previousHolder: "${voterAddress}" }
                        ]
                      }
                    ]
                  }
                ) {
                  ...TransferEventFields
                }
                delegationEvents(
                  orderBy: blockNumber,
                  orderDirection: desc,
                  first: 1000,
                  where: {
                  and: [
                    {
                      blockNumber_gte: ${startBlock},
                      blockNumber_lte: ${endBlock}
                    },
                    {
                      or: [
                        { newDelegate: "${voterAddress}" },
                        { previousDelegate: "${voterAddress}" },
                        # { delegator: "${voterAddress}" }
                      ]
                    }
                  ]
                }) {
                  ...DelegationEventFields
                }
              }`,
          });

        const proposalIds = arrayUtils.unique(
          [...votes, ...proposalFeedbacks].map((p) => p.proposalId),
        );
        const candidateIds = arrayUtils.unique(
          candidateFeedbacks.map((p) => p.candidateId),
        );

        // TODO: Merge into one request
        fetchProposals(proposalIds);
        fetchProposalCandidates(candidateIds);
      },
      fetchPropdatesForProposal: (...args) =>
        PropdatesSubgraph.fetchPropdatesForProposal(...args).then(
          (propdates) => {
            set((s) => ({
              propdatesByProposalId: objectUtils.merge(
                (ps1 = [], ps2 = []) =>
                  arrayUtils.unique(
                    (p1, p2) => p1.id === p2.id,
                    [...ps1, ...ps2],
                  ),
                s.propdatesByProposalId,
                arrayUtils.groupBy((d) => d.proposalId, propdates),
              ),
            }));
          },
        ),
    };
  });

const StoreContext = React.createContext();

export const Provider = ({ children, initialState }) => {
  const publicClient = usePublicClient();
  const storeRef = React.useRef();

  if (storeRef.current == null) {
    storeRef.current = createStore({ initialState, publicClient });
  }

  return (
    <StoreContext.Provider value={storeRef.current}>
      {children}
    </StoreContext.Provider>
  );
};

export const Hydrater = ({ state }) => {
  const store = React.useContext(StoreContext);
  if (store == null)
    throw new Error(
      "`Hydrater` cannot be used without a parent store provider",
    );

  React.useEffect(() => {
    store.setState((s) => {
      const keys = Object.keys(state);
      return keys.reduce((s, key) => {
        switch (key) {
          case "proposalsById":
            return {
              ...s,
              proposalsById: objectUtils.merge(
                mergeProposals,
                s.proposalsById,
                state.proposalsById,
              ),
            };

          case "proposalCandidatesById":
            return {
              proposalCandidatesById: objectUtils.merge(
                mergeProposalCandidates,
                s.proposalCandidatesById,
                state.proposalCandidatesById,
              ),
            };

          default:
            console.warn(`Don’t know how to hydrate "${key}"`);
            return s;
        }
      }, s);
    });
  }, [store, state]);

  return null;
};

const useStore = (selector) => {
  const store = React.useContext(StoreContext);
  if (store == null)
    throw new Error(
      "`useStore` cannot be used without a parent store provider",
    );
  return useZustandStore(store, selector);
};

export const useSubgraphFetch = () => {
  return useStore((s) => s.subgraphFetch);
};

export const useActions = () => {
  const publicClient = usePublicClient();

  const subgraphFetch = useStore((s) => s.subgraphFetch);
  const fetchProposal = useStore((s) => s.fetchProposal);
  const fetchProposals = useStore((s) => s.fetchProposals);
  const fetchActiveProposals = useStore((s) => s.fetchActiveProposals);
  const fetchProposalCandidate = useStore((s) => s.fetchProposalCandidate);
  const fetchDelegates = useStore((s) => s.fetchDelegates);
  const fetchDelegate = useStore((s) => s.fetchDelegate);
  const fetchAccount = useStore((s) => s.fetchAccount);
  const fetchNoun = useStore((s) => s.fetchNoun);
  const fetchProposalCandidatesByAccount = useStore(
    (s) => s.fetchProposalCandidatesByAccount,
  );
  const fetchNounsActivity = useStore((s) => s.fetchNounsActivity);
  const fetchVoterActivity = useStore((s) => s.fetchVoterActivity);
  const fetchBrowseScreenData = useStore((s) => s.fetchBrowseScreenData);
  const fetchVoterScreenData = useStore((s) => s.fetchVoterScreenData);
  const fetchPropdatesForProposal = useStore(
    (s) => s.fetchPropdatesForProposal,
  );
  const resolveEnsNames = useStore((s) => s.resolveEnsNames);
  const reverseResolveEnsAddresses = useStore(
    (s) => s.reverseResolveEnsAddresses,
  );
  const addOptimitisicProposalVote = useStore(
    (s) => s.addOptimitisicProposalVote,
  );
  const addOptimitisicProposalFeedbackPost = useStore(
    (s) => s.addOptimitisicProposalFeedbackPost,
  );
  const addOptimitisicCandidateFeedbackPost = useStore(
    (s) => s.addOptimitisicCandidateFeedbackPost,
  );

  return {
    subgraphFetch,
    fetchProposal,
    fetchProposals,
    fetchActiveProposals,
    fetchProposalCandidate,
    fetchDelegate,
    fetchDelegates: React.useCallback(
      (...args) => fetchDelegates(publicClient, ...args),
      [fetchDelegates, publicClient],
    ),
    fetchAccount,
    fetchNoun,
    fetchProposalCandidatesByAccount,
    fetchNounsActivity,
    fetchVoterActivity,
    fetchBrowseScreenData: React.useCallback(
      (...args) => fetchBrowseScreenData(publicClient, ...args),
      [fetchBrowseScreenData, publicClient],
    ),
    fetchVoterScreenData,
    fetchPropdatesForProposal,
    resolveEnsNames,
    reverseResolveEnsAddresses,
    addOptimitisicProposalVote,
    addOptimitisicProposalFeedbackPost,
    addOptimitisicCandidateFeedbackPost,
  };
};

export const useDelegate = (id) =>
  useStore(React.useCallback((s) => s.delegatesById[id?.toLowerCase()], [id]));

export const useDelegates = () =>
  useStore((s) => {
    return Object.values(s.delegatesById);
  });

export const useDelegatesFetch = ({
  includeVotes = false,
  includeZeroVotingPower = false,
} = {}) => {
  const { fetchDelegates } = useActions();
  useFetch(
    () => fetchDelegates({ includeVotes, includeZeroVotingPower }),
    [fetchDelegates, includeVotes, includeZeroVotingPower],
  );
};

export const useDelegateFetch = (id, options) => {
  const onError = useLatestCallback(options?.onError);

  const { fetchDelegate } = useActions();

  useFetch(
    id == null
      ? null
      : () =>
          fetchDelegate(id).catch((e) => {
            if (onError == null) return Promise.reject(e);
            onError(e);
          }),
    { fetchInterval: options?.fetchInterval },
    [fetchDelegate, id, onError],
  );
};

export const useProposalFetch = (id, options) => {
  const blockNumber = useBlockNumber({ watch: true, cacheTime: 10_000 });
  const onError = useLatestCallback(options?.onError);

  const { fetchProposal, fetchPropdatesForProposal } = useActions();

  useFetch(
    id == null
      ? null
      : () =>
          fetchProposal(id).catch((e) => {
            if (onError == null) return Promise.reject(e);
            onError(e);
          }),
    [fetchProposal, id, onError, blockNumber],
  );

  useFetch(id == null ? null : () => fetchPropdatesForProposal(id), [
    fetchPropdatesForProposal,
    id,
  ]);
};

export const useActiveProposalsFetch = () => {
  const blockNumber = useBlockNumber({ watch: true, cacheTime: 10_000 });
  const { fetchActiveProposals } = useActions();
  useFetch(
    blockNumber == null ? undefined : () => fetchActiveProposals(blockNumber),
    [blockNumber, fetchActiveProposals],
  );
};

export const useProposalCandidateFetch = (id, options) => {
  const blockNumber = useBlockNumber({ watch: true, cacheTime: 10_000 });
  const onError = useLatestCallback(options?.onError);

  const { fetchProposalCandidate } = useActions();

  useFetch(
    () =>
      fetchProposalCandidate(id).catch((e) => {
        if (onError == null) return Promise.reject(e);
        onError(e);
      }),
    [fetchProposalCandidate, id, onError, blockNumber],
  );
};

export const useProposalCandidate = (id) =>
  useStore(
    React.useCallback(
      (s) => (id == null ? null : s.proposalCandidatesById[id]),
      [id],
    ),
  );

const selectProposal = (
  store,
  proposalId,
  {
    state: includeState = false,
    propdates: includePropdates = false,
    blockNumber,
  } = {},
) => {
  let p = store.proposalsById[proposalId];

  if (!includeState && !includePropdates) return p ?? null;

  if (p == null) {
    if (includePropdates && store.propdatesByProposalId[proposalId] != null)
      return {
        id: proposalId,
        propdates: store.propdatesByProposalId[proposalId],
      };

    return null;
  }

  p = { ...p };

  if (includeState)
    p.state = blockNumber == null ? null : getProposalState(p, { blockNumber });

  if (includePropdates) p.propdates = store.propdatesByProposalId[proposalId];

  return p;
};

export const useProposals = ({
  state = false,
  propdates = false,
  filter,
} = {}) => {
  const blockNumber = useBlockNumber({ watch: true, cacheTime: 20_000 });

  return useStore(
    React.useCallback(
      (s) => {
        const sort = (ps) =>
          arrayUtils.sortBy((p) => p.lastUpdatedTimestamp, ps);

        const allProposalIds = Object.keys(s.proposalsById);

        const proposals = allProposalIds.reduce((ps, id) => {
          const proposal = selectProposal(s, id, {
            state: state || filter === "active",
            propdates,
            blockNumber,
          });

          if (filter == null) {
            ps.push(proposal);
            return ps;
          }

          switch (filter) {
            case "active": {
              if (!isActiveProposalState(proposal.state)) return ps;
              ps.push(proposal);
              return ps;
            }

            default:
              throw new Error();
          }
        }, []);

        return sort(proposals);
      },
      [state, blockNumber, propdates, filter],
    ),
  );
};

export const useProposal = (id, { watch = true } = {}) => {
  const blockNumber = useBlockNumber({ watch, cacheTime: 10_000 });

  return useStore(
    React.useCallback(
      (s) => {
        if (id == null) return null;

        const proposal = s.proposalsById[id];

        if (proposal == null) return null;
        if (blockNumber == null) return proposal;

        return {
          ...proposal,
          state: getProposalState(proposal, { blockNumber }),
          propdates: s.propdatesByProposalId[id],
        };
      },
      [id, blockNumber],
    ),
  );
};

export const useProposalCandidates = ({
  includeCanceled = false,
  includePromoted = false,
  includeProposalUpdates = false,
} = {}) => {
  const blockNumber = useBlockNumber({ watch: true, cacheTime: 30_000 });

  const candidatesById = useStore((s) => s.proposalCandidatesById);
  const proposalsById = useStore((s) => s.proposalsById);

  return React.useMemo(() => {
    const candidates = Object.values(candidatesById);

    const filteredCandidates = candidates.filter((c) => {
      // Filter canceled candidates
      if (c.canceledTimestamp != null) return includeCanceled;

      // Filter candidates with a matching proposal
      if (c.latestVersion?.proposalId != null) return includePromoted;

      if (c.latestVersion?.targetProposalId != null) {
        const targetProposal = proposalsById[c.latestVersion.targetProposalId];

        // Exlude candidates with a target proposal past its update period end block
        return (
          includeProposalUpdates &&
          targetProposal != null &&
          targetProposal.updatePeriodEndBlock > blockNumber
        );
      }

      return true;
    });

    return arrayUtils.sortBy(
      { value: (p) => p.lastUpdatedTimestamp, order: "desc" },
      filteredCandidates,
    );
  }, [
    candidatesById,
    proposalsById,
    blockNumber,
    includeCanceled,
    includePromoted,
    includeProposalUpdates,
  ]);
};

export const useProposalUpdateCandidates = ({
  includeTargetProposal = false,
} = {}) => {
  const blockNumber = useBlockNumber({ watch: true, cacheTime: 30_000 });

  const candidatesById = useStore((s) => s.proposalCandidatesById);
  const proposalsById = useStore((s) => s.proposalsById);

  return React.useMemo(() => {
    const candidates = Object.values(candidatesById);

    const filteredCandidates = candidates.reduce((acc, c) => {
      if (c.latestVersion?.targetProposalId == null) return acc;

      // Exlcude canceled and submitted updates
      if (c.canceledTimestamp != null || c.latestVersion?.proposalId != null)
        return acc;

      const targetProposal = proposalsById[c.latestVersion.targetProposalId];

      // Exlude updates past its target proposal’s update period
      if (
        targetProposal == null ||
        targetProposal.updatePeriodEndBlock <= blockNumber
      )
        return acc;

      acc.push(includeTargetProposal ? { ...c, targetProposal } : c);

      return acc;
    }, []);

    return arrayUtils.sortBy(
      { value: (p) => p.lastUpdatedTimestamp, order: "desc" },
      filteredCandidates,
    );
  }, [candidatesById, proposalsById, includeTargetProposal, blockNumber]);
};

export const useAccountProposals = (accountAddress) => {
  const proposalsById = useStore((s) => s.proposalsById);

  return React.useMemo(() => {
    if (accountAddress == null) return [];
    const proposals = Object.values(proposalsById);
    return proposals.filter(
      (p) => p.proposerId?.toLowerCase() === accountAddress.toLowerCase(),
    );
  }, [proposalsById, accountAddress]);
};

export const useAccountSponsoredProposals = (accountAddress) => {
  const proposalsById = useStore((s) => s.proposalsById);

  return React.useMemo(() => {
    if (accountAddress == null) return [];
    const proposals = Object.values(proposalsById);
    return proposals.filter((p) =>
      p.signers?.some(
        (s) => s.id.toLowerCase() === accountAddress.toLowerCase(),
      ),
    );
  }, [proposalsById, accountAddress]);
};

export const useAccountProposalCandidates = (accountAddress) => {
  const candidatesById = useStore((s) => s.proposalCandidatesById);

  return React.useMemo(() => {
    if (accountAddress == null) return [];
    const candidates = Object.values(candidatesById);
    return candidates.filter(
      (c) => c.proposerId?.toLowerCase() === accountAddress.toLowerCase(),
    );
  }, [candidatesById, accountAddress]);
};

export const useProposalCandidateVotingPower = (candidateId) => {
  const candidate = useProposalCandidate(candidateId);
  const proposerDelegate = useDelegate(candidate.proposerId);
  const activeProposerIds = useProposals({ filter: "active" }).map(
    (p) => p.proposerId,
  );

  const proposerDelegateNounIds =
    proposerDelegate?.nounsRepresented.map((n) => n.id) ?? [];

  const validSignatures = getCandidateSponsorSignatures(candidate, {
    excludeInvalid: true,
    activeProposerIds,
  });

  const sponsoringNounIds = arrayUtils.unique(
    validSignatures.flatMap((s) => s.signer.nounsRepresented.map((n) => n.id)),
  );

  const candidateVotingPower = arrayUtils.unique([
    ...sponsoringNounIds,
    ...proposerDelegateNounIds,
  ]).length;

  return candidateVotingPower;
};

export const useNoun = (id) =>
  useStore(React.useCallback((s) => s.nounsById[id], [id]));

export const useNounsRepresented = (accountId) =>
  useStore(
    React.useCallback(
      (s) => {
        if (accountId == null) return null;
        const delegate = s.delegatesById[accountId.toLowerCase()];
        if (delegate == null) return null;
        const nouns = [];
        for (const { id } of delegate.nounsRepresented) {
          const noun = s.nounsById[id];
          if (noun == null) continue;
          nouns.push(noun);
        }
        return nouns;
      },
      [accountId],
    ),
  );

export const useAllNounsByAccount = (accountAddress) => {
  const delegatedNouns = useStore(
    (s) =>
      s.delegatesById[accountAddress.toLowerCase()]?.nounsRepresented ?? [],
  );

  const ownedNouns = useStore(
    (s) => s.accountsById[accountAddress.toLowerCase()]?.nouns ?? [],
  );

  const uniqueNouns = arrayUtils.unique(
    (n1, n2) => n1.id === n2.id,
    [...delegatedNouns, ...ownedNouns],
  );

  const nounsById = useStore((s) => s.nounsById);

  return React.useMemo(
    () => uniqueNouns.map((n) => nounsById[n.id]).filter(Boolean),
    [uniqueNouns, nounsById],
  );
};

export const useAccount = (id) =>
  useStore(React.useCallback((s) => s.accountsById[id?.toLowerCase()], [id]));

export const useAccountFetch = (id, options) => {
  const onError = useLatestCallback(options?.onError);

  const hasErrorHandler = options?.onError != null;

  const { fetchAccount } = useActions();

  useFetch(
    id == null
      ? null
      : () =>
          fetchAccount(id).catch((e) => {
            if (!hasErrorHandler) return Promise.reject(e);
            onError(e);
          }),
    { fetchInterval: options?.fetchInterval },
    [fetchAccount, id, hasErrorHandler, onError],
  );
};

export const usePropdates = () =>
  useStore((s) => Object.values(s.propdatesByProposalId).flatMap((ps) => ps));

export const useEnsCache = () =>
  useStore((s) => ({
    nameByAddress: s.ensNameByAddress,
    addressByName: s.ensAddressByName,
  }));

export const useProposalFeedItems = (proposalId) => {
  const [farcasterFilter] = useSetting("farcaster-cast-filter");

  const eagerLatestBlockNumber = useBlockNumber({
    watch: true,
    cacheTime: 20_000,
  });

  const latestBlockNumber = React.useDeferredValue(eagerLatestBlockNumber);

  const casts = useProposalCasts(proposalId, { filter: farcasterFilter });

  return useStore(
    React.useCallback(
      (s) =>
        buildProposalFeed(s, proposalId, {
          latestBlockNumber,
          casts,
          includePropdateItems: true,
        }),
      [proposalId, latestBlockNumber, casts],
    ),
  );
};

export const useCandidateFeedItems = (candidateId) => {
  const eagerLatestBlockNumber = useBlockNumber({
    watch: true,
    cacheTime: 20_000,
  });
  const latestBlockNumber = React.useDeferredValue(eagerLatestBlockNumber);

  const [farcasterFilter] = useSetting("farcaster-cast-filter");
  const casts = useCandidateCasts(candidateId, { filter: farcasterFilter });

  return useStore(
    React.useCallback(
      (s) =>
        buildCandidateFeed(s, candidateId, {
          latestBlockNumber,
          casts,
        }),
      [candidateId, latestBlockNumber, casts],
    ),
  );
};

export const useAccountFeedItems = (accountAddress, { filter }) => {
  return useStore(
    React.useCallback(
      (s) => buildAccountFeed(s, accountAddress, { filter }),
      [accountAddress, filter],
    ),
  );
};

export const useMainFeedItems = (filter, { enabled = true }) => {
  const eagerLatestBlockNumber = useBlockNumber({
    watch: true,
    cacheTime: 10_000,
    enabled,
  });
  const latestBlockNumber = React.useDeferredValue(eagerLatestBlockNumber);

  const [farcasterFilter] = useSetting("farcaster-cast-filter");
  const casts = useRecentCasts({ filter: farcasterFilter });

  return useStore(
    React.useCallback(
      (s) => {
        if (!enabled) return [];

        const castsByProposalId = arrayUtils.groupBy(
          (c) => c.proposalId,
          casts,
        );
        const castsByCandidateId = arrayUtils.groupBy(
          (c) => c.candidateId,
          casts,
        );

        const buildProposalItems = () =>
          Object.keys(s.proposalsById).flatMap((proposalId) =>
            buildProposalFeed(s, proposalId, {
              latestBlockNumber,
              casts: castsByProposalId[proposalId],
              includePropdateItems: false,
              includeCandidateItems: false,
            }),
          );

        const buildCandidateItems = () =>
          Object.keys(s.proposalCandidatesById).flatMap((candidateId) =>
            buildCandidateFeed(s, candidateId, {
              casts: castsByCandidateId[candidateId],
            }),
          );

        const buildPropdateItems = () =>
          Object.values(s.propdatesByProposalId).flatMap((propdates) =>
            propdates.map(buildPropdateFeedItem),
          );

        const buildFeedItems = () => {
          switch (filter) {
            case "proposals":
              return [...buildProposalItems(), ...buildPropdateItems()];
            case "candidates":
              return buildCandidateItems();
            case "propdates":
              return buildPropdateItems();
            default:
              return [
                ...buildProposalItems(),
                ...buildCandidateItems(),
                ...buildPropdateItems(),
              ];
          }
        };

        return arrayUtils.sortBy(
          { value: (i) => i.blockNumber ?? 0, order: "desc" },
          buildFeedItems(),
        );
      },
      [enabled, filter, casts, latestBlockNumber],
    ),
  );
};
