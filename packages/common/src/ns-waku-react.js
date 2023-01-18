import debug from "debug";
import { sign as signWithEdDSAKey } from "@noble/ed25519";
import { createEncoder, createDecoder } from "@waku/core";
// import { createDecoder as createSymmetricDecoder } from "@waku/message-encryption/symmetric";
import { hexToBytes, bytesToHex } from "@waku/byte-utils";
import React from "react";
import { createClient as createWakuClient } from "./waku-client.js";
import useLatestCallback from "./hooks/latest-callback.js";
import {
  OPERATION_ECDSA_SIGNATURE_DOMAIN,
  SIGNER_ADD_OPERATION_ECDSA_SIGNATURE_TYPES,
  OperationTypes,
  BROADCAST_CONTENT_TOPIC,
  createUserContentTopic,
  createChannelContentTopic,
  createChannelMetaContentTopic,
  getChannelSpecificContentTopics,
  hashOperationData,
  verifyOperation,
} from "./ns-waku.js";
import {
  Provider as OperationStoreProvider,
  useOperationStore,
} from "./ns-waku-operation-store.js";

const log = debug("ns-waku-react");

const ClientContext = React.createContext();

const ClientProvider = ({ children }) => {
  const clientRef = React.useRef();
  const [didInitialize, setInitialized] = React.useState(false);

  React.useEffect(() => {
    createWakuClient().then((client) => {
      clientRef.current = client;
      setInitialized(true);
    });
  }, []);

  return (
    <ClientContext.Provider
      value={{ didInitialize, client: clientRef.current }}
    >
      {children}
    </ClientContext.Provider>
  );
};

const useClient = () => React.useContext(ClientContext);

const SignerContext = React.createContext();

const SignerProvider = ({ identity, signerKeyPair, children }) => (
  <SignerContext.Provider value={{ identity, signerKeyPair }}>
    {children}
  </SignerContext.Provider>
);

const useSigner = () => React.useContext(SignerContext);

const Bootstrap = ({ children }) => {
  const { identity } = useSigner();
  const { fetchBroadcasts, fetchUsers } = useFetchers();
  const { didInitialize } = useClient();

  const userContentTopics = [identity]
    .filter(Boolean)
    .map(createUserContentTopic);

  useSubscription([BROADCAST_CONTENT_TOPIC, ...userContentTopics]);

  React.useEffect(() => {
    if (!didInitialize) return;
    if (identity == null) return;
    fetchUsers([identity]);
  }, [didInitialize, identity, fetchUsers]);

  React.useEffect(() => {
    if (!didInitialize) return;
    fetchBroadcasts();
  }, [didInitialize, fetchBroadcasts]);

  return children;
};

export const Provider = ({ identity, signerKeyPair, children }) => (
  <ClientProvider>
    <SignerProvider identity={identity} signerKeyPair={signerKeyPair}>
      <OperationStoreProvider>
        <Bootstrap>{children}</Bootstrap>
      </OperationStoreProvider>
    </SignerProvider>
  </ClientProvider>
);

export const useClientState = () => {
  const { signerKeyPair } = useSigner();
  const { didInitialize, client } = useClient();

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

const useSubscription = (contentTopics) => {
  const { client } = useClient();
  const [, mergeOperations] = useOperationStore();
  const { didInitialize } = useClientState();

  const stringifiedTopics = contentTopics.join(" ");

  React.useEffect(() => {
    if (!didInitialize) return;

    const contentTopics = stringifiedTopics.split(" ");

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
  }, [client, didInitialize, stringifiedTopics]);
};

export const useFetchers = () => {
  const { client, didInitialize } = useClient();
  const [, mergeOperations] = useOperationStore();

  const fetchOperations = async (decoders, options) => {
    if (!didInitialize) throw new Error();

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
      { limit: 100 }
    );
    mergeOperations(operations);
    return operations;
  });

  return { fetchUsers, fetchChannel, fetchChannelMessages, fetchBroadcasts };
};

export const useSubmitters = () => {
  const { identity, signerKeyPair } = useSigner();
  const { client } = useClient();

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
    return client.submitMessage(encoder, operation);
  };

  const submitChannelAdd = useLatestCallback(async ({ name }) => {
    const operation = await makeEdDSASignedOperation(
      OperationTypes.CHANNEL_ADD,
      { name }
    );
    const channelId = operation.hash;
    const contentTopic = createChannelMetaContentTopic(channelId);
    const encoder = createEncoder(contentTopic);
    await client.submitMessage(encoder, operation);
    await submitChannelBroadcast(channelId);
    return { id: channelId };
  });

  const submitChannelRemove = useLatestCallback(async (channelId) => {
    const operation = await makeEdDSASignedOperation(
      OperationTypes.CHANNEL_REMOVE,
      { channelId }
    );
    const contentTopic = createChannelMetaContentTopic(channelId);
    const encoder = createEncoder(contentTopic);
    return client.submitMessage(encoder, operation);
  });

  const submitChannelMemberAdd = useLatestCallback(
    async (channelId, memberAddress) => {
      const operation = await makeEdDSASignedOperation(
        OperationTypes.CHANNEL_MEMBER_ADD,
        { channelId, user: memberAddress }
      );
      const contentTopic = createChannelMetaContentTopic(channelId);
      const encoder = createEncoder(contentTopic);
      return client.submitMessage(encoder, operation);
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
      return client.submitMessage(encoder, operation);
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
      return client.submitMessage(encoder, operation);
    }
  );

  const submitSignerAdd = useLatestCallback(async ({ signTypedData }) => {
    const encoder = createEncoder(createUserContentTopic(identity));
    const operation = await makeECDSASignedSignerAddOperation({
      signerPublicKey: signerKeyPair.publicKey,
      signTypedData,
    });
    return client.submitMessage(encoder, operation);
  });

  return {
    submitSignerAdd,
    submitChannelAdd,
    submitChannelRemove,
    submitChannelMessageAdd,
    submitChannelMessageRemove,
    submitChannelMemberAdd,
  };
};

export const useChannelSubscription = (channelId) => {
  const contentTopics = getChannelSpecificContentTopics(channelId);
  useSubscription(contentTopics);
};

export const useChannels = () => {
  const [{ channelsById }] = useOperationStore();
  const { fetchChannel } = useFetchers();

  const channels = [...channelsById.values()];

  const channelIds = channels.map((c) => c.id).join(":");

  React.useEffect(() => {
    if (channelIds === "") return;
    for (let id of channelIds.split(":")) {
      const channel = channelsById.get(id);
      if (channel.name != null) continue;
      fetchChannel(id);
    }
  }, [fetchChannel, channelsById, channelIds]);

  return channels;
};

export const useChannel = (channelId) => {
  const [{ channelsById }] = useOperationStore();
  return channelsById.get(channelId);
};

export const useChannelMembers = (channelId) => {
  const [{ memberAddressesByChannelId }] = useOperationStore();
  const addresses = memberAddressesByChannelId.get(channelId) ?? [];
  return addresses;
};

export const useChannelMessages = (channelId) => {
  const [{ messageIdsByChannelId, messagesById }] = useOperationStore();
  const channelMessageIdSet = messageIdsByChannelId.get(channelId) ?? new Set();
  return [...channelMessageIdSet]
    .map((id) => messagesById.get(id))
    .filter(Boolean);
};

export const useUsers = () => {
  const [{ signersByUserAddress }] = useOperationStore();

  const users = [...signersByUserAddress.entries()].map(
    ([address, signers]) => ({
      id: address,
      address,
      signers: [...signers],
    })
  );

  return users;
};
