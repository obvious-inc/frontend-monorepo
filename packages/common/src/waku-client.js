import { bootstrap } from "@libp2p/bootstrap";
import { waitForRemotePeer } from "@waku/core";
import { createLightNode } from "@waku/create";
import { Protocols } from "@waku/interfaces";
import { utf8ToBytes, bytesToUtf8 } from "@waku/byte-utils";
import { fleets as statusWaku2Fleets } from "@waku/core/lib/predefined_bootstrap_nodes";

const bootstrapNodeAddresses = Object.values(
  statusWaku2Fleets.fleets["wakuv2.prod"]["waku-websocket"]
);
const staticPeerDiscovery = bootstrap({ list: bootstrapNodeAddresses });

const serializeWakuMessagePayload = (p) => utf8ToBytes(JSON.stringify(p));
const deserializeWakuMessagePayload = (p) => JSON.parse(bytesToUtf8(p));

export const createClient = async () => {
  // const node = await createLightNode({ defaultBootstrap: true });
  const node = await createLightNode({
    libp2p: {
      peerDiscovery: [staticPeerDiscovery],
    },
  });
  await node.start();
  await waitForRemotePeer(node, [
    Protocols.Filter,
    Protocols.LightPush,
    Protocols.Store,
  ]);

  // Preferr the peer that connects first
  const preferredPeer = (await node.store.peers())[0];

  const fetchMessages = async (wakuDecoders, { limit = 30 } = {}) => {
    const wakuMessagePromises = [];

    for await (const page of node.store.queryGenerator(wakuDecoders, {
      peerId: preferredPeer.id,
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

  const submitMessage = async (encoder, payload) => {
    await node.lightPush.push(encoder, {
      payload: serializeWakuMessagePayload(payload),
    });
    return payload;
  };

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
