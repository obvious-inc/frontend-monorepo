import debug from "debug";
import {
  getPublicKey as getEdDSAPublicKey,
  sign as signWithEdDSAKey,
  verify as verifyEdDSASignature,
} from "@noble/ed25519";
import {
  keccak256 as hashWithKeccak256,
  verifyTypedData as verifyECDSATypedDataSignature,
} from "ethers/lib/utils";
import { waitForRemotePeer, createEncoder, createDecoder } from "@waku/core";
import {
  createLightNode,
  // createRelayNode,
  // createFullNode,
} from "@waku/create";
import { Protocols } from "@waku/interfaces";
import {
  utf8ToBytes,
  bytesToUtf8,
  hexToBytes,
  bytesToHex,
} from "@waku/byte-utils";

const log = debug("ns:waku-client");

export const OperationTypes = { MESSAGE_ADD: 1, SIGNER_ADD: 2 };

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

const createWakuContentTopic = (name) => `/newshades/1/${name}/json`;

const createChannelMessageAddWakuContentTopic = (channelId) =>
  createWakuContentTopic(
    `channel-message-add-${hashWithKeccak256(utf8ToBytes(channelId))}`
  );

const SIGNER_ADD_WAKU_CONTENT_TOPIC = createWakuContentTopic("signer-add");

// Topics everyone should listen to
const globalWakuContentTopics = [SIGNER_ADD_WAKU_CONTENT_TOPIC];

// const getUserWakuTopics = () => {}

const getChannelSpecificWakuTopics = (channelId) =>
  // Should include message deletes and updates, as well as downstream operations like reactions, replies, new members, etc.
  [createChannelMessageAddWakuContentTopic(channelId)];

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

  return ok;
};

const serializeWakuMessagePayload = (p) => utf8ToBytes(JSON.stringify(p));
const deserializeWakuMessagePayload = (p) => JSON.parse(bytesToUtf8(p));

export const createClient = async ({
  userEthereumAddress,
  signerEdDSAPrivateKey,
}) => {
  const node = await createLightNode({ defaultBootstrap: true });
  await node.start();
  await waitForRemotePeer(node, [
    Protocols.Filter,
    Protocols.LightPush,
    Protocols.Store,
  ]);

  node.store.peers().then((peers) => {
    peers.forEach((p) => {
      log(`connected to ${p.addresses[0].multiaddr.toString()}`);
    });
  });

  const createOperationFetcher =
    (wakuDecoders) =>
    async ({ limit = 30 } = {}) => {
      const wakuMessagePromises = [];

      for await (const page of node.store.queryGenerator(wakuDecoders, {
        pageDirection: "backward",
        pageSize: limit,
      })) {
        wakuMessagePromises.push(...page);
        if (wakuMessagePromises.length >= limit) break;
      }

      const wakuMessages = await Promise.all(wakuMessagePromises);

      const operations = wakuMessages
        .filter((m) => m != null)
        .map((m) => {
          try {
            return deserializeWakuMessagePayload(m.payload);
          } catch (e) {
            console.warn(e);
            return null;
          }
        })
        .filter((o) => validateOperationStructure(o));

      const validOperations = (
        await Promise.all(
          operations.map(async (o) => {
            if (!validateOperationStructure(o)) return null;
            const verified = await verifyOperation(o);
            if (!verified) return null;
            return o;
          })
        )
      ).filter(Boolean);

      log("fetched");

      return validOperations;
    };

  const createOperationSubmitter = (encoder) => (operation) => {
    log("submit", operation);
    return node.lightPush.push(encoder, {
      payload: serializeWakuMessagePayload(operation),
    });
  };

  const makeOperationData = (type, body) => ({
    body,
    type,
    user: userEthereumAddress,
    timestamp: new Date().getTime(),
  });

  const makeEdDSASignedOperation = async (type, body) => {
    const data = makeOperationData(type, body);
    const hash = hashOperationData(data);
    const signerPublicKeyBytes = await getEdDSAPublicKey(signerEdDSAPrivateKey);
    const signatureBytes = await signWithEdDSAKey(
      hexToBytes(hash),
      signerEdDSAPrivateKey
    );
    return {
      data,
      hash,
      signer: `0x${bytesToHex(signerPublicKeyBytes)}`,
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
        user: userEthereumAddress,
        signer,
      },
    });
    const data = makeOperationData(OperationTypes.SIGNER_ADD, { signer });
    const hash = hashOperationData(data);

    return {
      data,
      hash,
      signer: userEthereumAddress,
      signature,
    };
  };

  const fetchSigners = () => {
    const decoder = createDecoder(SIGNER_ADD_WAKU_CONTENT_TOPIC);
    return createOperationFetcher([decoder])({ limit: 100 });
  };

  const fetchChannelMessages = (channelId) => {
    const decoder = createDecoder(
      createChannelMessageAddWakuContentTopic(channelId)
    );
    return createOperationFetcher([decoder])();
  };

  const submitChannelMessage = async (channelId, { content }) => {
    const operation = await makeEdDSASignedOperation(
      OperationTypes.MESSAGE_ADD,
      { channelId, content }
    );
    const wakuContentTopic = createChannelMessageAddWakuContentTopic(channelId);
    return createOperationSubmitter(createEncoder(wakuContentTopic))(operation);
  };

  const submitSigner = async ({ signerPublicKey, signTypedData }) => {
    const operation = await makeECDSASignedSignerAddOperation({
      signerPublicKey,
      signTypedData,
    });
    return createOperationSubmitter(
      createEncoder(SIGNER_ADD_WAKU_CONTENT_TOPIC)
    )(operation);
  };

  const subscribe = async (channels, cb) => {
    const globalWakuDecoders = globalWakuContentTopics.map(createDecoder);

    const channelSpecificWakuDecoders = channels.flatMap((id) =>
      getChannelSpecificWakuTopics(id).map(createDecoder)
    );

    const unsubscribe = await node.filter.subscribe(
      [...globalWakuDecoders, ...channelSpecificWakuDecoders],
      async (message) => {
        const operation = deserializeWakuMessagePayload(message.payload);
        log("incoming message");
        if (!validateOperationStructure(operation)) return;
        const verified = await verifyOperation(operation);
        if (!verified) return;
        cb(operation);
      }
    );

    return unsubscribe;
  };

  return {
    subscribe,
    submitSigner,
    fetchSigners,
    fetchChannelMessages,
    submitChannelMessage,
  };
};
