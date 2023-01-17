import {
  getPublicKey as getEdDSAPublicKey,
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
import useLatestCallback from "./hooks/latest-callback.js";

const OperationTypes = { MESSAGE_ADD: 1, SIGNER_ADD: 2 };

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

const createChannelMessageAddContentTopic = (channelId) =>
  createContentTopic(
    `channel-message-add-${hashWithKeccak256(utf8ToBytes(channelId))}`
  );

const SIGNER_ADD_WAKU_CONTENT_TOPIC = createContentTopic("signer-add");

// Topics everyone should listen to
const globalContentTopics = [SIGNER_ADD_WAKU_CONTENT_TOPIC];

// Topics unique per user
// const getUserWakuTopics = () => {}

const getChannelSpecificContentTopics = (channelId) =>
  // Should include message deletes and updates, as well as downstream operations like reactions, replies, new members, etc.
  [createChannelMessageAddContentTopic(channelId)];

const validateOperationStructure = (o) => {
  if (o == null) return false;
  if (typeof o.hash !== "string") return false;
  if (typeof o.signer !== "string") return false;
  if (typeof o.signature !== "string") return false;
  if (typeof o.data?.type !== "number") return false;
  if (typeof o.data?.user !== "string") return false;
  if (typeof o.data?.timestamp !== "number") return false;
  if (o.data?.body == null) return false;
  return true;
};

const hashOperationData = (data) =>
  hashWithKeccak256(utf8ToBytes(JSON.stringify(data))).slice(2);

const verifyOperation = async (operation) => {
  if (!validateOperationStructure(operation)) return false;

  if (operation.data.type === OperationTypes.SIGNER_ADD) {
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
  }

  const ok = await verifyEdDSASignature(
    hexToBytes(operation.signature),
    hashOperationData(operation.data),
    hexToBytes(operation.signer)
  );

  // TODO verify user `operation.data.user` has verified signer `operation.signer`

  return ok;
};

const useOperationStore = () => {
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

  const messagesById = (state, operation) => {
    switch (operation.data.type) {
      case OperationTypes.MESSAGE_ADD: {
        const message = {
          id: operation.hash,
          signer: operation.signer,
          ...operation.data,
        };
        return new Map(state.set(message.id, message));
      }
      default:
        return state;
    }
  };

  const messageIdsByChannelId = (state, operation) => {
    switch (operation.data.type) {
      case OperationTypes.MESSAGE_ADD: {
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
    messagesById,
    messageIdsByChannelId,
    signersByUserAddress,
  });

  const [state, dispatch] = React.useReducer(
    (state, operations) =>
      operations.reduce((s, o) => operationReducer(s, o), state),
    {
      messagesById: new Map(),
      messageIdsByChannelId: new Map(),
      signersByUserAddress: new Map(),
    }
  );

  return [state, dispatch];
};

const SignerContext = React.createContext();
const WakuClientContext = React.createContext();
const StoreContext = React.createContext();

export const Provider = ({ account, signerEdDSAPrivateKey, children }) => {
  const clientRef = React.useRef();
  const store = useOperationStore();
  const [didInitialize, setInitialized] = React.useState(false);
  const [signerPublicKey, setSignerPublicKey] = React.useState(null);

  React.useEffect(() => {
    createWakuClient().then((client) => {
      clientRef.current = client;
      setInitialized(true);
    });
  }, []);

  React.useEffect(() => {
    if (!didInitialize) return;

    const unsubscribe = clientRef.current.subscribe(
      globalContentTopics.map(createDecoder),
      async (wakuMessagePayload) => {
        const verified = await verifyOperation(wakuMessagePayload);
        if (!verified) return;
        mergeOperations([wakuMessagePayload]);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [didInitialize]);

  React.useEffect(() => {
    if (signerEdDSAPrivateKey == null) return;

    getEdDSAPublicKey(hexToBytes(signerEdDSAPrivateKey)).then(
      (publicKeyBytes) => {
        const publicKeyHex = `0x${bytesToHex(publicKeyBytes)}`;
        setSignerPublicKey(publicKeyHex);
      }
    );
  }, [signerEdDSAPrivateKey]);

  const signerKeyPair = {
    privateKey: signerEdDSAPrivateKey,
    publicKey: signerPublicKey,
  };

  return (
    <SignerContext.Provider value={{ account, signerKeyPair }}>
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

    client.getPeers().then((peers) => {
      setPeers(peers);
    });
  }, [didInitialize, client]);

  return { didInitialize, signerKeyPair, peers };
};

export const useChannelMessages = (channelId) => {
  const [{ messageIdsByChannelId, messagesById }] =
    React.useContext(StoreContext);
  const channelMessageIdSet = messageIdsByChannelId.get(channelId) ?? new Set();
  return [...channelMessageIdSet].map((id) => messagesById.get(id));
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
          if (!verified) return null;
          return o;
        })
      )
    ).filter(Boolean);

    return validOperations;
  };

  const fetchSigners = useLatestCallback(async () => {
    const operations = await fetchOperations(
      [createDecoder(SIGNER_ADD_WAKU_CONTENT_TOPIC)],
      { limit: 100 }
    );
    mergeOperations(operations);
    return operations;
  });

  const fetchChannelMessages = useLatestCallback(async (channelId) => {
    const channelMessageAddContentTopic =
      createChannelMessageAddContentTopic(channelId);
    const operations = await fetchOperations([
      createDecoder(channelMessageAddContentTopic),
    ]);
    mergeOperations(operations);
    return operations;
  });

  return { fetchSigners, fetchChannelMessages };
};

export const useSubmitters = () => {
  const { account: custodyAddress, signerKeyPair } =
    React.useContext(SignerContext) ?? {};
  const { client: wakuClient } = React.useContext(WakuClientContext);

  const makeOperationData = (type, body) => ({
    body,
    type,
    user: custodyAddress,
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
        user: custodyAddress,
        signer,
      },
    });
    const data = makeOperationData(OperationTypes.SIGNER_ADD, { signer });
    const hash = hashOperationData(data);

    return {
      data,
      hash,
      signer: custodyAddress,
      signature,
    };
  };

  const submitChannelMessage = async (channelId, { content }) => {
    const contentTopic = createChannelMessageAddContentTopic(channelId);
    const encoder = createEncoder(contentTopic);
    const operation = await makeEdDSASignedOperation(
      OperationTypes.MESSAGE_ADD,
      { channelId, content }
    );
    return wakuClient.submitMessage(encoder, operation);
  };

  const submitSigner = async ({ signTypedData }) => {
    const encoder = createEncoder(SIGNER_ADD_WAKU_CONTENT_TOPIC);
    const operation = await makeECDSASignedSignerAddOperation({
      signerPublicKey: signerKeyPair.publicKey,
      signTypedData,
    });
    return wakuClient.submitMessage(encoder, operation);
  };

  return { submitSigner, submitChannelMessage };
};

export const useChannelSubscription = (channelId) => {
  const { client } = React.useContext(WakuClientContext);
  const [, mergeOperations] = React.useContext(StoreContext);
  const { didInitialize } = useClientState();

  React.useEffect(() => {
    if (!didInitialize) return;

    const contentTopics = getChannelSpecificContentTopics(channelId);

    const unsubscribe = client.subscribe(
      contentTopics.map(createDecoder),
      async (wakuMessagePayload) => {
        const verified = await verifyOperation(wakuMessagePayload);
        if (!verified) return;
        mergeOperations([wakuMessagePayload]);
      }
    );

    return () => {
      unsubscribe?.();
    };
  }, [client, didInitialize, channelId]);
};
