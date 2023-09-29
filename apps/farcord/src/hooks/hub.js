import React from "react";
import {
  NobleEd25519Signer,
  FarcasterNetwork,
  getHubRpcClient,
  makeCastAdd,
  makeReactionAdd,
  makeReactionRemove,
} from "@farcaster/hub-web";
import { hexToBytes } from "viem";
import { decodeMetadata } from "../utils/farcaster";

const farcasterClient = getHubRpcClient(
  process.env.FARCASTER_HUB_RPC_ENDPOINT,
  {
    metadata: false,
    isBrowser: true,
  }
);

export const REACTION_TYPE = {
  LIKE: 1,
  RECAST: 2,
};

export const fetchSignerEvent = async ({ fid, publicKey }) => {
  return farcasterClient
    .getOnChainSigner({ fid, signer: publicKey })
    .then((result) => {
      if (result.isErr()) {
        throw result.error;
      }

      return result.value;
    })
    .catch((err) => {
      console.error(err);
    });
};

export const fetchAppFid = async ({ fid, hash }) => {
  return farcasterClient
    .getCast({
      fid: Number(fid),
      hash: hexToBytes(hash),
    })
    .then((result) => {
      if (result.isErr()) {
        throw result.error;
      }

      return result.value;
    })
    .then((cast) => {
      return fetchSignerEvent({
        fid: Number(fid),
        publicKey: cast.signer,
      });
    })
    .then((result) => {
      return result.signerEventBody?.metadata;
    })
    .then((metadata) => {
      const parsedMetadata = decodeMetadata(metadata);
      return parsedMetadata[0].requestFid;
    })
    .catch((e) => {
      console.error(e);
    });
};

export const useUserCasts = (fid) => {
  return farcasterClient
    .getCastsByFid({
      fid: fid,
      pageSize: 10,
      reverse: true,
    })
    .then((result) => {
      if (result.isErr()) {
        throw result.error;
      }

      result.map((casts) =>
        casts.messages.map((cast) => console.log(cast.data?.castAddBody?.text))
      );

      return result;
    })
    .catch((err) => {
      throw err;
    });
};

export const useIdRegistryEvent = (walletAddress) => {
  return farcasterClient
    .getIdRegistryEventByAddress({
      address: walletAddress,
    })
    .then((result) => {
      if (result.isErr()) {
        throw result.error;
      }

      return result;
    })
    .catch((err) => {
      console.log(err);
      return null;
    });
};

export const useSignerByPublicKey = (fid, publicKey) => {
  const [signer, setSigner] = React.useState(null);

  React.useEffect(() => {
    async function fetchSigner() {
      if (!fid || !publicKey) {
        setSigner(null);
        return;
      }

      return farcasterClient
        .getOnChainSigner({
          fid: Number(fid),
          signer: hexToBytes(publicKey),
        })
        .then((result) => {
          if (result.isErr()) {
            throw result.error;
          }

          setSigner(result.value);
        })
        .catch((err) => {
          if (err.errCode == "not_found") return;
          console.error(err);
        });
    }

    fetchSigner();
  }, [fid, publicKey]);

  return signer;
};

export const useStorageLimitsByFid = (fid) => {
  const [storageLimits, setStorageLimits] = React.useState(null);

  React.useEffect(() => {
    if (!fid) return;

    async function fetchStorageLimits() {
      return farcasterClient
        .getCurrentStorageLimitsByFid({
          fid: Number(fid),
        })
        .then((result) => {
          if (result.isErr()) {
            throw result.error;
          }

          setStorageLimits(result.value);
        });
    }

    fetchStorageLimits();
  }, [fid]);

  return storageLimits;
};

export const submitHubMessage = async (message) => {
  return farcasterClient.submitMessage(message).then((result) => {
    if (result.isErr()) {
      console.error("error submitting message to hub", message, result.error);
      throw result.error;
    }

    return result;
  });
};

export const addReaction = ({ fid, signer, cast, reactionType }) => {
  const farcastSigner = new NobleEd25519Signer(hexToBytes(signer?.privateKey));

  return makeReactionAdd(
    {
      type: reactionType,
      targetCastId: {
        fid: Number(cast.fid),
        hash: hexToBytes(cast.hash),
      },
    },
    {
      network: FarcasterNetwork.MAINNET,
      fid: Number(fid),
    },
    farcastSigner
  ).then((messageData) => {
    if (messageData.isErr()) {
      throw messageData.error;
    }

    return submitHubMessage(messageData.value);
  });
};

export const removeReaction = ({ fid, signer, cast, reactionType }) => {
  const farcastSigner = new NobleEd25519Signer(hexToBytes(signer?.privateKey));

  return makeReactionRemove(
    {
      type: reactionType,
      targetCastId: {
        fid: Number(cast.fid),
        hash: hexToBytes(cast.hash),
      },
    },
    {
      network: FarcasterNetwork.MAINNET,
      fid: Number(fid),
    },
    farcastSigner
  ).then((messageData) => {
    if (messageData.isErr()) {
      throw messageData.error;
    }

    return submitHubMessage(messageData.value);
  });
};

export const addCast = async ({
  fid,
  signer,
  text,
  parentUrl,
  parentCastId,
}) => {
  const farcastSigner = new NobleEd25519Signer(hexToBytes(signer?.privateKey));

  return makeCastAdd(
    {
      text: text,
      embeds: [],
      embedsDeprecated: [],
      mentions: [],
      mentionsPositions: [],
      parentUrl,
      parentCastId,
    },
    {
      network: FarcasterNetwork.MAINNET,
      fid: Number(fid),
    },
    farcastSigner
  ).then((messageData) => {
    if (messageData.isErr()) {
      throw messageData.error;
    }

    return submitHubMessage(messageData.value);
  });
};
