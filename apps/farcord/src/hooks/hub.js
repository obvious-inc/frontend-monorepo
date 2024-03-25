import React from "react";
import {
  FarcasterNetwork,
  Message,
  NobleEd25519Signer,
  makeCastAdd,
  makeReactionAdd,
  makeReactionRemove,
  makeUserDataAdd,
  makeLinkAdd,
  makeLinkRemove,
} from "@farcaster/core";
import { hexToBytes } from "viem";
import { decodeMetadata } from "../utils/farcaster";

const { EDGE_API_BASE_URL } = import.meta.env;

export const REACTION_TYPE = {
  LIKE: 1,
  RECAST: 2,
};

const hubFetch = async (url, options) => {
  // get path from url and set it as a query param
  const path = url.split("?")[0];
  const queryParams = url.split("?")[1];
  const urlParams = new URLSearchParams(queryParams);
  urlParams.set("path", path);

  const response = await fetch(
    `${EDGE_API_BASE_URL}/hub?` + urlParams,
    options,
  );

  const data = await response.json();

  if (!response.ok) {
    console.error(data);
    return Promise.reject(
      new Error(`${response.status} ${response.statusText}`),
    );
  }

  return data;
};

const fetchUserData = async (fid) => {
  const params = new URLSearchParams({ fid });
  return hubFetch("/userDataByFid?" + params);
};

const fetchSignerEvents = async ({ fid, publicKey }) => {
  const params = new URLSearchParams({ fid });

  if (publicKey) {
    params.set("signer", publicKey);
  }
  return hubFetch("/onChainSignersByFid?" + params);
};

export const useUserSigners = (fid) => {
  const [signers, setSigners] = React.useState([]);

  React.useEffect(() => {
    if (!fid) {
      setSigners([]);
      return;
    }

    fetchSignerEvents({ fid }).then(
      (result) => {
        setSigners(result.events);
      },
      (err) => {
        console.error(err);
        setSigners([]);
      },
    );
  }, [fid]);

  return signers;
};

const fetchCast = async ({ fid, hash }) => {
  const params = new URLSearchParams({ fid, hash });
  return hubFetch("/castById?" + params);
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

  await hubFetch("/validateMessage", {
    method: "POST",
    headers,
    body: messageBytes,
  });

  return hubFetch("/submitMessage", {
    method: "POST",
    headers,
    body: messageBytes,
  });
};

export const addReaction = async ({ fid, signer, cast, reactionType }) => {
  const farcastSigner = new NobleEd25519Signer(hexToBytes(signer?.privateKey));

  const messageResult = await makeReactionAdd(
    {
      type: reactionType,
      targetCastId: {
        fid: Number(cast.fid),
        hash: hexToBytes(cast.hash),
      },
    },
    {
      fid: Number(fid),
      network: FarcasterNetwork.MAINNET,
    },
    farcastSigner,
  );

  return messageResult.match(
    (message) => submitHubMessage(message),
    (error) => Promise.reject(error),
  );
};

export const removeReaction = async ({ fid, signer, cast, reactionType }) => {
  const farcastSigner = new NobleEd25519Signer(hexToBytes(signer?.privateKey));

  const messageResult = await makeReactionRemove(
    {
      type: reactionType,
      targetCastId: {
        fid: Number(cast.fid),
        hash: hexToBytes(cast.hash),
      },
    },
    {
      fid: Number(fid),
      network: FarcasterNetwork.MAINNET,
    },
    farcastSigner,
  );

  return messageResult.match(
    (message) => submitHubMessage(message),
    (error) => Promise.reject(error),
  );
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
    (key) => castAddBody[key] === null && delete castAddBody[key],
  );

  const messageResult = await makeCastAdd(
    castAddBody,
    {
      fid: Number(fid),
      network: FarcasterNetwork.MAINNET,
    },
    farcastSigner,
  );

  return messageResult.match(
    (message) => submitHubMessage(message),
    (error) => Promise.reject(error),
  );
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

  const messageResult = await makeUserDataAdd(
    { type: hubDataType, value },
    { fid: Number(fid), network: FarcasterNetwork.MAINNET },
    farcastSigner,
  );

  return messageResult.match(
    (message) => submitHubMessage(message),
    (error) => Promise.reject(error),
  );
};

export const followUser = async ({ fid, signer, fidToFollow }) => {
  const farcastSigner = new NobleEd25519Signer(hexToBytes(signer?.privateKey));

  const messageResult = await makeLinkAdd(
    { type: "follow", targetFid: Number(fidToFollow) },
    { fid: Number(fid), network: FarcasterNetwork.MAINNET },
    farcastSigner,
  );

  return messageResult.match(
    (message) => submitHubMessage(message),
    (error) => Promise.reject(error),
  );
};

export const unfollowUser = async ({ fid, signer, fidToUnfollow }) => {
  const farcastSigner = new NobleEd25519Signer(hexToBytes(signer?.privateKey));

  const messageResult = await makeLinkRemove(
    { type: "follow", targetFid: Number(fidToUnfollow) },
    { fid: Number(fid), network: FarcasterNetwork.MAINNET },
    farcastSigner,
  );

  return messageResult.match(
    (message) => submitHubMessage(message),
    (error) => Promise.reject(error),
  );
};

const isFollowing = async ({ fid, fidToCheck }) => {
  const params = new URLSearchParams({
    fid: Number(fid),
    link_type: "follow",
    target_fid: Number(fidToCheck),
  });

  return hubFetch("/linkById?" + params).catch((err) => {
    console.error(err);
    return false;
  });
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
  const params = new URLSearchParams({ fid });
  return hubFetch("/userNameProofsByFid?" + params).then((data) => data.proofs);
};
