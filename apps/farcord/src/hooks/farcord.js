import React from "react";
import { useFetch } from "@shades/common/react";
import { array as arrayUtils } from "@shades/common/utils";
import { useContractRead, useNetwork } from "wagmi";
import { channelsReducer } from "../reducers/channels";
import { optimism } from "wagmi/chains";
import { idRegistryAbi } from "../abis/farc-id-registry";

const { indexBy, sortBy } = arrayUtils;

const NEYNAR_FARCASTER_CHANNELS_STATIC_LIST =
  "https://raw.githubusercontent.com/pedropregueiro/farcaster-channels/main/warpcast.json";

const WARPCAST_CHANNELS_INFO_ENDPOINT =
  "https://client.warpcast.com/v2/channel";

const FARCASTER_ID_REGISTRY_CONTRACT_ADDRESS =
  "0x00000000FcAf86937e41bA038B4fA40BAA4B780A";

export const DEFAULT_CHAIN_ID = optimism.id;

export const ChainDataCacheContext = React.createContext();
export const ChainDataCacheDispatchContext = React.createContext();

const farcasterChannelsFetch = () =>
  fetch(NEYNAR_FARCASTER_CHANNELS_STATIC_LIST)
    .then((res) => {
      if (res.ok) return res.json();
      return Promise.reject(new Error(res.statusText));
    })
    .then((data) => {
      return Promise.all(
        data.map((channel) =>
          fetch(WARPCAST_CHANNELS_INFO_ENDPOINT + "?key=" + channel.channel_id)
            .then((res) => {
              if (res.ok) return res.json();
              else {
                console.error(
                  "Error fetching channel info for " + channel.channel_id
                );
                return null;
              }
            })
            .then((body) => {
              if (!body) return;
              const warpcastChannel = body.result.channel;
              return {
                id: channel.channel_id,
                parentUrl: channel.parent_url,
                name: warpcastChannel.name,
                imageUrl: warpcastChannel.fastImageUrl,
                followerCount: warpcastChannel.followerCount,
                description: warpcastChannel.description,
              };
            })
        )
      ).then((result) => {
        // filter undefined keys
        return result.filter((c) => c);
      });
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
        { value: (c) => c.followerCount, order: "desc" },
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
    address: FARCASTER_ID_REGISTRY_CONTRACT_ADDRESS,
    abi: idRegistryAbi,
    functionName: "idOf",
    args: [walletAddress],
    chainId: DEFAULT_CHAIN_ID,
    enabled: !!walletAddress,
  });

  const id = data == 0 ? null : data;

  return { data: id, error };
};
