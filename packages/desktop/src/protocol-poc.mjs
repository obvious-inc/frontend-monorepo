import { HKDF } from "@stablelib/hkdf";
import { SHA256 } from "@stablelib/sha256";
import {
  Handshake,
  CipherState,
  Nonce,
  NoiseHandshakePatterns,
  NoisePublicKey,
  generateX25519KeyPair,
  HandshakeResult,
} from "@waku/noise";
import { uint8Array as uint8ArrayUtils } from "@shades/common/utils";

const { equals: uint8ArrayEquals } = uint8ArrayUtils;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const encodeMessage = (m) => encoder.encode(JSON.stringify(m));
const decodeMessage = (m) => JSON.parse(decoder.decode(m));

const dh = (/* privateKey, publicKey */) => null;
const hkdf = (ck) => new HKDF(SHA256, new Uint8Array(), ck).expand(32);
const encryptSymmetric = (clearText) => clearText;
const decryptSymmetric = (cipherText) => cipherText;

const isHandshakeMessage = (m) => m.protocolId === 11;

const verifyMessage = (account, message) => {
  try {
    if (message.dhHeader?.key == null) throw new Error();
    const secret = dh(account.privateKey, message.dhHeader.key);
    return decryptSymmetric(message.payload, secret);
  } catch (e) {
    // console.warn(e)
    throw new Error("invalid-message");
  }
};

const derivePatritionedTopicFromKey = (publicKey) => publicKey;

const NETWORK_LATENCY = 100;

export const createDummyNetwork = () => {
  let subscribers = [];

  const subscribe = (topics, listener) => {
    const subscriber = { topics, listener };
    subscribers.push(subscriber);
    return () => {
      subscribers = subscribers.filter((s) => s !== subscriber);
    };
  };

  const publish = (topic, message) => {
    return new Promise((resolve) => {
      // Random latency
      const latency = Math.random() * NETWORK_LATENCY;
      setTimeout(() => {
        for (const subscriber of subscribers) {
          if (
            // Treat empty topic lists as "listen to everything"
            subscriber.topics.length === 0 ||
            subscriber.topics.some((t) => uint8ArrayEquals(t, topic))
          ) {
            subscriber.listener(message, topic);
          }
        }
        resolve();
      }, latency);
    });
  };

  return {
    publish,
    subscribe,
    // Test helper for waiting until the network is "idle"
    _idle: async (millis = NETWORK_LATENCY * 2) =>
      new Promise((resolve) => {
        let handle;

        const restartTimer = ({ onResolve }) => {
          clearTimeout(handle);
          handle = setTimeout(() => {
            onResolve();
            resolve();
          }, millis);
        };

        const unsubscribe = subscribe([], () => {
          restartTimer({ onResolve: unsubscribe });
        });

        restartTimer({ onResolve: unsubscribe });
      }),
  };
};

const createFilteredNode = ({ network }) => {
  const publishedMessages = [];
  return {
    publish: (topic, message) => {
      publishedMessages.push(message);
      return network.publish(topic, message);
    },
    subscribe: (topics, listener) =>
      network.subscribe(topics, async (message, topic) => {
        // Ignore self
        if (publishedMessages.includes(message)) return;
        listener(message, topic);
      }),
  };
};

const sessionCache = {};

export const createNode = ({ account, network }) => {
  const accountTopic = derivePatritionedTopicFromKey(account.publicKey);
  const observedTopics = [accountTopic];

  let listeners = [];

  const sessions = {};

  let accountsWithPendingHandshakes = [];

  const node = createFilteredNode({ network });

  const initSession = ({ recipientAccountPublicKey, sessionData }) => {
    const persist = (sessionData) => {
      const cache = sessionCache[account.publicKey] ?? [];
      cache.push(serializeSession(sessionData));
      sessionCache[account.publicKey] = cache;
    };

    const session = createNoiseSession({
      node,
      account,
      sessionData,
      onUpdate: (sessionData) => {
        // Cache session
        persist(sessionData);
      },
    });
    sessions[recipientAccountPublicKey] = session;
    accountsWithPendingHandshakes = accountsWithPendingHandshakes.filter((k) =>
      uint8ArrayEquals(k, recipientAccountPublicKey)
    );

    session.subscribe((message) => {
      for (const listener of listeners) listener(message, "noise");
    });

    persist(sessionData);

    return session;
  };

  const handleHandshakeMessage = async (message) => {
    try {
      const sessionData = await initNoiseHandshakeAsResponder({
        account,
        initiatorHandshakePayload: message,
        node,
      });

      initSession({
        recipientAccountPublicKey: sessionData.rs,
        sessionData,
      });
    } catch (e) {
      // console.warn(e);
    }
  };

  node.subscribe(observedTopics, async (message) => {
    if (isHandshakeMessage(message)) {
      handleHandshakeMessage(message);
      return;
    }

    try {
      const verifiedMessage = verifyMessage(account, message);
      for (const listener of listeners) listener(verifiedMessage.data, "dh");
    } catch (e) {
      if (e.message !== "invalid-message") throw e;
    }
  });

  const sendDH = (recipientAccountPublicKey, message) => {
    const ephemeralKey = generateX25519KeyPair();
    const secret = dh(ephemeralKey.privateKey, recipientAccountPublicKey);

    const topic = derivePatritionedTopicFromKey(recipientAccountPublicKey);

    return node.publish(topic, {
      dhHeader: { key: ephemeralKey.publicKey },
      payload: encryptSymmetric(
        { sender: account.publicKey, data: message },
        secret
      ),
    });
  };

  // Restore cached sessions
  if (sessionCache[account.publicKey] != null) {
    const serializedSessions = sessionCache[account.publicKey];
    for (const sessionData of serializedSessions.map(deserializeSession)) {
      initSession({ recipientAccountPublicKey: sessionData.rs, sessionData });
    }
  }

  return {
    accountPublicKey: account.publicKey,
    sendPrivate: async (recipientAccountPublicKey, message) => {
      const session = sessions[recipientAccountPublicKey];
      if (session != null) return session.send(message);

      const sendResult = await sendDH(recipientAccountPublicKey, message);

      if (
        accountsWithPendingHandshakes.some((k) =>
          uint8ArrayEquals(k, recipientAccountPublicKey)
        )
      )
        return sendResult;

      initNoiseHandshakeAsInitiator({
        account,
        node,
        recipientAccountPublicKey,
      }).then((sessionData) => {
        // TODO: wait until a message is received until this is used for sending
        initSession({ recipientAccountPublicKey, sessionData });
      });

      accountsWithPendingHandshakes.push(recipientAccountPublicKey);

      return sendResult;
    },
    observe: (listener) => {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    },
  };
};

const createHandshakeResult = ({
  csOutboundKey,
  csOutboundNonce,
  csInboundKey,
  csInboundNonce,
  nametagsOutboundSecret,
  nametagsOutboundCounter,
  nametagsInboundSecret,
  nametagsInboundCounter,
}) => {
  const csOutbound = new CipherState(csOutboundKey, csOutboundNonce);
  const csInbound = new CipherState(csInboundKey, csInboundNonce);
  const result = new HandshakeResult(csOutbound, csInbound);
  result.nametagsInbound.secret = nametagsInboundSecret;
  result.nametagsOutbound.secret = nametagsOutboundSecret;
  result.nametagsInbound.initNametagsBuffer(nametagsInboundCounter);
  result.nametagsOutbound.initNametagsBuffer(nametagsOutboundCounter);
  return result;
};

const serializeSession = ({
  id,
  rs,
  csOutboundKey,
  csOutboundNonce,
  csInboundKey,
  csInboundNonce,
  nametagsOutboundSecret,
  nametagsOutboundCounter,
  nametagsInboundSecret,
  nametagsInboundCounter,
}) => {
  return JSON.stringify({
    id: Array.apply([], id),
    rs: Array.apply([], rs),
    csOutboundKey: Array.apply([], csOutboundKey),
    csOutboundNonce: csOutboundNonce.getUint64(),
    csInboundKey: Array.apply([], csInboundKey),
    csInboundNonce: csInboundNonce.getUint64(),
    nametagsOutboundSecret: Array.apply([], nametagsOutboundSecret),
    nametagsOutboundCounter: nametagsOutboundCounter,
    nametagsInboundSecret: Array.apply([], nametagsInboundSecret),
    nametagsInboundCounter: nametagsInboundCounter,
  });
};

const deserializeSession = (jsonString) => {
  const {
    id,
    rs,
    csOutboundKey,
    csOutboundNonce,
    csInboundKey,
    csInboundNonce,
    nametagsOutboundSecret,
    nametagsOutboundCounter,
    nametagsInboundSecret,
    nametagsInboundCounter,
  } = JSON.parse(jsonString);

  return {
    id: new Uint8Array(id),
    rs: new Uint8Array(rs),
    csOutboundKey: new Uint8Array(csOutboundKey),
    csOutboundNonce: new Nonce(csOutboundNonce),
    csInboundKey: new Uint8Array(csInboundKey),
    csInboundNonce: new Nonce(csInboundNonce),
    nametagsOutboundSecret: new Uint8Array(nametagsOutboundSecret),
    nametagsOutboundCounter,
    nametagsInboundSecret: new Uint8Array(nametagsInboundSecret),
    nametagsInboundCounter,
  };
};

const extractSessionDataFromHandshakeState = (hs) => {
  const { cs1, cs2 } = hs.ss.split();
  const { nms1, nms2 } = hs.genMessageNametagSecrets();

  const id = hkdf(new Uint8Array(hs.ss.h));

  const shared = { id, rs: hs.rs };

  if (hs.initiator)
    return {
      ...shared,
      csOutboundKey: cs1.getKey(),
      csOutboundNonce: cs1.getNonce(),
      csInboundKey: cs2.getKey(),
      csInboundNonce: cs2.getNonce(),
      nametagsOutboundSecret: nms2,
      nametagsInboundSecret: nms1,
    };

  return {
    ...shared,
    csOutboundKey: cs2.getKey(),
    csOutboundNonce: cs2.getNonce(),
    csInboundKey: cs1.getKey(),
    csInboundNonce: cs1.getNonce(),
    nametagsOutboundSecret: nms1,
    nametagsInboundSecret: nms2,
  };
};

const finalizeHandshake = (hs) => {
  if (!hs.rs) throw new Error("invalid handshake state");
  return extractSessionDataFromHandshakeState(hs);
};

const initNoiseHandshakeAsInitiator = ({
  account,
  node,
  recipientAccountPublicKey,
}) => {
  const recipientTopic = derivePatritionedTopicFromKey(
    recipientAccountPublicKey
  );

  const handshake = new Handshake({
    hsPattern: NoiseHandshakePatterns.XK1,
    staticKey: account,
    preMessagePKs: [NoisePublicKey.fromPublicKey(recipientAccountPublicKey)],
    initiator: true,
  });

  const handshakeWrite = (includeNameTag = true) =>
    handshake.stepHandshake({
      messageNametag: includeNameTag
        ? handshake.hs.toMessageNametag()
        : undefined,
    }).payload2;
  const handshakeRead = (p) =>
    handshake.stepHandshake({
      readPayloadV2: p,
      messageNametag: handshake.hs.toMessageNametag(),
    });

  return new Promise((resolve) => {
    const unsubscribe = node.subscribe([recipientTopic], (payload) => {
      if (!isHandshakeMessage(payload)) return;

      try {
        // 2nd step
        //   <- e, ee, es
        handshakeRead(payload);

        // 3rd step
        //   -> s, se
        node.publish(recipientTopic, handshakeWrite());

        // Done, finalize handshake
        resolve(finalizeHandshake(handshake.hs));

        unsubscribe();
      } catch (e) {
        // console.warn(e);
      }
    });

    // 1st step
    //   -> e
    node.publish(recipientTopic, handshakeWrite(false));
  });
};

const initNoiseHandshakeAsResponder = ({
  account,
  node,
  initiatorHandshakePayload,
}) => {
  const accountTopic = derivePatritionedTopicFromKey(account.publicKey);

  const handshake = new Handshake({
    hsPattern: NoiseHandshakePatterns.XK1,
    staticKey: account,
    preMessagePKs: [NoisePublicKey.fromPublicKey(account.publicKey)],
  });

  const handshakeWrite = () =>
    handshake.stepHandshake({ messageNametag: handshake.hs.toMessageNametag() })
      .payload2;
  const handshakeRead = (p, includeNameTag = true) =>
    handshake.stepHandshake({
      readPayloadV2: p,
      messageNametag: includeNameTag
        ? handshake.hs.toMessageNametag()
        : undefined,
    });

  // 1st step (responser)
  //   -> e
  handshakeRead(initiatorHandshakePayload, false);

  return new Promise((resolve) => {
    const unsubscribe = node.subscribe([accountTopic], (payload) => {
      if (!isHandshakeMessage(payload)) return;

      try {
        // 3rd step (responder)
        //   -> s, se
        handshakeRead(payload);

        // Done, finalize handshake
        resolve(finalizeHandshake(handshake.hs));

        unsubscribe();
      } catch (e) {
        // console.warn(e);
      }
    });

    // 2nd step (responder)
    //   -> s, se
    node.publish(accountTopic, handshakeWrite());
  });
};

const createNoiseSessionIdBuffer = (initialId) => {
  const buffer = [initialId];

  while (buffer.length < 3) {
    const last = buffer.slice(-1)[0];
    buffer.push(hkdf(last));
  }

  return {
    next: () => buffer[1],
    shift: () => {
      buffer.shift();
      const last = buffer.slice(-1)[0];
      buffer.push(last);
    },
    indexOf: (item) => buffer.findIndex((i) => uint8ArrayEquals(i, item)),
    toArray: () => buffer,
  };
};

const createNoiseSession = ({ node, sessionData, onUpdate }) => {
  const sessionIdBuffer = createNoiseSessionIdBuffer(sessionData.id);
  const handshakeResult = createHandshakeResult(sessionData);

  let listeners = [];

  const emitSessionUpdate = () => {
    onUpdate?.({
      ...sessionData,
      id: sessionIdBuffer.toArray()[0],
      nametagsOutboundCounter: handshakeResult.nametagsOutbound.getCounter(),
      nametagsInboundCounter: handshakeResult.nametagsInbound.getCounter(),
    });
  };

  const read = (payload) => {
    const result = decodeMessage(handshakeResult.readMessage(payload));
    emitSessionUpdate();
    return result;
  };
  const write = (message) => {
    const payload = handshakeResult.writeMessage(encodeMessage(message));
    emitSessionUpdate();
    return payload;
  };

  const start = () => {
    let unsubscribe;
    let failedMessages = [];

    const subscribe = (handler) =>
      node.subscribe(sessionIdBuffer.toArray(), handler);

    const emit = (message) => {
      for (const listener of listeners) listener(message);
    };

    const retryFailed = () => {
      if (failedMessages.length === 0) return;

      for (let failedMessage of failedMessages) {
        try {
          const message = read(failedMessage);
          failedMessages = failedMessages.filter((m) => m !== message);
          emit(message);
          retryFailed();
        } catch (e) {
          // console.warn(e)
        }
      }
    };

    const handler = (payload, topic) => {
      try {
        const message = read(payload);

        if (sessionIdBuffer.indexOf(topic) > 0) {
          sessionIdBuffer.shift();
          emitSessionUpdate();
          unsubscribe();
          unsubscribe = subscribe(handler);
        }

        emit(message);
        retryFailed();
      } catch (e) {
        failedMessages.push(payload);
      }
    };

    unsubscribe = subscribe(handler);

    return () => {
      unsubscribe();
    };
  };

  const subscribe = (listener) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  };

  const send = (message) => {
    const payload = write(message);
    const nextSessionId = sessionIdBuffer.next();
    return node.publish(nextSessionId, payload);
  };

  start();

  return { subscribe, send };
};
