import React from "react";
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

export const ChainDataCacheContextProvider = ({ children }) => {
  const [state, setState] = React.useState({
    proposalsById: {},
  });

  useFetch(
    () =>
      subgraphFetch(PROPOSALS_QUERY).then((data) => {
        setState((s) => {
          const parsedProposals = data.proposals.map(parseProposal);
          const fetchedProposalsById = indexBy((p) => p.id, parsedProposals);
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

  const fetchProposal = React.useCallback(
    (id) =>
      subgraphFetch(createProposalQuery(id)).then((data) => {
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

  const contextValue = React.useMemo(
    () => ({ state, actions: { fetchProposal } }),
    [state, fetchProposal]
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

export const useProposalFetch = (id) => {
  const {
    actions: { fetchProposal },
  } = React.useContext(ChainDataCacheContext);

  useFetch(() => fetchProposal(id), [fetchProposal, id]);
};

export const useProposal = (id) => {
  const {
    state: { proposalsById },
  } = React.useContext(ChainDataCacheContext);
  return proposalsById[id];
};
