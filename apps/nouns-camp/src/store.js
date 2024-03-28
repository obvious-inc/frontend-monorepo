"use client";

import React from "react";
import {
  createStore as createZustandStore,
  useStore as useZustandStore,
} from "zustand";
import { normalize as normalizeEnsName } from "viem/ens";
import { usePublicClient, useBlockNumber } from "wagmi";
import { useFetch, useLatestCallback } from "@shades/common/react";
import {
  array as arrayUtils,
  object as objectUtils,
} from "@shades/common/utils";
import {
  getState as getProposalState,
  isActiveState as isActiveProposalState,
} from "./utils/proposals.js";
import {
  extractSlugFromId as extractSlugFromCandidateId,
  getSponsorSignatures as getCandidateSponsorSignatures,
} from "./utils/candidates.js";
import useChainId from "./hooks/chain-id.js";
import * as NounsSubgraph from "./nouns-subgraph.js";
import * as PropdatesSubgraph from "./propdates-subgraph.js";

const mergeProposals = (p1, p2) => {
  if (p1 == null) return p2;

  const mergedProposal = { ...p1, ...p2 };

  if (p1.feedbackPosts != null && p2.feedbackPosts != null)
    mergedProposal.feedbackPosts = arrayUtils.unique(
      (p1, p2) => p1.id === p2.id,
      [...p1.feedbackPosts, ...p2.feedbackPosts],
    );

  if (p1.votes != null && p2.votes != null)
    mergedProposal.votes = arrayUtils.unique(
      (v1, v2) => {
        if (v1.id === v2.id) return true;
        if (!v1.isPending) return false;
        return v1.voterId.toLowerCase() === v2.voterId.toLowerCase();
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
        const [compositeId1, compositeId2] = [p1, p2].map((p) =>
          [p.proposalId, p.candidateId, p.reason, p.support, p.voterId]
            .join("-")
            .trim()
            .toLowerCase(),
        );
        return compositeId1 === compositeId2;
      },
      // p2 has to be first here to take precedence
      [...p2.feedbackPosts, ...p1.feedbackPosts],
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

const mergeDelegates = (d1, d2) => {
  if (d1 == null) return d2;

  const mergedDelegate = { ...d1, ...d2 };

  if (d1.proposals != null && d2.proposals != null)
    mergedDelegate.proposals = arrayUtils.unique(
      (p1, p2) => p1.id === p2.id,
      [...d1.proposals, ...d2.proposals],
    );

  if (d1.votes != null && d2.votes != null)
    mergedDelegate.votes = arrayUtils.unique(
      (v1, v2) => v1.id === v2.id,
      [...d1.votes, ...d2.votes],
    );

  return mergedDelegate;
};

const createStore = ({ initialState }) =>
  createZustandStore((set) => {
    const fetchProposalsVersions = async (chainId, proposalIds) =>
      NounsSubgraph.fetchProposalsVersions(chainId, proposalIds).then(
        (versions) => {
          set((s) => {
            const versionsByProposalId = arrayUtils.groupBy(
              (v) => v.proposalId,
              versions,
            );
            const fetchedProposalsById = objectUtils.mapValues(
              (versions, id) => ({ id, versions }),
              versionsByProposalId,
            );

            return {
              proposalsById: objectUtils.merge(
                mergeProposals,
                s.proposalsById,
                fetchedProposalsById,
              ),
            };
          });
        },
      );

    const fetchProposalCandidatesFeedbackPosts = async (
      chainId,
      candidateIds,
    ) =>
      NounsSubgraph.fetchProposalCandidatesFeedbackPosts(
        chainId,
        candidateIds,
      ).then((feedbackPosts) => {
        set((s) => {
          const feedbackPostsByCandidateId = arrayUtils.groupBy(
            (p) => p.candidateId,
            feedbackPosts,
          );
          const fetchedCandidatesById = objectUtils.mapValues(
            (feedbackPosts, id) => ({
              id,
              slug: extractSlugFromCandidateId(id),
              feedbackPosts,
            }),

            feedbackPostsByCandidateId,
          );

          return {
            proposalCandidatesById: objectUtils.merge(
              mergeProposalCandidates,
              s.proposalCandidatesById,
              fetchedCandidatesById,
            ),
          };
        });
      });

    const fetchProposalCandidate = async (chainId, id) =>
      NounsSubgraph.fetchProposalCandidate(chainId, id).then((candidate) => {
        set((s) => ({
          proposalCandidatesById: {
            ...s.proposalCandidatesById,
            [id]: mergeProposalCandidates(
              s.proposalCandidatesById[id],
              candidate,
            ),
          },
        }));
      });

    const fetchProposals = async (chainId, ids) =>
      NounsSubgraph.fetchProposals(chainId, ids).then((proposals) => {
        set((s) => {
          const fetchedProposalsById = arrayUtils.indexBy(
            (p) => p.id,
            proposals,
          );

          return {
            proposalsById: objectUtils.merge(
              mergeProposals,
              s.proposalsById,
              fetchedProposalsById,
            ),
          };
        });
      });

    const fetchProposalCandidates = async (chainId, ids) =>
      NounsSubgraph.fetchProposalCandidates(chainId, ids).then((candidates) => {
        set((s) => {
          const fetchedCandidatesById = arrayUtils.indexBy(
            (p) => p.id.toLowerCase(),
            candidates,
          );

          return {
            proposalCandidatesById: objectUtils.merge(
              mergeProposalCandidates,
              s.proposalCandidatesById,
              fetchedCandidatesById,
            ),
          };
        });
      });

    const fetchNounsByIds = async (chainId, ids) =>
      NounsSubgraph.fetchNounsByIds(chainId, ids).then(
        ({ nouns, events, auctions }) => {
          set((s) => {
            const eventsByNounId = arrayUtils.groupBy((e) => e.nounId, events);
            const auctionsByNounId = arrayUtils.groupBy((e) => e.id, auctions);
            nouns.forEach((n) => {
              const events = eventsByNounId[n.id] ?? [];
              n.events = events;
              n.auction = auctionsByNounId[n.id]?.[0];
            });

            return {
              nounsById: {
                ...s.nounsById,
                ...arrayUtils.indexBy((n) => n.id, nouns),
              },
            };
          });
        },
      );

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
          client.getEnsAddress({
            name: normalizeEnsName(name),
          });

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
      fetchProposals,
      fetchProposal: (chainId, id) =>
        NounsSubgraph.fetchProposal(chainId, id).then((proposal) => {
          // Fetch candidate async
          if (proposal.candidateId != null)
            fetchProposalCandidate(chainId, proposal.candidateId);

          set((s) => ({
            proposalsById: {
              ...s.proposalsById,
              [id]: mergeProposals(s.proposalsById[id], proposal),
            },
          }));
        }),
      fetchActiveProposals: (chainId, ...args) =>
        NounsSubgraph.fetchActiveProposals(chainId, ...args).then(
          (proposals) => {
            set((s) => {
              const fetchedProposalsById = arrayUtils.indexBy(
                (p) => p.id,
                proposals,
              );

              return {
                proposalsById: objectUtils.merge(
                  mergeProposals,
                  s.proposalsById,
                  fetchedProposalsById,
                ),
              };
            });
          },
        ),
      fetchProposalCandidate,
      fetchProposalCandidates,
      fetchDelegates: (chainId, client, options) =>
        NounsSubgraph.fetchDelegates(chainId, options).then((delegates) => {
          const delegatesById = arrayUtils.indexBy(
            (d) => d.id.toLowerCase(),
            delegates,
          );
          const nounsById = arrayUtils.indexBy(
            (n) => n.id,
            delegates.flatMap((d) => d.nounsRepresented),
          );

          set((s) => ({
            delegatesById: objectUtils.merge(
              mergeDelegates,
              s.delegatesById,
              delegatesById,
            ),
            nounsById: objectUtils.merge(
              (n1, n2) => ({ ...n1, ...n2 }),
              s.nounsById,
              nounsById,
            ),
          }));

          reverseResolveEnsAddresses(
            client,
            delegates.map((d) => d.id),
          );

          return delegates;
        }),
      fetchDelegate: (chainId, id) =>
        NounsSubgraph.fetchDelegate(chainId, id).then((delegate) => {
          const createdProposalsById = arrayUtils.indexBy(
            (p) => p.id,
            delegate.proposals,
          );

          const nounIds = arrayUtils.unique(
            delegate.nounsRepresented.map((n) => n.id),
          );

          // fetch nouns async ...
          fetchNounsByIds(chainId, nounIds);

          set((s) => ({
            delegatesById: {
              ...s.delegatesById,
              [id.toLowerCase()]: delegate,
            },
            proposalsById: objectUtils.merge(
              mergeProposals,
              s.proposalsById,
              createdProposalsById,
            ),
          }));
        }),
      fetchAccount: (chainId, id) =>
        NounsSubgraph.fetchAccount(chainId, id).then((account) => {
          const nounIds = arrayUtils.unique(account.nouns.map((n) => n.id));

          // fetch nouns async ...
          fetchNounsByIds(chainId, nounIds);

          set((s) => ({
            accountsById: {
              ...s.accountsById,
              [id?.toLowerCase()]: account,
            },
          }));
        }),
      fetchNoun: (chainId, id) => fetchNounsByIds(chainId, [id]),
      fetchProposalCandidatesByAccount: (chainId, accountAddress) =>
        NounsSubgraph.fetchProposalCandidatesByAccount(
          chainId,
          accountAddress,
        ).then((candidates) => {
          const fetchedCandidatesById = arrayUtils.indexBy(
            (p) => p.id.toLowerCase(),
            candidates,
          );
          set((s) => ({
            proposalCandidatesById: objectUtils.merge(
              mergeProposalCandidates,
              s.proposalCandidatesById,
              fetchedCandidatesById,
            ),
          }));
        }),
      fetchBrowseScreenData: (chainId, client, options) =>
        NounsSubgraph.fetchBrowseScreenData(chainId, options).then(
          ({ proposals, candidates }) => {
            // Populate ENS cache async
            const addresses = [];

            for (const p of proposals)
              addresses.push(
                p.proposerId,
                ...(p.signers ?? []).map((s) => s.id),
              );

            for (const c of candidates)
              addresses.push(
                c.proposerId,
                ...(c.latestVersion?.content.contentSignatures ?? []).map(
                  (s) => s.signer.id,
                ),
              );

            reverseResolveEnsAddresses(client, arrayUtils.unique(addresses));

            // Fetch less urgent data async
            NounsSubgraph.fetchBrowseScreenSecondaryData(chainId, {
              proposalIds: proposals.map((p) => p.id),
              candidateIds: candidates.map((c) => c.id),
            }).then(
              ({
                proposals,
                proposalVersions,
                candidateVersions,
                candidateFeedbacks,
              }) => {
                const proposalsById = arrayUtils.indexBy(
                  (p) => p.id,
                  proposals,
                );

                const fetchedProposalVersionsByProposalId = arrayUtils.groupBy(
                  (v) => v.proposalId,
                  proposalVersions,
                );
                const fetchedProposalsWithVersionsById = objectUtils.mapValues(
                  (versions, id) => ({ id, versions }),
                  fetchedProposalVersionsByProposalId,
                );

                const fetchedCandidateVersionsByCandidateId =
                  arrayUtils.groupBy((v) => v.candidateId, candidateVersions);

                const fetchedCandidatesWithVersionsById = objectUtils.mapValues(
                  (versions, id) => ({
                    id,
                    slug: extractSlugFromCandidateId(id),
                    versions,
                  }),
                  fetchedCandidateVersionsByCandidateId,
                );

                const feedbackPostsByCandidateId = arrayUtils.groupBy(
                  (p) => p.candidateId,
                  candidateFeedbacks,
                );
                const fetchedCandidatesWithFeedbacksById =
                  objectUtils.mapValues(
                    (feedbackPosts, id) => ({
                      id,
                      slug: extractSlugFromCandidateId(id),
                      feedbackPosts,
                    }),
                    feedbackPostsByCandidateId,
                  );

                set((s) => ({
                  proposalsById: objectUtils.merge(
                    mergeProposals,
                    s.proposalsById,
                    proposalsById,
                    fetchedProposalsWithVersionsById,
                  ),
                  proposalCandidatesById: objectUtils.merge(
                    mergeProposalCandidates,
                    s.proposalCandidatesById,
                    fetchedCandidatesWithVersionsById,
                    fetchedCandidatesWithFeedbacksById,
                  ),
                }));
              },
            );

            const fetchedProposalsById = arrayUtils.indexBy(
              (p) => p.id,
              proposals,
            );

            const fetchedCandidatesById = arrayUtils.indexBy(
              (p) => p.id.toLowerCase(),
              candidates,
            );

            set((s) => ({
              proposalsById: objectUtils.merge(
                mergeProposals,
                s.proposalsById,
                fetchedProposalsById,
              ),
              proposalCandidatesById: objectUtils.merge(
                mergeProposalCandidates,
                s.proposalCandidatesById,
                fetchedCandidatesById,
              ),
            }));
          },
        ),
      fetchVoterScreenData: (chainId, id, options) => {
        return Promise.all([
          NounsSubgraph.fetchVoterScreenData(chainId, id, options).then(
            ({
              proposals,
              candidates,
              votes,
              proposalFeedbackPosts,
              candidateFeedbackPosts,
              nouns,
            }) => {
              fetchProposalsVersions(
                chainId,
                proposals.map((p) => p.id),
              );

              const createdProposalsById = arrayUtils.indexBy(
                (p) => p.id,
                proposals,
              );

              const propIds = arrayUtils.unique(
                [...votes, ...proposalFeedbackPosts].map((p) => p.proposalId),
              );

              // Fetch proposals voted or commented on by voter
              fetchProposals(chainId, propIds);

              const createdCandidatesById = arrayUtils.indexBy(
                (p) => p.id.toLowerCase(),
                candidates,
              );

              // fetch feedback for voter's candies (candidates tab)
              fetchProposalCandidatesFeedbackPosts(
                chainId,
                candidates.map((c) => c.id.toLowerCase()),
              );

              const feedbackCandidateIds = arrayUtils.unique(
                candidateFeedbackPosts.map((p) => p.candidateId),
              );

              const postsByCandidateId = arrayUtils.groupBy(
                (p) => p.candidateId.toLowerCase(),
                candidateFeedbackPosts,
              );
              const newCandidatesById = objectUtils.mapValues(
                (feedbackPosts, candidateId) => ({
                  id: candidateId,
                  slug: extractSlugFromCandidateId(candidateId),
                  feedbackPosts,
                }),
                postsByCandidateId,
              );

              fetchProposalCandidates(chainId, feedbackCandidateIds);

              const nounIds = nouns.map((n) => n.id);

              // fetch nouns async ...
              fetchNounsByIds(chainId, nounIds);

              set((s) => ({
                proposalsById: objectUtils.merge(
                  mergeProposals,
                  s.proposalsById,
                  createdProposalsById,
                ),
                proposalCandidatesById: objectUtils.merge(
                  mergeProposalCandidates,
                  s.proposalCandidatesById,
                  createdCandidatesById,
                  newCandidatesById,
                ),
              }));
            },
          ),

          NounsSubgraph.fetchProposalCandidatesSponsoredByAccount(
            chainId,
            id,
          ).then((candidates) => {
            const fetchedCandidatesById = arrayUtils.indexBy(
              (c) => c.id.toLowerCase(),
              candidates,
            );

            const sponsoredProposalIds = arrayUtils.unique(
              candidates.map((c) => c.latestVersion?.proposalId),
            );

            fetchProposals(chainId, sponsoredProposalIds);

            set((s) => ({
              proposalCandidatesById: objectUtils.merge(
                mergeProposalCandidates,
                s.proposalCandidatesById,
                fetchedCandidatesById,
              ),
            }));
          }),

          PropdatesSubgraph.fetchPropdatesByAccount(chainId, id).then(
            (propdates) => {
              const proposalIds = arrayUtils.unique(
                propdates.map((p) => p.proposalId),
              );

              fetchProposals(chainId, proposalIds);

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
        ]);
      },
      fetchNounsActivity: (chainId, { startBlock, endBlock }) =>
        Promise.all([
          NounsSubgraph.fetchNounsActivity(chainId, { startBlock, endBlock }),
          PropdatesSubgraph.fetchPropdates(chainId, { startBlock, endBlock }),
        ]).then(
          ([
            { votes, proposalFeedbackPosts, candidateFeedbackPosts },
            propdates,
          ]) => {
            set((s) => {
              const postsByCandidateId = arrayUtils.groupBy(
                (p) => p.candidateId.toLowerCase(),
                candidateFeedbackPosts,
              );
              const newCandidatesById = objectUtils.mapValues(
                (feedbackPosts, candidateId) => ({
                  id: candidateId,
                  slug: extractSlugFromCandidateId(candidateId),
                  feedbackPosts,
                }),
                postsByCandidateId,
              );

              const feedbackPostsByProposalId = arrayUtils.groupBy(
                (p) => p.proposalId,
                proposalFeedbackPosts,
              );
              const votesByProposalId = arrayUtils.groupBy(
                (v) => v.proposalId,
                votes,
              );

              const proposalsWithNewFeedbackPostsById = objectUtils.mapValues(
                (feedbackPosts, proposalId) => ({
                  id: proposalId,
                  feedbackPosts,
                }),
                feedbackPostsByProposalId,
              );
              const proposalsWithNewVotesById = objectUtils.mapValues(
                (votes, proposalId) => ({
                  id: proposalId,
                  votes,
                }),
                votesByProposalId,
              );

              return {
                proposalsById: objectUtils.merge(
                  mergeProposals,
                  s.proposalsById,
                  proposalsWithNewFeedbackPostsById,
                  proposalsWithNewVotesById,
                ),
                proposalCandidatesById: objectUtils.merge(
                  mergeProposalCandidates,
                  s.proposalCandidatesById,
                  newCandidatesById,
                ),
                propdatesByProposalId: objectUtils.merge(
                  (ps1 = [], ps2 = []) =>
                    arrayUtils.unique(
                      (p1, p2) => p1.id === p2.id,
                      [...ps1, ...ps2],
                    ),
                  s.propdatesByProposalId,
                  arrayUtils.groupBy((d) => d.proposalId, propdates),
                ),
              };
            });
          },
        ),

      fetchVoterActivity: (chainId, voterAddress, { startBlock, endBlock }) =>
        NounsSubgraph.fetchVoterActivity(chainId, voterAddress, {
          startBlock,
          endBlock,
        }).then(({ votes, proposalFeedbackPosts, candidateFeedbackPosts }) => {
          const propIds = arrayUtils.unique(
            [...votes, ...proposalFeedbackPosts].map((p) => p.proposalId),
          );

          fetchProposals(chainId, propIds);

          const candidateIds = arrayUtils.unique(
            candidateFeedbackPosts.map((p) => p.candidateId),
          );

          fetchProposalCandidates(chainId, candidateIds);

          set((s) => {
            const postsByCandidateId = arrayUtils.groupBy(
              (p) => p.candidateId.toLowerCase(),
              candidateFeedbackPosts,
            );
            const newCandidatesById = objectUtils.mapValues(
              (feedbackPosts, candidateId) => ({
                id: candidateId,
                slug: extractSlugFromCandidateId(candidateId),
                feedbackPosts,
              }),
              postsByCandidateId,
            );

            const feedbackPostsByProposalId = arrayUtils.groupBy(
              (p) => p.proposalId,
              proposalFeedbackPosts,
            );
            const votesByProposalId = arrayUtils.groupBy(
              (v) => v.proposalId,
              votes,
            );

            const proposalsWithNewFeedbackPostsById = objectUtils.mapValues(
              (feedbackPosts, proposalId) => ({
                id: proposalId,
                feedbackPosts,
              }),
              feedbackPostsByProposalId,
            );
            const proposalsWithNewVotesById = objectUtils.mapValues(
              (votes, proposalId) => ({
                id: proposalId,
                votes,
              }),
              votesByProposalId,
            );

            return {
              proposalsById: objectUtils.merge(
                mergeProposals,
                s.proposalsById,
                proposalsWithNewFeedbackPostsById,
                proposalsWithNewVotesById,
              ),
              proposalCandidatesById: objectUtils.merge(
                mergeProposalCandidates,
                s.proposalCandidatesById,
                newCandidatesById,
              ),
            };
          });
        }),
      fetchPropdatesForProposal: (chainId, ...args) =>
        PropdatesSubgraph.fetchPropdatesForProposal(chainId, ...args).then(
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
  const storeRef = React.useRef();

  if (storeRef.current == null) {
    storeRef.current = createStore({ initialState });
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

export const useActions = () => {
  const chainId = useChainId();
  const publicClient = usePublicClient();

  const fetchProposal = useStore((s) => s.fetchProposal);
  const fetchProposals = useStore((s) => s.fetchProposals);
  const fetchActiveProposals = useStore((s) => s.fetchActiveProposals);
  const fetchProposalCandidate = useStore((s) => s.fetchProposalCandidate);
  const fetchProposalCandidates = useStore((s) => s.fetchProposalCandidates);
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
  const addOptimitisicCandidateFeedbackPost = useStore(
    (s) => s.addOptimitisicCandidateFeedbackPost,
  );

  return {
    fetchProposal: React.useCallback(
      (...args) => fetchProposal(chainId, ...args),
      [fetchProposal, chainId],
    ),
    fetchProposals: React.useCallback(
      (...args) => fetchProposals(chainId, ...args),
      [fetchProposals, chainId],
    ),
    fetchActiveProposals: React.useCallback(
      (...args) => fetchActiveProposals(chainId, ...args),
      [fetchActiveProposals, chainId],
    ),
    fetchProposalCandidate: React.useCallback(
      (...args) => fetchProposalCandidate(chainId, ...args),
      [fetchProposalCandidate, chainId],
    ),
    fetchProposalCandidates: React.useCallback(
      (...args) => fetchProposalCandidates(chainId, ...args),
      [fetchProposalCandidates, chainId],
    ),
    fetchDelegate: React.useCallback(
      (...args) => fetchDelegate(chainId, ...args),
      [fetchDelegate, chainId],
    ),
    fetchDelegates: React.useCallback(
      (...args) => fetchDelegates(chainId, publicClient, ...args),
      [fetchDelegates, chainId, publicClient],
    ),
    fetchAccount: React.useCallback(
      (...args) => fetchAccount(chainId, ...args),
      [fetchAccount, chainId],
    ),
    fetchNoun: React.useCallback(
      (...args) => fetchNoun(chainId, ...args),
      [fetchNoun, chainId],
    ),
    fetchProposalCandidatesByAccount: React.useCallback(
      (...args) => fetchProposalCandidatesByAccount(chainId, ...args),
      [fetchProposalCandidatesByAccount, chainId],
    ),
    fetchNounsActivity: React.useCallback(
      (...args) => fetchNounsActivity(chainId, ...args),
      [fetchNounsActivity, chainId],
    ),
    fetchVoterActivity: React.useCallback(
      (...args) => fetchVoterActivity(chainId, ...args),
      [fetchVoterActivity, chainId],
    ),
    fetchBrowseScreenData: React.useCallback(
      (...args) => fetchBrowseScreenData(chainId, publicClient, ...args),
      [fetchBrowseScreenData, chainId, publicClient],
    ),
    fetchVoterScreenData: React.useCallback(
      (...args) => fetchVoterScreenData(chainId, ...args),
      [fetchVoterScreenData, chainId],
    ),
    fetchPropdatesForProposal: React.useCallback(
      (...args) => fetchPropdatesForProposal(chainId, ...args),
      [fetchPropdatesForProposal, chainId],
    ),
    resolveEnsNames,
    reverseResolveEnsAddresses,
    addOptimitisicProposalVote,
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
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    cacheTime: 10_000,
  });
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
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    cacheTime: 10_000,
  });
  const { fetchActiveProposals } = useActions();
  useFetch(
    blockNumber == null ? undefined : () => fetchActiveProposals(blockNumber),
    [blockNumber, fetchActiveProposals],
  );
};

export const useProposalCandidateFetch = (id, options) => {
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    cacheTime: 10_000,
  });
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
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    cacheTime: 20_000,
  });

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
  const { data: blockNumber } = useBlockNumber({ watch, cacheTime: 10_000 });

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
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    cacheTime: 30_000,
  });

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
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    cacheTime: 30_000,
  });

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

  return arrayUtils.sortBy((n) => parseInt(n.id), uniqueNouns);
};

export const useAccount = (id) =>
  useStore(React.useCallback((s) => s.accountsById[id?.toLowerCase()], [id]));

export const useAccountFetch = (id, options) => {
  const onError = useLatestCallback(options?.onError);

  const { fetchAccount } = useActions();

  useFetch(
    id == null
      ? null
      : () =>
          fetchAccount(id).catch((e) => {
            if (onError == null) return Promise.reject(e);
            onError(e);
          }),
    { fetchInterval: options?.fetchInterval },
    [fetchAccount, id, onError],
  );
};

export const usePropdates = () =>
  useStore((s) => Object.values(s.propdatesByProposalId).flatMap((ps) => ps));

export const useEnsCache = () =>
  useStore((s) => ({
    nameByAddress: s.ensNameByAddress,
    addressByName: s.ensAddressByName,
  }));
