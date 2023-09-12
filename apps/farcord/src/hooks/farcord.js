import React from "react";
import { useFetch } from "@shades/common/react";
import { array as arrayUtils } from "@shades/common/utils";
import {
  useContractRead,
  useNetwork,
  useSignTypedData,
  useContractWrite,
} from "wagmi";
import { hexToBytes, encodeAbiParameters, parseAbi } from "viem";

const { indexBy, sortBy } = arrayUtils;

const NEYNAR_FARCASTER_CHANNELS_STATIC_LIST =
  "https://raw.githubusercontent.com/neynarxyz/farcaster-channels/main/warpcast.json";

const WARPCAST_CHANNELS_INFO_ENDPOINT =
  "https://client.warpcast.com/v2/channel";

const FARCASTER_ID_REGISTRY_CONTRACT_ADDRESS =
  "0x00000000FcAf86937e41bA038B4fA40BAA4B780A";

const DEFAULT_CHAIN_ID = 10;

const ChainDataCacheContext = React.createContext();
const DEFAULT_KEY_REGISTRY_ADDRESS =
  "0x00000000fC9e66f1c6d86D750B4af47fF0Cc343d";

const KEY_METADATA_TYPE = [
  {
    components: [
      {
        internalType: "uint256",
        name: "requestFid",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "requestSigner",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "signature",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
    ],
    internalType: "struct SignedKeyRequestValidator.SignedKeyRequestMetadata",
    name: "metadata",
    type: "tuple",
  },
];

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

export const useSignAddSigner = () => {
  const hashedMessage = "0x1";

  const { signTypedDataAsync } = useSignTypedData({
    domain: {
      name: "Farcaster Verify Ethereum Address",
      version: "2.0.0",
      chainId: useChainId(),
      salt: "0xf2d857f4a3edcb9b78b4d503bfe733db1e3f6cdc2b7971ee739626c97e86a558",
    },
    types: {
      MessageData: [
        {
          name: "hash",
          type: "bytes",
        },
      ],
    },
    primaryType: "MessageData",
    message: {
      hash: hexToBytes(hashedMessage),
    },
  });

  return signTypedDataAsync;
};

export const useSignKeyRegistry = (fid, publicKey, deadline) => {
  const SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN = {
    name: "Farcaster SignedKeyRequestValidator",
    version: "1",
    chainId: 10,
    verifyingContract: "0x00000000fc700472606ed4fa22623acf62c60553",
  };

  const SIGNED_KEY_REQUEST_TYPE = [
    { name: "requestFid", type: "uint256" },
    { name: "key", type: "bytes" },
    { name: "deadline", type: "uint256" },
  ];

  const { signTypedDataAsync } = useSignTypedData({
    domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
    types: {
      SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE,
    },
    primaryType: "SignedKeyRequest",
    message: {
      requestFid: BigInt(fid),
      key: publicKey,
      deadline: BigInt(deadline),
    },
  });

  return signTypedDataAsync;
};

export const useBroadcastKey = () => {
  const { writeAsync } = useContractWrite({
    address: DEFAULT_KEY_REGISTRY_ADDRESS,
    abi: parseAbi([
      "function add(uint32 keyType, bytes calldata key, uint8 metadataType, bytes calldata metadata) external",
    ]),
    chainId: 10,
    functionName: "add",
  });

  return ({ fid, address, deadline, publicKey, signature }) => {
    writeAsync({
      args: [
        1,
        publicKey,
        1,
        encodeAbiParameters(KEY_METADATA_TYPE, [
          {
            requestFid: BigInt(fid),
            requestSigner: address,
            signature: signature,
            deadline: BigInt(deadline),
          },
        ]),
      ],
      enabled: true,
    });
  };
};
