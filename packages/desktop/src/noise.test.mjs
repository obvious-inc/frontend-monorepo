import { HMACDRBG } from "@stablelib/hmac-drbg";
import { randomBytes } from "@stablelib/random";
import * as x25519 from "@stablelib/x25519";
import {
  Handshake,
  MessageNametagBuffer,
  NoiseHandshakePatterns,
  // PayloadV2,
  NoisePublicKey,
} from "@waku/noise";

const test = it;
const assert = (value) => {
  expect(value).toBeTruthy();
};
const assertEqual = (v1, v2) => {
  expect(v1 === v2).toBeTruthy();
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const codec = {
  encode: (t) => encoder.encode(t),
  decode: (b) => decoder.decode(b),
};

const uint8ArrayEquals = (a, b) => {
  if (a === b) {
    return true;
  }

  if (a.byteLength !== b.byteLength) {
    return false;
  }

  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
};

const generateX25519KeyPair = () => {
  const keypair = x25519.generateKeyPair();

  return {
    publicKey: keypair.publicKey,
    privateKey: keypair.secretKey,
  };
};

const rng = new HMACDRBG();
const hsPattern = NoiseHandshakePatterns.XK1;

test("Noise XK1 Handhshake and message encryption (short test)", () => {
  // We initialize Alice's and Bob's Handshake State
  const aliceStaticKey = generateX25519KeyPair();
  const bobStaticKey = generateX25519KeyPair();

  // Alice knows Bob’s static key
  const preMessagePKs = [NoisePublicKey.fromPublicKey(bobStaticKey.publicKey)];

  const aliceHS = new Handshake({
    hsPattern,
    staticKey: aliceStaticKey,
    preMessagePKs,
    initiator: true,
  });
  const bobHS = new Handshake({
    hsPattern,
    staticKey: bobStaticKey,
    preMessagePKs,
  });

  const aliceWrite = (message) => {
    const step = aliceHS.stepHandshake({
      transportMessage: codec.encode(message),
    });
    return step.payload2;
  };
  const bobRead = (payload) => {
    const step = bobHS.stepHandshake({ readPayloadV2: payload });
    return step.transportMessage;
  };

  const bobWrite = (message) => {
    const step = bobHS.stepHandshake({
      transportMessage: codec.encode(message),
    });
    return step.payload2;
  };

  const aliceRead = (payload) => {
    const step = aliceHS.stepHandshake({
      readPayloadV2: payload,
    });
    return step.transportMessage;
  };

  // Here the handshake starts
  // Write and read calls alternate between Alice and Bob: the handhshake progresses by alternatively calling stepHandshake for each user

  // 1st step
  bobRead(aliceWrite("Hi Bob!"));
  aliceWrite("test");

  // 2nd step
  aliceRead(bobWrite("Hi Alice!"));

  // 3rd step
  bobRead(aliceWrite("Final!"));

  // After Handshake
  // ==========

  // We finalize the handshake to retrieve the Inbound/Outbound symmetric states
  const aliceHSResult = aliceHS.finalizeHandshake();
  const bobHSResult = bobHS.finalizeHandshake();

  const defaultMessageNametagBuffer = new MessageNametagBuffer();

  // We test read/write of random messages exchanged between Alice and Bob
  for (let i = 0; i < 10; i++) {
    // Alice writes to Bob
    let message = randomBytes(32);
    let payload2 = aliceHSResult.writeMessage(
      message,
      defaultMessageNametagBuffer
    );
    // let serializedPayload = payload2.serialize();
    // let deserializedPayload = PayloadV2.deserialize(serializedPayload);
    let readMessage = bobHSResult.readMessage(
      // deserializedPayload,
      payload2,
      defaultMessageNametagBuffer
    );

    assert(uint8ArrayEquals(message, readMessage));

    // Bob writes to Alice
    message = randomBytes(32);
    payload2 = bobHSResult.writeMessage(message, defaultMessageNametagBuffer);
    // serializedPayload = payload2.serialize();
    // deserializedPayload = PayloadV2.deserialize(serializedPayload);
    readMessage = aliceHSResult.readMessage(
      // deserializedPayload,
      payload2,
      defaultMessageNametagBuffer
    );

    assert(uint8ArrayEquals(message, readMessage));
  }
});
