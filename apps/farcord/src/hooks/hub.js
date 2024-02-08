import React from "react";
import {
  Factories,
  FarcasterNetwork,
  Message,
  NobleEd25519Signer,
} from "@farcaster/core";
import { hexToBytes } from "viem";
import { decodeMetadata } from "../utils/farcaster";

const { EDGE_API_BASE_URL } = import.meta.env;

export const REACTION_TYPE = {
  LIKE: 1,
  RECAST: 2,
};

const fetchUserData = async (fid) => {
  const params = new URLSearchParams({
    fid: Number(fid),
  });

  return fetch(`${EDGE_API_BASE_URL}/hub/userDataByFid?` + params)
    .then((result) => {
      return result.json();
    })
    .catch((err) => {
      console.error(err);
    });
};

const fetchSignerEvents = async ({ fid, publicKey }) => {
  const params = new URLSearchParams({
    fid: Number(fid),
  });

  if (publicKey) {
    params.set("publicKey", publicKey);
  }

  const result = await fetch(
    `${EDGE_API_BASE_URL}/hub/onChainSignersByFid?` + params
  );
  const data = await result.json();

  if (!result.ok) {
    console.error(data);
    throw new Error(`${result.status} ${result.statusText}`);
  }

  return data;
};

export const fetchUserSigners = async ({ fid }) => {
  return fetchSignerEvents({ fid: Number(fid) })
    .then((data) => {
      return data;
    })
    .catch((err) => {
      console.error(err);
    });
};

export const useUserSigners = (fid) => {
  const [signers, setSigners] = React.useState([]);

  React.useEffect(() => {
    if (!fid) {
      setSigners([]);
      return;
    }

    fetchUserSigners({ fid })
      .then((result) => {
        setSigners(result.events);
      })
      .catch((err) => {
        console.error(err);
        setSigners([]);
      });
  }, [fid]);

  return signers;
};

const fetchCast = async ({ fid, hash }) => {
  const params = new URLSearchParams({
    fid: Number(fid),
    hash: hash,
  });

  return fetch(`${EDGE_API_BASE_URL}/hub/castById?` + params)
    .then((result) => {
      return result.json();
    })
    .catch((err) => {
      console.error(err);
    });
};

export const fetchAppFid = async ({ fid, hash }) => {
  return fetchCast({ fid, hash })
    .then((cast) => {
      return fetchSignerEvents({
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

export const useSignerByPublicKey = (fid, publicKey) => {
  const [signer, setSigner] = React.useState(null);

  React.useEffect(() => {
    if (!fid || !publicKey) return;
    fetchSignerEvents({ fid, publicKey }).then((s) => setSigner(s));
  }, [fid, publicKey]);

  return signer;
};

export const submitHubMessage = async (message) => {
  const headers = { "Content-Type": "application/octet-stream" };
  const messageBytes = Buffer.from(Message.encode(message).finish());

  const validation = await fetch(`${EDGE_API_BASE_URL}/hub/validateMessage`, {
    method: "POST",
    headers,
    body: messageBytes,
  });

  const validationData = await validation.json();

  if (!validation.ok) {
    console.error("error validating message", message, validationData);
    throw new Error(`${validation.status} ${validation.statusText}`);
  }

  const result = await fetch(`${EDGE_API_BASE_URL}/hub/submitMessage`, {
    method: "POST",
    headers,
    body: messageBytes,
  });

  const data = await result.json();

  if (!result.ok) {
    console.error("error submitting message to hub", message, data);
    throw new Error(`${result.status} ${result.statusText}`);
  }

  return data;
};

export const addReaction = async ({ fid, signer, cast, reactionType }) => {
  const farcastSigner = new NobleEd25519Signer(hexToBytes(signer?.privateKey));

  return Factories.ReactionAddMessage.create(
    {
      data: {
        fid: Number(fid),
        network: FarcasterNetwork.MAINNET,
        reactionBody: {
          type: reactionType,
          targetCastId: {
            fid: Number(cast.fid),
            hash: hexToBytes(cast.hash),
          },
        },
      },
    },
    { transient: { signer: farcastSigner } }
  ).then((messageData) => {
    return submitHubMessage(messageData);
  });
};

export const removeReaction = ({ fid, signer, cast, reactionType }) => {
  const farcastSigner = new NobleEd25519Signer(hexToBytes(signer?.privateKey));

  return Factories.ReactionRemoveMessage.create(
    {
      data: {
        fid: Number(fid),
        network: FarcasterNetwork.MAINNET,
        reactionBody: {
          type: reactionType,
          targetCastId: {
            fid: Number(cast.fid),
            hash: hexToBytes(cast.hash),
          },
        },
      },
    },
    { transient: { signer: farcastSigner } }
  ).then((messageData) => {
    return submitHubMessage(messageData);
  });
};

export const addCast = async ({
  fid,
  signer,
  parentUrl,
  parentCastId,
  text,
  embeds,
  mentions,
  mentionsPositions,
}) => {
  const farcastSigner = new NobleEd25519Signer(hexToBytes(signer?.privateKey));

  const castAddBody = {
    text,
    embeds,
    mentions,
    mentionsPositions,
    embedsDeprecated: [],
    parentUrl,
    parentCastId,
  };

  // filter null values from castAddBody object
  Object.keys(castAddBody).forEach(
    (key) => castAddBody[key] === null && delete castAddBody[key]
  );

  return Factories.CastAddMessage.create(
    {
      data: {
        fid: Number(fid),
        network: FarcasterNetwork.MAINNET,
        castAddBody,
      },
    },
    { transient: { signer: farcastSigner } }
  ).then((messageData) => {
    return submitHubMessage(messageData);
  });
};

export const useUserData = (fid) => {
  const [userData, setUserData] = React.useState(null);

  React.useEffect(() => {
    if (!fid) return;

    setUserData(null);

    fetchUserData(fid).then((data) => {
      data.messages.forEach((message) => {
        const dataBody = message.data?.userDataBody;
        let dataType;
        switch (dataBody?.type) {
          case "USER_DATA_TYPE_PFP":
            dataType = "pfp";
            break;
          case "USER_DATA_TYPE_DISPLAY":
            dataType = "displayName";
            break;
          case "USER_DATA_TYPE_BIO":
            dataType = "bio";
            break;
          case "USER_DATA_TYPE_URL":
            dataType = "url";
            break;
          case "USER_DATA_TYPE_USERNAME":
            dataType = "username";
            break;
          default:
            console.error("unexpected data type", dataBody?.type);
            return;
        }

        setUserData((userData) => ({
          ...userData,
          [dataType]: dataBody.value,
        }));
      });
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
    case "username":
      hubDataType = 6;
      break;
    default:
      throw new Error("unknown data type");
  }

  return Factories.UserDataAddMessage.create(
    {
      data: {
        fid: Number(fid),
        network: FarcasterNetwork.MAINNET,
        userDataBody: {
          type: hubDataType,
          value,
        },
      },
    },
    { transient: { signer: farcastSigner } }
  ).then((messageData) => {
    return submitHubMessage(messageData);
  });
};

export const followUser = async ({ fid, signer, fidToFollow }) => {
  const farcastSigner = new NobleEd25519Signer(hexToBytes(signer?.privateKey));

  return Factories.LinkAddMessage.create(
    {
      data: {
        fid: Number(fid),
        network: FarcasterNetwork.MAINNET,
        linkBody: {
          type: "follow",
          targetFid: Number(fidToFollow),
        },
      },
    },
    { transient: { signer: farcastSigner } }
  ).then((messageData) => {
    return submitHubMessage(messageData);
  });
};

export const unfollowUser = async ({ fid, signer, fidToUnfollow }) => {
  const farcastSigner = new NobleEd25519Signer(hexToBytes(signer?.privateKey));

  return Factories.LinkRemoveMessage.create(
    {
      data: {
        fid: Number(fid),
        network: FarcasterNetwork.MAINNET,
        linkBody: {
          type: "follow",
          targetFid: Number(fidToUnfollow),
        },
      },
    },
    { transient: { signer: farcastSigner } }
  ).then((messageData) => {
    return submitHubMessage(messageData);
  });
};

const isFollowing = async ({ fid, fidToCheck }) => {
  const params = new URLSearchParams({
    fid: Number(fid),
    link_type: "follow",
    target_fid: Number(fidToCheck),
  });

  const result = await fetch(`${EDGE_API_BASE_URL}/hub/linkById?` + params);
  const data = await result.json();

  if (!result.ok) {
    if (data.errCode != "not_found") throw new Error(data);
    return false;
  }

  return data;
};

export const useIsFollower = ({ fid, fidToCheck }) => {
  const [isFollower, setIsFollower] = React.useState(false);

  React.useEffect(() => {
    if (!fid || !fidToCheck) return;

    isFollowing({ fid, fidToCheck })
      .then((result) => {
        setIsFollower(result);
      })
      .catch(() => {
        setIsFollower(false);
      });
  }, [fid, fidToCheck]);

  return isFollower;
};

export const fetchUsernameProofsByFid = async ({ fid }) => {
  const params = new URLSearchParams({
    fid: Number(fid),
  });

  return fetch(`${EDGE_API_BASE_URL}/hub/userNameProofsByFid?` + params)
    .then((result) => {
      if (!result.ok) {
        throw result;
      }

      return result.json();
    })
    .then((data) => {
      return data.proofs;
    })
    .catch((err) => {
      console.error(err);
    });
};
