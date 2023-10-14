import React from "react";
import {
  NobleEd25519Signer,
  FarcasterNetwork,
  getHubRpcClient,
  makeCastAdd,
  makeReactionAdd,
  makeReactionRemove,
  makeUserDataAdd,
  makeLinkAdd,
  makeLinkRemove,
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

export const useUserData = (fid) => {
  const [userData, setUserData] = React.useState(null);

  React.useEffect(() => {
    if (!fid) return;

    setUserData(null);

    farcasterClient
      .getUserDataByFid({
        fid: Number(fid),
      })
      .then((result) => {
        if (result.isErr()) {
          throw result.error;
        }

        result.value.messages.forEach((message) => {
          const dataBody = message.data?.userDataBody;
          let dataType;
          switch (dataBody?.type) {
            case 1:
              dataType = "pfp";
              break;
            case 2:
              dataType = "displayName";
              break;
            case 3:
              dataType = "bio";
              break;
            case 5:
              dataType = "url";
              break;
            case 6:
              dataType = "username";
              break;
            default:
              console.log("unexpected data type", dataBody?.type);
              return;
          }

          setUserData((userData) => ({
            ...userData,
            [dataType]: dataBody.value,
          }));
        });
      })
      .catch((err) => {
        console.error(err);
      });
  }, [fid]);

  return userData;
};

export const setUserData = async ({ fid, signer, dataType, value }) => {
  const farcastSigner = new NobleEd25519Signer(hexToBytes(signer?.privateKey));

  let hubDataType;
  switch (dataType) {
    case "pfp":
      hubDataType = 1;
      break;
    case "displayName":
      hubDataType = 2;
      break;
    case "bio":
      hubDataType = 3;
      break;
    case "url":
      hubDataType = 5;
      break;
    default:
      throw new Error("unknown data type");
  }

  return makeUserDataAdd(
    {
      type: hubDataType,
      value: value,
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

export const followUser = async ({ fid, signer, fidToFollow }) => {
  const farcastSigner = new NobleEd25519Signer(hexToBytes(signer?.privateKey));

  return makeLinkAdd(
    {
      type: "follow",
      targetFid: Number(fidToFollow),
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

export const unfollowUser = async ({ fid, signer, fidToUnfollow }) => {
  const farcastSigner = new NobleEd25519Signer(hexToBytes(signer?.privateKey));

  return makeLinkRemove(
    {
      type: "follow",
      targetFid: Number(fidToUnfollow),
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

export const isFollowing = async ({ fid, fidToCheck }) => {
  return farcasterClient
    .getLink({
      fid: Number(fid),
      linkType: "follow",
      targetFid: Number(fidToCheck),
    })
    .then((result) => {
      if (result.isErr()) {
        throw result.error;
      }

      return result.value;
    })
    .then((link) => {
      return link != null;
    });
};

export const useIsFollower = ({ fid, fidToCheck }) => {
  const [isFollower, setIsFollower] = React.useState(null);

  React.useEffect(() => {
    if (!fid || !fidToCheck) return;

    setIsFollower(null);

    isFollowing({ fid, fidToCheck })
      .then((result) => {
        setIsFollower(result);
      })
      .catch((err) => {
        console.error(err);
      });
  }, [fid, fidToCheck]);

  return isFollower;
};
