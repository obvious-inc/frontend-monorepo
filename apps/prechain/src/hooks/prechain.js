import React from "react";
import { parseAbi, parseEther } from "viem";
import {
  usePublicClient,
  useContractWrite,
  usePrepareContractWrite,
} from "wagmi";
import {
  useActions as useNomActions,
  usePublicChannels,
} from "@shades/common/app";
import { useFetch } from "@shades/common/react";
import {
  array as arrayUtils,
  object as objectUtils,
} from "@shades/common/utils";

const { indexBy, sortBy } = arrayUtils;
const { mapValues } = objectUtils;

// const SEPOLIA_NOUNS_DAO_CONTACT = "0x35d2670d7C8931AACdd37C89Ddcb0638c3c44A57";
const SEPOLIA_NOUNS_DATA_CONTACT = "0x9040f720AA8A693F950B9cF94764b4b06079D002";

const SUBGRAPH_ENDPOINT =
  "https://api.studio.thegraph.com/proxy/49498/nouns-v3-sepolia/v0.0.1";

const PROPOSALS_TAG = "prechain/1/proposal";

export const useActions = () => {
  const { fetchPubliclyReadableChannels, createOpenChannel } = useNomActions();

  const fetchChannels = React.useCallback(
    () => fetchPubliclyReadableChannels({ tags: [PROPOSALS_TAG] }),
    [fetchPubliclyReadableChannels]
  );

  const createChannel = React.useCallback(
    (properties) => createOpenChannel({ ...properties, tags: [PROPOSALS_TAG] }),
    [createOpenChannel]
  );

  return { fetchChannels, createChannel };
};

export const useChannels = (options) => {
  const channels = usePublicChannels(options);
  return React.useMemo(
    () =>
      channels.filter((c) => c.tags != null && c.tags.includes(PROPOSALS_TAG)),
    [channels]
  );
};

const PROPOSALS_QUERY = `{
  proposals {
    id
    description
    title
    status
    createdTimestamp
    proposer {
      id
    }
  }
}`;

const PROPOSAL_CANDIDATES_QUERY = `{
  proposalCandidates {
    id
    slug
    proposer
    latestVersion {
      title
      createdTimestamp
    }
  }
}`;

const createProposalQuery = (id) => `{
  proposal(id: "${id}") {
    id
    status
    title
    description
    createdTimestamp
    lastUpdatedTimestamp
    executionETA
    proposer {
      id
    }
    votes {
      id
      blockNumber
      reason
      support
      votes
      voter {
        id
      }
    }
    feedbackPosts {
      id
      reason
      createdTimestamp
      votes
      voter {
        id
      }
    }
  }
}`;

const createProposalCandidateQuery = (id) => `{
  proposalCandidate(id: "${id}") {
    id
    slug
    proposer
    latestVersion {
      title
      description
      createdTimestamp
      targets
      values
      signatures
      calldatas
    }
    versions {
      id
    }
  }
}`;

const ChainDataCacheContext = React.createContext();

const subgraphFetch = (query) =>
  fetch(SUBGRAPH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
    .then((res) => {
      if (res.ok) return res.json();
      return Promise.reject(new Error(res.statusText));
    })
    .then((body) => body.data);

const parseProposal = (data) => {
  const parsedData = { ...data };

  if (data.createdTimestamp != null)
    parsedData.createdTimestamp = new Date(
      parseInt(data.createdTimestamp) * 1000
    );

  if (data.lastUpdatedTimestamp != null)
    parsedData.lastUpdatedTimestamp = new Date(
      parseInt(data.lastUpdatedTimestamp) * 1000
    );

  if (data.feedbackPosts != null)
    parsedData.feedbackPosts = sortBy(
      (p) => p.createdTimestamp,
      data.feedbackPosts.map((p) => ({
        ...p,
        createdTimestamp: new Date(parseInt(p.createdTimestamp) * 1000),
      }))
    );

  return parsedData;
};

const parseProposalCandidate = (data) => {
  const parsedData = { ...data };

  if (data.latestVersion != null)
    parsedData.latestVersion.createdTimestamp = new Date(
      parseInt(data.latestVersion.createdTimestamp) * 1000
    );

  return parsedData;
};

export const ChainDataCacheContextProvider = ({ children }) => {
  const [state, setState] = React.useState({
    proposalsById: {},
    proposalCandidatesById: {},
  });

  useFetch(
    () =>
      subgraphFetch(PROPOSALS_QUERY).then((data) => {
        const parsedProposals = data.proposals.map(parseProposal);
        const fetchedProposalsById = indexBy((p) => p.id, parsedProposals);

        setState((s) => {
          const mergedExistingProposalsById = mapValues(
            (p) => ({ ...p, ...fetchedProposalsById[p.id] }),
            s.proposalsById
          );

          return {
            ...s,
            proposalsById: {
              ...fetchedProposalsById,
              ...mergedExistingProposalsById,
            },
          };
        });
      }),
    []
  );

  useFetch(
    () =>
      subgraphFetch(PROPOSAL_CANDIDATES_QUERY).then((data) => {
        const parsedCandidates = data.proposalCandidates.map(
          parseProposalCandidate
        );
        const fetchedCandidatesById = indexBy((p) => p.id, parsedCandidates);

        setState((s) => {
          const mergedExistingCandidatesById = mapValues(
            (c) => ({ ...c, ...fetchedCandidatesById[c.id] }),
            s.proposalCandidatesById
          );

          return {
            ...s,
            proposalCandidatesById: {
              ...fetchedCandidatesById,
              ...mergedExistingCandidatesById,
            },
          };
        });
      }),
    []
  );

  const fetchProposal = React.useCallback(
    (id) =>
      subgraphFetch(createProposalQuery(id)).then((data) => {
        if (data.proposal == null)
          return Promise.reject(new Error("not-found"));

        const fetchedProposal = parseProposal(data.proposal);

        setState((s) => {
          const existingProposal = s.proposalsById[id];
          return {
            ...s,
            proposalsById: {
              ...s.proposalsById,
              [id]: { ...existingProposal, ...fetchedProposal },
            },
          };
        });
      }),
    []
  );

  const fetchProposalCandidate = React.useCallback(
    (id) =>
      subgraphFetch(createProposalCandidateQuery(id)).then((data) => {
        if (data.proposalCandidate == null)
          return Promise.reject(new Error("not-found"));

        const fetchedCandidate = parseProposalCandidate(data.proposalCandidate);

        setState((s) => {
          const existingCandidate = s.proposalCandidatesById[id];
          return {
            ...s,
            proposalCandidatesById: {
              ...s.proposalCandidatesById,
              [id]: { ...existingCandidate, ...fetchedCandidate },
            },
          };
        });
      }),
    []
  );

  const contextValue = React.useMemo(
    () => ({ state, actions: { fetchProposal, fetchProposalCandidate } }),
    [state, fetchProposal, fetchProposalCandidate]
  );

  return (
    <ChainDataCacheContext.Provider value={contextValue}>
      {children}
    </ChainDataCacheContext.Provider>
  );
};

export const useProposals = () => {
  const {
    state: { proposalsById },
  } = React.useContext(ChainDataCacheContext);

  return React.useMemo(
    () => sortBy((p) => parseInt(p.id), Object.values(proposalsById)),
    [proposalsById]
  );
};

export const useProposalCandidates = () => {
  const {
    state: { proposalCandidatesById },
  } = React.useContext(ChainDataCacheContext);

  return React.useMemo(
    () =>
      sortBy((p) => p.createdTimestamp, Object.values(proposalCandidatesById)),
    [proposalCandidatesById]
  );
};

export const useProposalFetch = (id) => {
  const {
    actions: { fetchProposal },
  } = React.useContext(ChainDataCacheContext);

  useFetch(() => fetchProposal(id), [fetchProposal, id]);
};

export const useProposalCandidateFetch = (id) => {
  const {
    actions: { fetchProposalCandidate },
  } = React.useContext(ChainDataCacheContext);

  useFetch(() => fetchProposalCandidate(id), [fetchProposalCandidate, id]);
};

export const useProposalCandidate = (id) => {
  const {
    state: { proposalCandidatesById },
  } = React.useContext(ChainDataCacheContext);
  return proposalCandidatesById[id];
};

export const useProposal = (id) => {
  const {
    state: { proposalsById },
  } = React.useContext(ChainDataCacheContext);
  return proposalsById[id];
};

export const useSendProposalFeedback = (proposalId, { support, reason }) => {
  const { config } = usePrepareContractWrite({
    address: SEPOLIA_NOUNS_DATA_CONTACT,
    abi: parseAbi([
      "function sendFeedback(uint256 proposalId, uint8 support, string memory reason) external",
    ]),
    functionName: "sendFeedback",
    args: [parseInt(proposalId), support, reason],
  });
  const { writeAsync: write } = useContractWrite(config);

  return write;
};

export const useCreateProposalCandidate = ({ slug, description }) => {
  const publicClient = usePublicClient();

  const { config } = usePrepareContractWrite({
    address: SEPOLIA_NOUNS_DATA_CONTACT,
    abi: parseAbi([
      "function createProposalCandidate(address[] memory targets, uint256[] memory values, string[] memory signatures, bytes[] memory calldatas, string memory description, string memory slug, uint256 proposalIdToUpdate) external payable",
    ]),
    functionName: "createProposalCandidate",
    args: [
      // Target addresses
      ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"],
      // Values
      ["0"],
      // Function signatures
      [""],
      // Calldataas
      ["0x"],
      description,
      slug,
      0,
    ],
    value: parseEther("0.01"),
  });
  const { writeAsync: write } = useContractWrite(config);

  return write == null
    ? null
    : () =>
        write().then(({ hash }) =>
          publicClient.waitForTransactionReceipt({ hash })
        );
};
