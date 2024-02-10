import React from "react";
import { useFetch } from "@shades/common/react";
import { array as arrayUtils } from "@shades/common/utils";
import { useContractRead, useNetwork } from "wagmi";
import { channelsReducer } from "../reducers/channels";

import { idRegistryAbi } from "../abis/farc-id-registry";
import { DEFAULT_CHAIN_ID, ID_REGISTRY_ADDRESS } from "../utils/farcaster";

const { indexBy, sortBy } = arrayUtils;

export const ChainDataCacheContext = React.createContext();
export const ChainDataCacheDispatchContext = React.createContext();

const farcasterChannelsFetch = () =>
  fetch(`${import.meta.env.EDGE_API_BASE_URL}/channels`, {
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((result) => {
      return result.json();
    })
    .then((data) => {
      return data.channels;
    });

export const ChainDataCacheContextProvider = ({ children }) => {
  const [state, dispatch] = React.useReducer(channelsReducer, {
    channelsById: {},
  });

  const queryFarcaster = React.useCallback(() => farcasterChannelsFetch(), []);

  useFetch(
    () =>
      queryFarcaster().then((data) => {
        const fetchedChannelsById = indexBy((c) => c.id, data);
        dispatch({
          type: "add-initial-channels",
          channelsById: fetchedChannelsById,
        });
      }),
    [queryFarcaster]
  );

  const contextValue = React.useMemo(() => ({ state }), [state]);

  return (
    <ChainDataCacheContext.Provider value={contextValue}>
      <ChainDataCacheDispatchContext.Provider value={dispatch}>
        {children}
      </ChainDataCacheDispatchContext.Provider>
    </ChainDataCacheContext.Provider>
  );
};

export const useFarcasterChannels = () => {
  const {
    state: { channelsById },
  } = React.useContext(ChainDataCacheContext);

  return React.useMemo(
    () =>
      sortBy(
        { value: (c) => c.castCount, order: "desc" },
        Object.values(channelsById)
      ),
    [channelsById]
  );
};

export const useFarcasterChannel = (channelId) => {
  const {
    state: { channelsById },
  } = React.useContext(ChainDataCacheContext);

  return channelsById[channelId];
};

export const useFarcasterChannelByUrl = (channelUrl) => {
  const {
    state: { channelsById },
  } = React.useContext(ChainDataCacheContext);

  return Object.values(channelsById).find((c) => c.parentUrl === channelUrl);
};

export const useChainId = () => {
  const { chain } = useNetwork();
  return chain?.id ?? DEFAULT_CHAIN_ID;
};

export const useWalletFarcasterId = (walletAddress) => {
  React.useEffect(() => {
    if (!walletAddress) return;
  }, [walletAddress]);

  const { data, error } = useContractRead({
    address: ID_REGISTRY_ADDRESS,
    abi: idRegistryAbi,
    functionName: "idOf",
    args: [walletAddress],
    chainId: DEFAULT_CHAIN_ID,
    enabled: !!walletAddress,
  });

  const id = data == 0 ? null : data;

  return { data: id, error };
};
