import React from "react";
import { create as createZustandStoreHook } from "zustand";
import { useBlockNumber } from "wagmi";
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
      [...p1.feedbackPosts, ...p2.feedbackPosts]
    );

  if (p1.votes != null && p2.votes != null)
    mergedProposal.votes = arrayUtils.unique(
      (v1, v2) => {
        if (v1.id === v2.id) return true;
        if (!v1.isPending) return false;
        return v1.voterId.toLowerCase() === v2.voterId.toLowerCase();
      },
      // p2 has to be first here to take precedence
      [...p2.votes, ...p1.votes]
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
            .toLowerCase()
        );
        return compositeId1 === compositeId2;
      },
      // p2 has to be first here to take precedence
      [...p2.feedbackPosts, ...p1.feedbackPosts]
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

const useStore = createZustandStoreHook((set) => {
  const fetchProposalsVersions = async (chainId, proposalIds) =>
    NounsSubgraph.fetchProposalsVersions(chainId, proposalIds).then(
      (versions) => {
        set((s) => {
          const versionsByProposalId = arrayUtils.groupBy(
            (v) => v.proposalId,
            versions
          );
          const fetchedProposalsById = objectUtils.mapValues(
            (versions, id) => ({ id, versions }),
            versionsByProposalId
          );

          return {
            proposalsById: objectUtils.merge(
              mergeProposals,
              s.proposalsById,
              fetchedProposalsById
            ),
          };
        });
      }
    );

  const fetchProposalCandidatesFeedbackPosts = async (chainId, candidateIds) =>
    NounsSubgraph.fetchProposalCandidatesFeedbackPosts(
      chainId,
      candidateIds
    ).then((feedbackPosts) => {
      set((s) => {
        const feedbackPostsByCandidateId = arrayUtils.groupBy(
          (p) => p.candidateId,
          feedbackPosts
        );
        const fetchedCandidatesById = objectUtils.mapValues(
          (feedbackPosts, id) => ({
            id,
            slug: extractSlugFromCandidateId(id),
            feedbackPosts,
          }),

          feedbackPostsByCandidateId
        );

        return {
          proposalCandidatesById: objectUtils.merge(
            mergeProposalCandidates,
            s.proposalCandidatesById,
            fetchedCandidatesById
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
            candidate
          ),
        },
      }));
    });

  const fetchProposals = async (chainId, ids) =>
    NounsSubgraph.fetchProposals(chainId, ids).then((proposals) => {
      set((s) => {
        const fetchedProposalsById = arrayUtils.indexBy((p) => p.id, proposals);

        return {
          proposalsById: objectUtils.merge(
            mergeProposals,
            s.proposalsById,
            fetchedProposalsById
          ),
        };
      });
    });

  const fetchProposalCandidates = async (chainId, ids) =>
    NounsSubgraph.fetchProposalCandidates(chainId, ids).then((candidates) => {
      set((s) => {
        const fetchedCandidatesById = arrayUtils.indexBy(
          (p) => p.id.toLowerCase(),
          candidates
        );

        return {
          proposalCandidatesById: objectUtils.merge(
            mergeProposalCandidates,
            s.proposalCandidatesById,
            fetchedCandidatesById
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
      }
    );

  return {
    accountsById: {},
    delegatesById: {},
    nounsById: {},
    proposalsById: {},
    proposalCandidatesById: {},
    propdatesByProposalId: {},

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

    // Actions
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
      NounsSubgraph.fetchActiveProposals(chainId, ...args).then((proposals) => {
        set((s) => {
          const fetchedProposalsById = arrayUtils.indexBy(
            (p) => p.id,
            proposals
          );

          return {
            proposalsById: objectUtils.merge(
              mergeProposals,
              s.proposalsById,
              fetchedProposalsById
            ),
          };
        });
      }),
    fetchProposalCandidate,
    fetchProposalCandidates,
    fetchDelegates: (chainId, optionalAccountIds) =>
      NounsSubgraph.fetchDelegates(chainId, optionalAccountIds).then(
        (delegates) => {
          const fetchedProposals = delegates.flatMap((d) => d.proposals);
          const fetchedVotes = delegates.flatMap((d) => d.votes);

          const fetchedProposalsById = arrayUtils.indexBy(
            (p) => p.id,
            fetchedProposals
          );

          const votesByProposalId = arrayUtils.groupBy(
            (v) => v.proposalId,
            fetchedVotes
          );

          const fetchedProposalsWithNewVotesById = objectUtils.mapValues(
            (votes, proposalId) => ({
              id: proposalId,
              votes,
            }),
            votesByProposalId
          );

          set((s) => ({
            delegatesById: {
              ...s.delegatesById,
              ...arrayUtils.indexBy((d) => d.id, delegates),
            },
            proposalsById: objectUtils.merge(
              mergeProposals,
              s.proposalsById,
              fetchedProposalsById,
              fetchedProposalsWithNewVotesById
            ),
          }));
        }
      ),
    fetchDelegate: (chainId, id) =>
      NounsSubgraph.fetchDelegate(chainId, id).then((delegate) => {
        const createdProposalsById = arrayUtils.indexBy(
          (p) => p.id,
          delegate.proposals
        );

        const nounIds = arrayUtils.unique(
          delegate.nounsRepresented.map((n) => n.id)
        );

        // fetch nouns async ...
        fetchNounsByIds(chainId, nounIds);

        set((s) => ({
          delegatesById: {
            ...s.delegatesById,
            [id?.toLowerCase()]: delegate,
          },
          proposalsById: objectUtils.merge(
            mergeProposals,
            s.proposalsById,
            createdProposalsById
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
        accountAddress
      ).then((candidates) => {
        const fetchedCandidatesById = arrayUtils.indexBy(
          (p) => p.id.toLowerCase(),
          candidates
        );
        set((s) => ({
          proposalCandidatesById: objectUtils.merge(
            mergeProposalCandidates,
            s.proposalCandidatesById,
            fetchedCandidatesById
          ),
        }));
      }),
    fetchBrowseScreenData: (chainId, options) =>
      NounsSubgraph.fetchBrowseScreenData(chainId, options).then(
        ({ proposals, candidates }) => {
          // Fetch proposal versions async
          fetchProposalsVersions(
            chainId,
            proposals.map((p) => p.id)
          );

          // Fetch candidate feedback async
          fetchProposalCandidatesFeedbackPosts(
            chainId,
            candidates.map((c) => c.id)
          );

          const fetchedProposalsById = arrayUtils.indexBy(
            (p) => p.id,
            proposals
          );

          const fetchedCandidatesById = arrayUtils.indexBy(
            (p) => p.id.toLowerCase(),
            candidates
          );

          set((s) => ({
            proposalsById: objectUtils.merge(
              mergeProposals,
              s.proposalsById,
              fetchedProposalsById
            ),
            proposalCandidatesById: objectUtils.merge(
              mergeProposalCandidates,
              s.proposalCandidatesById,
              fetchedCandidatesById
            ),
          }));
        }
      ),
    fetchVoterScreenData: (chainId, id, options) => {
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
            proposals.map((p) => p.id)
          );

          const createdProposalsById = arrayUtils.indexBy(
            (p) => p.id,
            proposals
          );

          const propIds = arrayUtils.unique(
            [...votes, ...proposalFeedbackPosts].map((p) => p.proposalId)
          );

          // Fetch proposals voted or commented on by voter
          fetchProposals(chainId, propIds);

          const createdCandidatesById = arrayUtils.indexBy(
            (p) => p.id.toLowerCase(),
            candidates
          );

          // fetch feedback for voter's candies (candidates tab)
          fetchProposalCandidatesFeedbackPosts(
            chainId,
            candidates.map((c) => c.id.toLowerCase())
          );

          const feedbackCandidateIds = arrayUtils.unique(
            candidateFeedbackPosts.map((p) => p.candidateId)
          );

          const postsByCandidateId = arrayUtils.groupBy(
            (p) => p.candidateId.toLowerCase(),
            candidateFeedbackPosts
          );
          const newCandidatesById = objectUtils.mapValues(
            (feedbackPosts, candidateId) => ({
              id: candidateId,
              slug: extractSlugFromCandidateId(candidateId),
              feedbackPosts,
            }),
            postsByCandidateId
          );

          fetchProposalCandidates(chainId, feedbackCandidateIds);

          const nounIds = nouns.map((n) => n.id);

          // fetch nouns async ...
          fetchNounsByIds(chainId, nounIds);

          set((s) => ({
            proposalsById: objectUtils.merge(
              mergeProposals,
              s.proposalsById,
              createdProposalsById
            ),
            proposalCandidatesById: objectUtils.merge(
              mergeProposalCandidates,
              s.proposalCandidatesById,
              createdCandidatesById,
              newCandidatesById
            ),
          }));
        }
      );

      NounsSubgraph.fetchProposalCandidatesSponsoredByAccount(chainId, id).then(
        (candidates) => {
          const fetchedCandidatesById = arrayUtils.indexBy(
            (c) => c.id.toLowerCase(),
            candidates
          );

          const sponsoredProposalIds = arrayUtils.unique(
            candidates.map((c) => c.latestVersion?.proposalId)
          );

          fetchProposals(chainId, sponsoredProposalIds);

          set((s) => ({
            proposalCandidatesById: objectUtils.merge(
              mergeProposalCandidates,
              s.proposalCandidatesById,
              fetchedCandidatesById
            ),
          }));
        }
      );

      PropdatesSubgraph.fetchPropdatesByAccount(id).then((propdates) => {
        const proposalIds = arrayUtils.unique(
          propdates.map((p) => p.proposalId)
        );

        fetchProposals(chainId, proposalIds);

        set(() => ({
          propdatesByProposalId: arrayUtils.groupBy(
            (d) => d.proposalId,
            propdates
          ),
        }));
      });
    },
    fetchNounsActivity: (chainId, { startBlock, endBlock }) =>
      NounsSubgraph.fetchNounsActivity(chainId, { startBlock, endBlock }).then(
        ({ votes, proposalFeedbackPosts, candidateFeedbackPosts }) => {
          set((s) => {
            const postsByCandidateId = arrayUtils.groupBy(
              (p) => p.candidateId.toLowerCase(),
              candidateFeedbackPosts
            );
            const newCandidatesById = objectUtils.mapValues(
              (feedbackPosts, candidateId) => ({
                id: candidateId,
                slug: extractSlugFromCandidateId(candidateId),
                feedbackPosts,
              }),
              postsByCandidateId
            );

            const feedbackPostsByProposalId = arrayUtils.groupBy(
              (p) => p.proposalId,
              proposalFeedbackPosts
            );
            const votesByProposalId = arrayUtils.groupBy(
              (v) => v.proposalId,
              votes
            );

            const proposalsWithNewFeedbackPostsById = objectUtils.mapValues(
              (feedbackPosts, proposalId) => ({
                id: proposalId,
                feedbackPosts,
              }),
              feedbackPostsByProposalId
            );
            const proposalsWithNewVotesById = objectUtils.mapValues(
              (votes, proposalId) => ({
                id: proposalId,
                votes,
              }),
              votesByProposalId
            );

            return {
              proposalsById: objectUtils.merge(
                mergeProposals,
                s.proposalsById,
                proposalsWithNewFeedbackPostsById,
                proposalsWithNewVotesById
              ),
              proposalCandidatesById: objectUtils.merge(
                mergeProposalCandidates,
                s.proposalCandidatesById,
                newCandidatesById
              ),
            };
          });
        }
      ),

    fetchVoterActivity: (chainId, voterAddress, { startBlock, endBlock }) =>
      NounsSubgraph.fetchVoterActivity(chainId, voterAddress, {
        startBlock,
        endBlock,
      }).then(({ votes, proposalFeedbackPosts, candidateFeedbackPosts }) => {
        const propIds = arrayUtils.unique(
          [...votes, ...proposalFeedbackPosts].map((p) => p.proposalId)
        );

        fetchProposals(chainId, propIds);

        const candidateIds = arrayUtils.unique(
          candidateFeedbackPosts.map((p) => p.candidateId)
        );

        fetchProposalCandidates(chainId, candidateIds);

        set((s) => {
          const postsByCandidateId = arrayUtils.groupBy(
            (p) => p.candidateId.toLowerCase(),
            candidateFeedbackPosts
          );
          const newCandidatesById = objectUtils.mapValues(
            (feedbackPosts, candidateId) => ({
              id: candidateId,
              slug: extractSlugFromCandidateId(candidateId),
              feedbackPosts,
            }),
            postsByCandidateId
          );

          const feedbackPostsByProposalId = arrayUtils.groupBy(
            (p) => p.proposalId,
            proposalFeedbackPosts
          );
          const votesByProposalId = arrayUtils.groupBy(
            (v) => v.proposalId,
            votes
          );

          const proposalsWithNewFeedbackPostsById = objectUtils.mapValues(
            (feedbackPosts, proposalId) => ({
              id: proposalId,
              feedbackPosts,
            }),
            feedbackPostsByProposalId
          );
          const proposalsWithNewVotesById = objectUtils.mapValues(
            (votes, proposalId) => ({
              id: proposalId,
              votes,
            }),
            votesByProposalId
          );

          return {
            proposalsById: objectUtils.merge(
              mergeProposals,
              s.proposalsById,
              proposalsWithNewFeedbackPostsById,
              proposalsWithNewVotesById
            ),
            proposalCandidatesById: objectUtils.merge(
              mergeProposalCandidates,
              s.proposalCandidatesById,
              newCandidatesById
            ),
          };
        });
      }),
    fetchPropdates: (proposalId) =>
      PropdatesSubgraph.fetchPropdates(proposalId).then((propdates) => {
        set(() => ({
          propdatesByProposalId: arrayUtils.groupBy(
            (d) => d.proposalId,
            propdates
          ),
        }));
      }),
  };
});

export const useActions = () => {
  const chainId = useChainId();
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
    (s) => s.fetchProposalCandidatesByAccount
  );
  const fetchNounsActivity = useStore((s) => s.fetchNounsActivity);
  const fetchVoterActivity = useStore((s) => s.fetchVoterActivity);
  const fetchBrowseScreenData = useStore((s) => s.fetchBrowseScreenData);
  const fetchVoterScreenData = useStore((s) => s.fetchVoterScreenData);
  const fetchPropdates = useStore((s) => s.fetchPropdates);
  const addOptimitisicProposalVote = useStore(
    (s) => s.addOptimitisicProposalVote
  );
  const addOptimitisicCandidateFeedbackPost = useStore(
    (s) => s.addOptimitisicCandidateFeedbackPost
  );

  return {
    fetchProposal: React.useCallback(
      (...args) => fetchProposal(chainId, ...args),
      [fetchProposal, chainId]
    ),
    fetchProposals: React.useCallback(
      (...args) => fetchProposals(chainId, ...args),
      [fetchProposals, chainId]
    ),
    fetchActiveProposals: React.useCallback(
      (...args) => fetchActiveProposals(chainId, ...args),
      [fetchActiveProposals, chainId]
    ),
    fetchProposalCandidate: React.useCallback(
      (...args) => fetchProposalCandidate(chainId, ...args),
      [fetchProposalCandidate, chainId]
    ),
    fetchProposalCandidates: React.useCallback(
      (...args) => fetchProposalCandidates(chainId, ...args),
      [fetchProposalCandidates, chainId]
    ),
    fetchDelegate: React.useCallback(
      (...args) => fetchDelegate(chainId, ...args),
      [fetchDelegate, chainId]
    ),
    fetchDelegates: React.useCallback(
      (...args) => fetchDelegates(chainId, ...args),
      [fetchDelegates, chainId]
    ),
    fetchAccount: React.useCallback(
      (...args) => fetchAccount(chainId, ...args),
      [fetchAccount, chainId]
    ),
    fetchNoun: React.useCallback(
      (...args) => fetchNoun(chainId, ...args),
      [fetchNoun, chainId]
    ),
    fetchProposalCandidatesByAccount: React.useCallback(
      (...args) => fetchProposalCandidatesByAccount(chainId, ...args),
      [fetchProposalCandidatesByAccount, chainId]
    ),
    fetchNounsActivity: React.useCallback(
      (...args) => fetchNounsActivity(chainId, ...args),
      [fetchNounsActivity, chainId]
    ),
    fetchVoterActivity: React.useCallback(
      (...args) => fetchVoterActivity(chainId, ...args),
      [fetchVoterActivity, chainId]
    ),
    fetchBrowseScreenData: React.useCallback(
      (...args) => fetchBrowseScreenData(chainId, ...args),
      [fetchBrowseScreenData, chainId]
    ),
    fetchVoterScreenData: React.useCallback(
      (...args) => fetchVoterScreenData(chainId, ...args),
      [fetchVoterScreenData, chainId]
    ),
    fetchPropdates,
    addOptimitisicProposalVote,
    addOptimitisicCandidateFeedbackPost,
  };
};

export const useDelegate = (id) =>
  useStore(React.useCallback((s) => s.delegatesById[id?.toLowerCase()], [id]));

export const useDelegatesFetch = () => {
  const { fetchDelegates } = useActions();
  useFetch(() => fetchDelegates(), [fetchDelegates]);
};

export const useDelegateFetch = (id, options) => {
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    cacheTime: 10_000,
  });
  const onError = useLatestCallback(options?.onError);

  const { fetchDelegate } = useActions();

  useFetch(
    () =>
      fetchDelegate(id).catch((e) => {
        if (onError == null) return Promise.reject(e);
        onError(e);
      }),
    [fetchDelegate, id, onError, blockNumber]
  );
};

export const useProposalFetch = (id, options) => {
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    cacheTime: 10_000,
  });
  const onError = useLatestCallback(options?.onError);

  const { fetchProposal, fetchPropdates } = useActions();

  useFetch(
    () =>
      fetchProposal(id).catch((e) => {
        if (onError == null) return Promise.reject(e);
        onError(e);
      }),
    [fetchProposal, id, onError, blockNumber]
  );

  useFetch(() => fetchPropdates(id), [fetchPropdates, id]);
};

export const useActiveProposalsFetch = () => {
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    cacheTime: 10_000,
  });
  const { fetchActiveProposals } = useActions();
  useFetch(
    blockNumber == null ? undefined : () => fetchActiveProposals(blockNumber),
    [blockNumber, fetchActiveProposals]
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
    [fetchProposalCandidate, id, onError, blockNumber]
  );
};

export const useProposalCandidate = (id) =>
  useStore(
    React.useCallback(
      (s) => (id == null ? null : s.proposalCandidatesById[id.toLowerCase()]),
      [id]
    )
  );

const selectProposal = (
  store,
  proposalId,
  { state = false, propdates = false, blockNumber } = {}
) => {
  const p_ = store.proposalsById[proposalId];

  if (p_ == null) return null;

  if (!state && !propdates) return p_;

  const p = { ...p_ };

  if (state)
    p.state = blockNumber == null ? null : getProposalState(p, { blockNumber });

  if (propdates) p.propdates = store.propdatesByProposalId[p.id];

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
      [state, blockNumber, propdates, filter]
    )
  );
};

export const useProposal = (id) => {
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    cacheTime: 30_000,
  });

  return useStore(
    React.useCallback(
      (s) => {
        const proposal = s.proposalsById[id];

        if (proposal == null) return null;
        if (blockNumber == null) return proposal;

        return {
          ...proposal,
          state: getProposalState(proposal, { blockNumber }),
          propdates: s.propdatesByProposalId[id],
        };
      },
      [id, blockNumber]
    )
  );
};

export const useProposalCandidates = ({
  includeCanceled = false,
  includePromoted = false,
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

      // Filter candidates with a with a matching proposal
      if (c.latestVersion?.proposalId != null) return includePromoted;

      if (c.latestVersion?.targetProposalId == null || includePromoted)
        return true;

      const targetProposal = proposalsById[c.latestVersion.targetProposalId];

      // Exlude candidates with a target proposal past its update period end block
      return (
        targetProposal != null &&
        targetProposal.updatePeriodEndBlock > blockNumber
      );
    });

    return arrayUtils.sortBy(
      { value: (p) => p.lastUpdatedTimestamp, order: "desc" },
      filteredCandidates
    );
  }, [
    candidatesById,
    proposalsById,
    blockNumber,
    includeCanceled,
    includePromoted,
  ]);
};

export const useAccountProposalCandidates = (accountAddress) => {
  const candidatesById = useStore((s) => s.proposalCandidatesById);

  return React.useMemo(() => {
    const candidates = Object.values(candidatesById);
    return candidates.filter(
      (c) => c.proposerId?.toLowerCase() === accountAddress.toLowerCase()
    );
  }, [candidatesById, accountAddress]);
};

export const useProposalCandidateVotingPower = (candidateId) => {
  const candidate = useProposalCandidate(candidateId);
  const proposerDelegate = useDelegate(candidate.proposerId);
  const activeProposerIds = useProposals({ filter: "active" }).map(
    (p) => p.proposerId
  );

  const proposerDelegateNounIds =
    proposerDelegate?.nounsRepresented.map((n) => n.id) ?? [];

  const validSignatures = getCandidateSponsorSignatures(candidate, {
    excludeInvalid: true,
    activeProposerIds,
  });

  const sponsoringNounIds = arrayUtils.unique(
    validSignatures.flatMap((s) => s.signer.nounsRepresented.map((n) => n.id))
  );

  const candidateVotingPower = arrayUtils.unique([
    ...sponsoringNounIds,
    ...proposerDelegateNounIds,
  ]).length;

  return candidateVotingPower;
};

export const useNoun = (id) =>
  useStore(React.useCallback((s) => s.nounsById[id], [id]));

export const useAllNounsByAccount = (accountAddress) => {
  const delegatedNouns = useStore(
    (s) => s.delegatesById[accountAddress.toLowerCase()]?.nounsRepresented ?? []
  );

  const ownedNouns = useStore(
    (s) => s.accountsById[accountAddress.toLowerCase()]?.nouns ?? []
  );

  const uniqueNouns = arrayUtils.unique(
    (n1, n2) => n1.id === n2.id,
    [...delegatedNouns, ...ownedNouns]
  );

  return arrayUtils.sortBy((n) => parseInt(n.id), uniqueNouns);
};

export const useAccount = (id) =>
  useStore(React.useCallback((s) => s.accountsById[id?.toLowerCase()], [id]));

export const useAccountFetch = (id, options) => {
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    cacheTime: 10_000,
  });
  const onError = useLatestCallback(options?.onError);

  const { fetchAccount } = useActions();

  useFetch(
    () =>
      fetchAccount(id).catch((e) => {
        if (onError == null) return Promise.reject(e);
        onError(e);
      }),
    [fetchAccount, id, onError, blockNumber]
  );
};

export const useProposalsSponsoredByAccount = (accountAddress) => {
  const candidatesById = useStore((s) => s.proposalCandidatesById);
  const sponsoredCandidates = Object.values(candidatesById).filter((c) =>
    getCandidateSponsorSignatures(c, {
      excludeInvalid: true,
      activeProposerIds: [],
    }).some((s) => s.signer.id.toLowerCase() === accountAddress.toLowerCase())
  );

  const sponsoredProposalIds = arrayUtils.unique(
    sponsoredCandidates.map((c) => c.latestVersion?.proposalId)
  );

  const proposalsById = useStore((s) => s.proposalsById);

  return arrayUtils.sortBy(
    { value: (p) => p.lastUpdatedTimestamp, order: "desc" },
    sponsoredProposalIds.map((id) => proposalsById[id]).filter(Boolean)
  );
};
