import { HKDF } from "@stablelib/hkdf";
import { SHA256 } from "@stablelib/sha256";
import {
  Handshake,
  NoiseHandshakePatterns,
  NoisePublicKey,
  generateX25519KeyPair,
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
  if (message.dhHeader?.key == null) throw new Error();
  const secret = dh(account.privateKey, message.dhHeader.key);
  return decryptSymmetric(message.payload, secret);
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

export const createNode = ({ account, network }) => {
  const accountTopic = derivePatritionedTopicFromKey(account.publicKey);
  const observedTopics = [accountTopic];

  let listeners = [];

  const sessions = {};
  let accountsWithPendingHandshakes = [];

  const node = createFilteredNode({ network });

  const initSession = ({ recipientAccountPublicKey, handshakeResult }) => {
    const session = createNoiseSession({
      node,
      account,
      handshakeResult,
    });
    sessions[recipientAccountPublicKey] = session;
    accountsWithPendingHandshakes = accountsWithPendingHandshakes.filter((k) =>
      uint8ArrayEquals(k, recipientAccountPublicKey)
    );

    session.subscribe((message) => {
      for (const listener of listeners) listener(message, "noise");
    });

    return session;
  };

  const handleHandshakeMessage = async (message) => {
    try {
      const handshakeResult = await initNoiseHandshakeAsResponder({
        account,
        initiatorHandshakePayload: message,
        node,
      });

      initSession({
        recipientAccountPublicKey: handshakeResult.rs,
        handshakeResult,
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
      // console.warn(e)
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
      }).then((handshakeResult) => {
        // TODO: wait until a message is received until this is used for sending
        initSession({ recipientAccountPublicKey, handshakeResult });
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
        resolve(handshake.finalizeHandshake());

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
        resolve(handshake.finalizeHandshake());

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

const createNoiseSessionIdBuffer = (handshakeHash) => {
  const buffer = [hkdf(handshakeHash)];

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

const createNoiseSession = ({ node, handshakeResult }) => {
  const sessionIdBuffer = createNoiseSessionIdBuffer(handshakeResult.h);

  let listeners = [];

  const start = () => {
    let unsubscribe;
    let failedMessages = [];

    const subscribe = (handler) =>
      node.subscribe(sessionIdBuffer.toArray(), handler);

    const read = (payload) =>
      decodeMessage(handshakeResult.readMessage(payload));
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
    const payload = handshakeResult.writeMessage(encodeMessage(message));
    const nextSessionId = sessionIdBuffer.next();
    return node.publish(nextSessionId, payload);
  };

  start();

  return { subscribe, send };
};
