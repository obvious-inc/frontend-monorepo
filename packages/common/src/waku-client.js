import { waitForRemotePeer } from "@waku/core";
import { createLightNode } from "@waku/create";
import { Protocols } from "@waku/interfaces";
import { utf8ToBytes, bytesToUtf8 } from "@waku/byte-utils";

const serializeWakuMessagePayload = (p) => utf8ToBytes(JSON.stringify(p));
const deserializeWakuMessagePayload = (p) => JSON.parse(bytesToUtf8(p));

export const createClient = async () => {
  const node = await createLightNode({ defaultBootstrap: true });
  await node.start();
  await waitForRemotePeer(node, [
    Protocols.Filter,
    Protocols.LightPush,
    Protocols.Store,
  ]);

  const fetchMessages = async (wakuDecoders, { limit = 30 } = {}) => {
    const wakuMessagePromises = [];

    for await (const page of node.store.queryGenerator(wakuDecoders, {
      pageDirection: "backward",
      pageSize: limit,
    })) {
      wakuMessagePromises.push(...page);
      if (wakuMessagePromises.length >= limit) break;
    }

    const wakuMessages = await Promise.all(wakuMessagePromises);

    const validMessages = wakuMessages
      .filter((m) => m != null)
      .map((m) => {
        try {
          return deserializeWakuMessagePayload(m.payload);
        } catch (e) {
          return null;
        }
      });

    return validMessages;
  };

  const submitMessage = (encoder, payload) =>
    node.lightPush.push(encoder, {
      payload: serializeWakuMessagePayload(payload),
    });

  const subscribe = async (decoders, cb) => {
    const unsubscribe = await node.filter.subscribe(
      decoders,
      async (message) => {
        try {
          const payload = deserializeWakuMessagePayload(message.payload);
          cb(payload);
        } catch (e) {
          // Ignore
        }
      }
    );

    return unsubscribe;
  };

  const getPeers = async () =>
    node.store.peers().then((peers) =>
      peers.map((p) => ({
        id: p.id.toString(),
        name: p.addresses[0].multiaddr.toString(),
      }))
    );

  return {
    fetchMessages,
    submitMessage,
    subscribe,
    getPeers,
  };
};
