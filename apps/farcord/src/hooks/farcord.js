import React from "react";
import { useFetch } from "@shades/common/react";
import { array as arrayUtils } from "@shades/common/utils";
import { useContractRead, useNetwork } from "wagmi";

const { indexBy, sortBy } = arrayUtils;

const NEYNAR_FARCASTER_CHANNELS_STATIC_LIST =
  "https://raw.githubusercontent.com/neynarxyz/farcaster-channels/main/warpcast.json";

const WARPCAST_CHANNELS_INFO_ENDPOINT =
  "https://client.warpcast.com/v2/channel";

const FARCASTER_ID_REGISTRY_CONTRACT_ADDRESS =
  "0x00000000FcAf86937e41bA038B4fA40BAA4B780A";

export const DEFAULT_CHAIN_ID = 10;

const ChainDataCacheContext = React.createContext();

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
              return Promise.reject(new Error(res.statusText));
            })
            .then((body) => {
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
        return result;
      });
    });

export const ChainDataCacheContextProvider = ({ children }) => {
  const [state, setState] = React.useState({
    channelsById: {},
  });

  const queryFarcaster = React.useCallback(() => farcasterChannelsFetch(), []);

  useFetch(
    () =>
      queryFarcaster().then((data) => {
        const fetchedChannelsById = indexBy((c) => c.id, data);

        setState((s) => {
          return {
            ...s,
            channelsById: {
              ...s.channelsById,
              ...fetchedChannelsById,
            },
          };
        });
      }),
    [queryFarcaster]
  );

  const contextValue = React.useMemo(() => ({ state }), [state]);

  return (
    <ChainDataCacheContext.Provider value={contextValue}>
      {children}
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
    abi: [
      {
        inputs: [
          {
            internalType: "address",
            name: "owner",
            type: "address",
          },
        ],
        name: "idOf",
        outputs: [
          {
            internalType: "uint256",
            name: "fid",
            type: "uint256",
          },
        ],
        stateMutability: "view",
        type: "function",
      },
    ],
    functionName: "idOf",
    args: [walletAddress],
    chainId: useChainId(),
  });

  return { data, error };
};
