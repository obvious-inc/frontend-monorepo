import { verify as verifyEdDSASignature } from "@noble/ed25519";
import { verifyTypedData as verifyECDSATypedDataSignature } from "ethers/lib/utils";
import { keccak256 } from "ethers/lib/utils";
import { utf8ToBytes, hexToBytes } from "@waku/byte-utils";
import {
  createDecoder as createSymmetricDecoder,
  createEncoder as createSymmetricEncoder,
} from "@waku/message-encryption/symmetric";
import { mirror } from "./utils/object.js";
import { assertString, assertNumber } from "./utils/assert.js";

export const OPERATION_ECDSA_SIGNATURE_DOMAIN = {
  name: "NewShades Message Signature",
  version: "1.0.0",
};

export const SIGNER_ADD_OPERATION_ECDSA_SIGNATURE_TYPES = {
  SignerData: [
    { name: "user", type: "address" },
    { name: "signer", type: "string" },
  ],
};

export const OperationTypes = {
  SIGNER_ADD: 1,
  CHANNEL_ADD: 2,
  CHANNEL_REMOVE: 3,
  CHANNEL_MEMBER_ADD: 4,
  CHANNEL_MEMBER_REMOVE: 5,
  CHANNEL_MESSAGE_ADD: 6,
  CHANNEL_MESSAGE_REMOVE: 7,
  CHANNEL_BROADCAST: 30,
};

export const getOperationTypeName = (type) => mirror(OperationTypes)[type];

const create32ByteEncryptionKeyFromString = (string) =>
  hexToBytes(keccak256(utf8ToBytes(string)));

const createContentTopic = (name) => `/newshades/1/${name}/json`;

export const BROADCAST_CONTENT_TOPIC = createContentTopic("broadcast");

export const createUserContentTopic = (identityAddress) =>
  createContentTopic(`user-${identityAddress.toLowerCase()}`);

const createPublicChannelContentTopic = (channelId) =>
  createContentTopic(`channel-${channelId}`);

const createPublicChannelMetaContentTopic = (channelId) =>
  createContentTopic(`channel-meta-${channelId}`);

const createSymmetricEncryptionCodec = (contentTopic) => {
  // Derive encryption key from content topic
  const encryptionKey = create32ByteEncryptionKeyFromString(contentTopic);
  return {
    encoder: createSymmetricEncoder(contentTopic, encryptionKey),
    decoder: createSymmetricDecoder(contentTopic, encryptionKey),
  };
};

export const createPublicChannelCodec = (channelId) =>
  createSymmetricEncryptionCodec(createPublicChannelContentTopic(channelId));

export const createPublicChannelMetaCodec = (channelId) =>
  createSymmetricEncryptionCodec(
    createPublicChannelMetaContentTopic(channelId)
  );

export const hashOperationData = (data) =>
  keccak256(utf8ToBytes(JSON.stringify(data))).slice(2);

const validateOperationStructure = (o) => {
  if (o?.data?.body == null) return false;
  if (!assertString(o.hash)) return false;
  if (!assertString(o.signer)) return false;
  if (!assertString(o.signature)) return false;
  if (!assertString(o.data?.user)) return false;
  if (!assertNumber(o.data?.type)) return false;
  if (!assertNumber(o.data?.timestamp)) return false;

  const { body } = o.data;

  switch (o.data.type) {
    case OperationTypes.CHANNEL_MEMBER_ADD:
      return [body.channelId, body.user].every(assertString);
    // validate all types
    default:
      return true;
  }
};

export const verifyOperation = async (operation) => {
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

export const validateOperationPermissions = (o, state) => {
  const { channelsById, memberAddressesByChannelId, messagesById } = state;

  switch (o.data.type) {
    case OperationTypes.CHANNEL_MEMBER_ADD: {
      const channelId = o.data.body.channelId;
      const channel = channelsById.get(channelId);
      return channel != null && channel.owner === o.data.user;
    }

    case OperationTypes.CHANNEL_REMOVE: {
      const { channelId } = o.data.body;
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
