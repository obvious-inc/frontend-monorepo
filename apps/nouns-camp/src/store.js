import React from "react";
import { create as createZustandStoreHook } from "zustand";
import { useBlockNumber } from "wagmi";
import { useFetch, useLatestCallback } from "@shades/common/react";
import {
  array as arrayUtils,
  object as objectUtils,
} from "@shades/common/utils";
import { getState as getProposalState } from "./utils/proposals.js";
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

  return {
    delegatesById: {},
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
    fetchProposalCandidate,
    fetchProposalCandidates,
    fetchDelegates: (chainId) =>
      NounsSubgraph.fetchDelegates(chainId).then((delegates) => {
        set((s) => ({
          delegatesById: {
            ...s.delegatesById,
            ...arrayUtils.indexBy((d) => d.id, delegates),
          },
        }));
      }),
    fetchDelegate: (chainId, id) =>
      NounsSubgraph.fetchDelegate(chainId, id).then((delegate) => {
        const createdProposalsById = arrayUtils.indexBy(
          (p) => p.id,
          delegate.proposals
        );

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
        }) => {
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
  const fetchProposalCandidate = useStore((s) => s.fetchProposalCandidate);
  const fetchProposalCandidates = useStore((s) => s.fetchProposalCandidates);
  const fetchDelegates = useStore((s) => s.fetchDelegates);
  const fetchDelegate = useStore((s) => s.fetchDelegate);
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

export const useProposals = ({ state = false, propdates = false } = {}) => {
  const { data: blockNumber } = useBlockNumber({
    watch: true,
    cacheTime: 20_000,
  });

  return useStore(
    React.useCallback(
      (s) => {
        const useSelector = state || propdates;

        const select = (p_) => {
          const p = { ...p_ };

          if (state)
            p.state =
              blockNumber == null ? null : getProposalState(p, { blockNumber });

          if (propdates) p.propdates = s.propdatesByProposalId[p.id];

          return p;
        };

        const proposals = useSelector
          ? Object.values(s.proposalsById).map(select)
          : Object.values(s.proposalsById);

        return arrayUtils.sortBy((p) => p.lastUpdatedTimestamp, proposals);
      },
      [state, blockNumber, propdates]
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

  const proposerDelegateNounIds =
    proposerDelegate?.nounsRepresented.map((n) => n.id) ?? [];

  const validSignatures = getCandidateSponsorSignatures(candidate, {
    excludeInvalid: true,
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
