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
  getValidSponsorSignatures as getValidCandidateSponsorSignature,
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
    fetchDelegates: (chainId) =>
      NounsSubgraph.fetchDelegates(chainId).then((delegates) => {
        set(() => ({
          delegatesById: arrayUtils.indexBy((d) => d.id, delegates),
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
  const fetchProposalCandidate = useStore((s) => s.fetchProposalCandidate);
  const fetchDelegates = useStore((s) => s.fetchDelegates);
  const fetchNounsActivity = useStore((s) => s.fetchNounsActivity);
  const fetchBrowseScreenData = useStore((s) => s.fetchBrowseScreenData);
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
    fetchProposalCandidate: React.useCallback(
      (...args) => fetchProposalCandidate(chainId, ...args),
      [fetchProposalCandidate, chainId]
    ),
    fetchDelegates: React.useCallback(
      (...args) => fetchDelegates(chainId, ...args),
      [fetchDelegates, chainId]
    ),
    fetchNounsActivity: React.useCallback(
      (...args) => fetchNounsActivity(chainId, ...args),
      [fetchNounsActivity, chainId]
    ),
    fetchBrowseScreenData: React.useCallback(
      (...args) => fetchBrowseScreenData(chainId, ...args),
      [fetchBrowseScreenData, chainId]
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

export const useProposalCandidates = () => {
  const candidatesById = useStore((s) => s.proposalCandidatesById);
  return React.useMemo(() => {
    const candidates = Object.values(candidatesById);
    // Exclude canceled candidates as well as those with a matching proposal
    const filteredCandidates = candidates.filter(
      (c) => c.canceledTimestamp == null && c.latestVersion?.proposalId == null
    );
    return arrayUtils.sortBy(
      { value: (p) => p.lastUpdatedTimestamp, order: "desc" },
      filteredCandidates
    );
  }, [candidatesById]);
};

export const useProposalCandidateVotingPower = (candidateId) => {
  const candidate = useProposalCandidate(candidateId);
  const proposerDelegate = useDelegate(candidate.proposerId);

  const proposerDelegateNounIds =
    proposerDelegate?.nounsRepresented.map((n) => n.id) ?? [];

  const validSignatures = getValidCandidateSponsorSignature(candidate);

  const sponsoringNounIds = arrayUtils.unique(
    validSignatures.flatMap((s) => s.signer.nounsRepresented.map((n) => n.id))
  );

  const candidateVotingPower = arrayUtils.unique([
    ...sponsoringNounIds,
    ...proposerDelegateNounIds,
  ]).length;

  return candidateVotingPower;
};
