import debug from "debug";
import {
  sign as signWithEdDSAKey,
  verify as verifyEdDSASignature,
} from "@noble/ed25519";
import {
  keccak256 as hashWithKeccak256,
  verifyTypedData as verifyECDSATypedDataSignature,
} from "ethers/lib/utils";
import { createEncoder, createDecoder } from "@waku/core";
import { utf8ToBytes, hexToBytes, bytesToHex } from "@waku/byte-utils";
import React from "react";
import { createClient as createWakuClient } from "./waku-client.js";
import combineReducers from "./utils/combine-reducers.js";
import { mirror } from "./utils/object.js";
import { sort, comparator } from "./utils/array.js";
import useLatestCallback from "./hooks/latest-callback.js";

const log = debug("ns-waku-client");

const OperationTypes = {
  SIGNER_ADD: 1,
  CHANNEL_ADD: 2,
  CHANNEL_MEMBER_ADD: 3,
  CHANNEL_MESSAGE_ADD: 4,
  CHANNEL_MESSAGE_REMOVE: 5,
  CHANNEL_BROADCAST: 30,
};

const getOperationTypeName = (type) => mirror(OperationTypes)[type];

const OPERATION_ECDSA_SIGNATURE_DOMAIN = {
  name: "NewShades Message Signature",
  version: "1.0.0",
};

const SIGNER_ADD_OPERATION_ECDSA_SIGNATURE_TYPES = {
  SignerData: [
    { name: "user", type: "address" },
    { name: "signer", type: "string" },
  ],
};

const createContentTopic = (name) => `/newshades/1/${name}/json`;

const createUserContentTopic = (identityAddress) =>
  createContentTopic(`user-${identityAddress.toLowerCase()}`);
const createChannelContentTopic = (channelId) =>
  createContentTopic(`channel-${channelId}`);
const createChannelMetaContentTopic = (channelId) =>
  createContentTopic(`channel-meta-${channelId}`);

const BROADCAST_CONTENT_TOPIC = createContentTopic("broadcast");

const globalContentTopics = [BROADCAST_CONTENT_TOPIC];

const getChannelSpecificContentTopics = (channelId) => [
  createChannelContentTopic(channelId),
  createChannelMetaContentTopic(channelId),
];

const hashOperationData = (data) =>
  hashWithKeccak256(utf8ToBytes(JSON.stringify(data))).slice(2);

const validateOperationStructure = (o) => {
  if (o == null) return false;
  if (typeof o.hash !== "string") return false;
  if (typeof o.signer !== "string") return false;
  if (typeof o.signature !== "string") return false;
  if (typeof o.data?.type !== "number") return false;
  if (typeof o.data?.user !== "string") return false;
  if (typeof o.data?.timestamp !== "number") return false;
  if (o.data?.body == null) return false;

  switch (o.data.type) {
    // TODO
    default:
      return true;
  }
};

const verifyOperation = async (operation) => {
  if (!validateOperationStructure(operation)) return false;

  const verifySignature = async () => {
    if (operation.data.type === OperationTypes.SIGNER_ADD) {
      try {
        const recoveredAddress = verifyECDSATypedDataSignature(
          OPERATION_ECDSA_SIGNATURE_DOMAIN,
          SIGNER_ADD_OPERATION_ECDSA_SIGNATURE_TYPES,
          {
            user: operation.data.user,
            signer: operation.data.body.signer,
          },
          operation.signature
        );

        return recoveredAddress === operation.signer;
      } catch (e) {
        return false;
      }
    }

    try {
      return await verifyEdDSASignature(
        hexToBytes(operation.signature),
        hashOperationData(operation.data),
        hexToBytes(operation.signer)
      );
    } catch (e) {
      return false;
    }
  };

  const signatureOk = await verifySignature();

  if (!signatureOk) return false;

  // TODO verify user `operation.data.user` has verified signer `operation.signer`
  // TODO validate timestamp/clock

  return true;
};

const validateOperationPermissions = (o, state) => {
  const { channelsById, memberAddressesByChannelId, messagesById } = state;

  switch (o.data.type) {
    case OperationTypes.CHANNEL_MEMBER_ADD: {
      const channelId = o.data.body.channelId;
      const channel = channelsById.get(channelId);
      return channel != null && channel.owner === o.data.user;
    }

    case OperationTypes.CHANNEL_MESSAGE_ADD: {
      const { channelId } = o.data.body;
      const memberAddresses =
        new Set(memberAddressesByChannelId.get(channelId)) ?? new Set();
      return memberAddresses.has(o.data.user);
    }

    case OperationTypes.CHANNEL_MESSAGE_REMOVE: {
      const { targetMessageId } = o.data.body;
      const targetMessage = messagesById.get(targetMessageId);
      return targetMessage != null && o.data.user === targetMessage.user;
    }

    default:
      return true;
  }
};

const useOperationStore = () => {
  // const [operationHistory, setOperationHistory] = React.useState([]);

  const signersByUserAddress = (state, operation) => {
    switch (operation.data.type) {
      case OperationTypes.SIGNER_ADD: {
        const userAddress = operation.data.user;
        const previousSignerSet = new Set(state.get(userAddress)) ?? new Set();
        const updatedSignerSet = previousSignerSet.add(
          operation.data.body.signer
        );
        return new Map(state.set(userAddress, updatedSignerSet));
      }

      default:
        return state;
    }
  };

  const channelsById = (state, operation) => {
    switch (operation.data.type) {
      case OperationTypes.CHANNEL_ADD: {
        const channel = {
          id: operation.hash,
          name: operation.data.body.name,
          owner: operation.data.user,
        };
        return new Map(state.set(channel.id, channel));
      }

      case OperationTypes.CHANNEL_BROADCAST: {
        const { channelId } = operation.data.body;
        if (state.get(channelId) != null) return state;
        const nextState = new Map(state).set(channelId, { id: channelId });
        return nextState;
      }

      default:
        return state;
    }
  };

  const memberAddressesByChannelId = (state, operation) => {
    switch (operation.data.type) {
      case OperationTypes.CHANNEL_ADD: {
        const channelId = operation.hash;
        const previousMemberSet = new Set(state.get(channelId)) ?? new Set();
        const updatedMemberSet = new Set(previousMemberSet).add(
          operation.data.user
        );
        if (previousMemberSet.size === updatedMemberSet.size) return state;
        return new Map(state.set(channelId, [...updatedMemberSet]));
      }

      case OperationTypes.CHANNEL_MEMBER_ADD: {
        const channelId = operation.data.body.channelId;
        const previousMemberSet = new Set(state.get(channelId)) ?? new Set();
        const updatedMemberSet = new Set(previousMemberSet).add(
          operation.data.body.user
        );
        if (previousMemberSet.size === updatedMemberSet.size) return state;
        return new Map(state.set(channelId, [...updatedMemberSet]));
      }

      default:
        return state;
    }
  };

  const messagesById = (state, operation) => {
    switch (operation.data.type) {
      case OperationTypes.CHANNEL_MESSAGE_ADD: {
        const message = {
          id: operation.hash,
          signer: operation.signer,
          ...operation.data,
        };
        return new Map(state.set(message.id, message));
      }

      case OperationTypes.CHANNEL_MESSAGE_REMOVE: {
        const { targetMessageId } = operation.data.body;
        state.delete(targetMessageId);
        return new Map(state);
      }

      default:
        return state;
    }
  };

  const messageIdsByChannelId = (state, operation) => {
    switch (operation.data.type) {
      case OperationTypes.CHANNEL_MESSAGE_ADD: {
        const messageId = operation.hash;
        const channelId = operation.data.body.channelId;
        const previousMessageSet = new Set(state.get(channelId)) ?? new Set();
        const updatedMessageSet = previousMessageSet.add(messageId);
        return new Map(state.set(channelId, updatedMessageSet));
      }

      default:
        return state;
    }
  };

  const operationReducer = combineReducers({
    channelsById,
    memberAddressesByChannelId,
    messagesById,
    messageIdsByChannelId,
    signersByUserAddress,
  });

  const [state, dispatch] = React.useReducer(
    (state, action) => {
      switch (action.type) {
        case "merge-batch":
          return action.operations.reduce((s, o) => {
            if (!validateOperationPermissions(o, s)) {
              log(
                `rejecting operation "${getOperationTypeName(o.data.type)}"`,
                o
              );
              return s;
            }
            return operationReducer(s, o);
          }, state);

        default:
          return state;
      }
    },
    {
      channelsById: new Map(),
      memberAddressesByChannelId: new Map(),
      messagesById: new Map(),
      messageIdsByChannelId: new Map(),
      signersByUserAddress: new Map(),
    }
  );

  const mergeOperations = (operations_) => {
    // setOperationHistory((os) => [...os, ...operations]);
    const operations = sort(
      comparator({ value: (o) => o.data.timestamp }),
      operations_
    );
    dispatch({ type: "merge-batch", operations });
  };

  return [state, mergeOperations];
};

const SignerContext = React.createContext();
const WakuClientContext = React.createContext();
const StoreContext = React.createContext();

export const Provider = ({ identity, signerKeyPair, children }) => {
  const clientRef = React.useRef();
  const store = useOperationStore();
  const [didInitialize, setInitialized] = React.useState(false);

  const mergeOperations = store[1];

  React.useEffect(() => {
    createWakuClient().then((client) => {
      clientRef.current = client;
      setInitialized(true);
    });
  }, []);

  React.useEffect(() => {
    if (!didInitialize) return;

    let unsubscribe;

    clientRef.current
      .subscribe(
        globalContentTopics.map(createDecoder),
        async (wakuMessagePayload) => {
          const verified = await verifyOperation(wakuMessagePayload);
          if (!verified) return;
          mergeOperations([wakuMessagePayload]);
        }
      )
      .then((u) => {
        unsubscribe = u;
      });

    return () => {
      unsubscribe?.();
    };
  }, [didInitialize]);

  return (
    <SignerContext.Provider value={{ identity, signerKeyPair }}>
      <WakuClientContext.Provider
        value={{ didInitialize, client: clientRef.current }}
      >
        <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
      </WakuClientContext.Provider>
    </SignerContext.Provider>
  );
};

export const useClientState = () => {
  const { signerKeyPair } = React.useContext(SignerContext);
  const { didInitialize, client } = React.useContext(WakuClientContext);

  const [peers, setPeers] = React.useState([]);

  React.useEffect(() => {
    if (!didInitialize) return;

    const updatePeers = () =>
      client.getPeers().then((peers) => {
        setPeers(peers);
      });

    const id = setInterval(() => {
      updatePeers();
    }, 1000);

    updatePeers();

    return () => {
      clearInterval(id);
    };
  }, [didInitialize, client]);

  return { didInitialize, signerKeyPair, peers };
};

export const useChannels = () => {
  const [{ channelsById }] = React.useContext(StoreContext);
  return [...channelsById.values()];
};

export const useChannel = (channelId) => {
  const [{ channelsById }] = React.useContext(StoreContext);
  return channelsById.get(channelId);
};

export const useChannelMembers = (channelId) => {
  const [{ memberAddressesByChannelId }] = React.useContext(StoreContext);
  const addresses = memberAddressesByChannelId.get(channelId) ?? [];
  return addresses;
};

export const useChannelMessages = (channelId) => {
  const [{ messageIdsByChannelId, messagesById }] =
    React.useContext(StoreContext);
  const channelMessageIdSet = messageIdsByChannelId.get(channelId) ?? new Set();
  return [...channelMessageIdSet]
    .map((id) => messagesById.get(id))
    .filter(Boolean);
};

export const useUsers = () => {
  const [{ signersByUserAddress }] = React.useContext(StoreContext);

  const users = [...signersByUserAddress.entries()].map(
    ([address, signers]) => ({
      id: address,
      address,
      signers: [...signers],
    })
  );

  return users;
};

export const useFetchers = () => {
  const { client } = React.useContext(WakuClientContext);
  const [, mergeOperations] = React.useContext(StoreContext);

  const fetchOperations = async (decoders, options) => {
    const wakuMessagePayloads = await client.fetchMessages(decoders, options);

    const validOperations = (
      await Promise.all(
        wakuMessagePayloads.map(async (o) => {
          const verified = await verifyOperation(o);
          if (!verified) {
            log("rejected operation", o);
            return null;
          }
          return o;
        })
      )
    ).filter(Boolean);

    return validOperations;
  };

  const fetchUsers = useLatestCallback(async (userIdentityAddresses) => {
    const operations = await fetchOperations(
      userIdentityAddresses.map((a) =>
        createDecoder(createUserContentTopic(a))
      ),
      { limit: 100 }
    );
    mergeOperations(operations);
    return operations;
  });

  const fetchChannel = useLatestCallback(async (channelId) => {
    const contentTopic = createChannelMetaContentTopic(channelId);
    const operations = await fetchOperations([createDecoder(contentTopic)], {
      limit: 1000,
    });
    mergeOperations(operations);
    return operations;
  });

  const fetchChannelMessages = useLatestCallback(async (channelId) => {
    const channelContentTopic = createChannelContentTopic(channelId);
    const operations = await fetchOperations([
      createDecoder(channelContentTopic),
    ]);
    mergeOperations(operations);
    return operations;
  });

  const fetchBroadcasts = useLatestCallback(async () => {
    const operations = await fetchOperations(
      [createDecoder(BROADCAST_CONTENT_TOPIC)],
      { limit: 1000 }
    );
    mergeOperations(operations);
    return operations;
  });

  return { fetchUsers, fetchChannel, fetchChannelMessages, fetchBroadcasts };
};

export const useSubmitters = () => {
  const { identity, signerKeyPair } = React.useContext(SignerContext) ?? {};
  const { client: wakuClient } = React.useContext(WakuClientContext);

  const makeOperationData = (type, body) => ({
    body,
    type,
    user: identity,
    timestamp: new Date().getTime(),
  });

  const makeEdDSASignedOperation = async (type, body) => {
    const data = makeOperationData(type, body);
    const hash = hashOperationData(data);
    const signatureBytes = await signWithEdDSAKey(
      hexToBytes(hash),
      hexToBytes(signerKeyPair.privateKey)
    );
    return {
      data,
      hash,
      signer: signerKeyPair.publicKey,
      signature: `0x${bytesToHex(signatureBytes)}`,
    };
  };

  const makeECDSASignedSignerAddOperation = async ({
    signerPublicKey: signer,
    signTypedData,
  }) => {
    const signature = await signTypedData({
      domain: OPERATION_ECDSA_SIGNATURE_DOMAIN,
      types: SIGNER_ADD_OPERATION_ECDSA_SIGNATURE_TYPES,
      value: {
        user: identity,
        signer,
      },
    });
    const data = makeOperationData(OperationTypes.SIGNER_ADD, { signer });
    const hash = hashOperationData(data);

    return {
      data,
      hash,
      signer: identity,
      signature,
    };
  };

  const submitChannelBroadcast = async (channelId) => {
    const encoder = createEncoder(BROADCAST_CONTENT_TOPIC);
    const operation = await makeEdDSASignedOperation(
      OperationTypes.CHANNEL_BROADCAST,
      { channelId }
    );
    return wakuClient.submitMessage(encoder, operation);
  };

  const submitChannelAdd = useLatestCallback(async ({ name }) => {
    const operation = await makeEdDSASignedOperation(
      OperationTypes.CHANNEL_ADD,
      { name }
    );
    const channelId = operation.hash;
    const contentTopic = createChannelMetaContentTopic(channelId);
    const encoder = createEncoder(contentTopic);
    await wakuClient.submitMessage(encoder, operation);
    await submitChannelBroadcast(channelId);
    return { id: channelId };
  });

  const submitChannelMemberAdd = useLatestCallback(
    async (channelId, memberAddress) => {
      const operation = await makeEdDSASignedOperation(
        OperationTypes.CHANNEL_MEMBER_ADD,
        { channelId, user: memberAddress }
      );
      const contentTopic = createChannelMetaContentTopic(channelId);
      const encoder = createEncoder(contentTopic);
      return wakuClient.submitMessage(encoder, operation);
    }
  );

  const submitChannelMessageAdd = useLatestCallback(
    async (channelId, { content }) => {
      const contentTopic = createChannelContentTopic(channelId);
      const encoder = createEncoder(contentTopic);
      const operation = await makeEdDSASignedOperation(
        OperationTypes.CHANNEL_MESSAGE_ADD,
        { channelId, content }
      );
      return wakuClient.submitMessage(encoder, operation);
    }
  );

  const submitChannelMessageRemove = useLatestCallback(
    async (channelId, { targetMessageId }) => {
      const contentTopic = createChannelContentTopic(channelId);
      const encoder = createEncoder(contentTopic);
      const operation = await makeEdDSASignedOperation(
        OperationTypes.CHANNEL_MESSAGE_REMOVE,
        { channelId, targetMessageId }
      );
      return wakuClient.submitMessage(encoder, operation);
    }
  );

  const submitSignerAdd = useLatestCallback(async ({ signTypedData }) => {
    const encoder = createEncoder(createUserContentTopic(identity));
    const operation = await makeECDSASignedSignerAddOperation({
      signerPublicKey: signerKeyPair.publicKey,
      signTypedData,
    });
    return wakuClient.submitMessage(encoder, operation);
  });

  return {
    submitSignerAdd,
    submitChannelAdd,
    submitChannelMessageAdd,
    submitChannelMessageRemove,
    submitChannelMemberAdd,
  };
};

export const useChannelSubscription = (channelId) => {
  const { client } = React.useContext(WakuClientContext);
  const [, mergeOperations] = React.useContext(StoreContext);
  const { didInitialize } = useClientState();

  React.useEffect(() => {
    if (!didInitialize) return;

    const contentTopics = getChannelSpecificContentTopics(channelId);

    let unsubscribe;

    client
      .subscribe(
        contentTopics.map(createDecoder),
        async (wakuMessagePayload) => {
          const verified = await verifyOperation(wakuMessagePayload);

          if (!verified) return;
          mergeOperations([wakuMessagePayload]);
        }
      )
      .then((u) => {
        unsubscribe = u;
      });

    return () => {
      unsubscribe?.();
    };
  }, [client, didInitialize, channelId]);
};
