import { HMACDRBG } from "@stablelib/hmac-drbg";
import { randomBytes } from "@stablelib/random";
import { expect } from "chai";
import { equals as uint8ArrayEquals } from "uint8arrays/equals";

import { chaCha20Poly1305Encrypt, dh, generateX25519KeyPair } from "./crypto";
import { Handshake, HandshakeStepResult } from "./handshake";
import { MessageNametagBuffer, MessageNametagLength } from "./messagenametag";
import { CipherState, createEmptyKey, SymmetricState } from "./noise";
import { MAX_NONCE, Nonce } from "./nonce";
import { NoiseHandshakePatterns } from "./patterns";
import { PayloadV2 } from "./payload";
import { ChaChaPolyCipherState, NoisePublicKey } from "./publickey";

function randomCipherState(rng: HMACDRBG, nonce: number = 0): CipherState {
  const randomCipherState = new CipherState();
  randomCipherState.n = new Nonce(nonce);
  randomCipherState.k = rng.randomBytes(32);
  return randomCipherState;
}

function c(input: Uint8Array): Uint8Array {
  return new Uint8Array(input);
}

function randomChaChaPolyCipherState(rng: HMACDRBG): ChaChaPolyCipherState {
  const k = rng.randomBytes(32);
  const n = rng.randomBytes(16);
  const ad = rng.randomBytes(32);
  return new ChaChaPolyCipherState(k, n, ad);
}

function randomNoisePublicKey(): NoisePublicKey {
  const keypair = generateX25519KeyPair();
  return new NoisePublicKey(0, keypair.publicKey);
}

function randomPayloadV2(rng: HMACDRBG): PayloadV2 {
  const messageNametag = randomBytes(MessageNametagLength, rng);
  const protocolId = 14;
  const handshakeMessage = [randomNoisePublicKey(), randomNoisePublicKey(), randomNoisePublicKey()];
  const transportMessage = randomBytes(128);
  return new PayloadV2(messageNametag, protocolId, handshakeMessage, transportMessage);
}

describe("js-noise", () => {
  const rng = new HMACDRBG();

  it("ChaChaPoly Encryption/Decryption: random byte sequences", function () {
    const cipherState = randomChaChaPolyCipherState(rng);

    // We encrypt/decrypt random byte sequences
    const plaintext = rng.randomBytes(128);
    const ciphertext = cipherState.encrypt(plaintext);
    const decrypted = cipherState.decrypt(ciphertext);

    expect(uint8ArrayEquals(decrypted, plaintext)).to.be.true;
  });

  it("ChaChaPoly Encryption/Decryption: random byte sequences", function () {
    const cipherState = randomChaChaPolyCipherState(rng);

    // We encrypt/decrypt random byte sequences
    const plaintext = rng.randomBytes(128);
    const ciphertext = cipherState.encrypt(plaintext);
    const decrypted = cipherState.decrypt(ciphertext);

    expect(uint8ArrayEquals(decrypted, plaintext)).to.be.true;
  });

  it("Noise public keys: encrypt and decrypt a public key", function () {
    const noisePublicKey = randomNoisePublicKey();
    const cipherState = randomChaChaPolyCipherState(rng);

    const encryptedPK = NoisePublicKey.encrypt(noisePublicKey, cipherState);
    const decryptedPK = NoisePublicKey.decrypt(encryptedPK, cipherState);

    expect(noisePublicKey.equals(decryptedPK)).to.be.true;
  });

  it("Noise public keys: decrypt an unencrypted  public key", function () {
    const noisePublicKey = randomNoisePublicKey();
    const cipherState = randomChaChaPolyCipherState(rng);

    const decryptedPK = NoisePublicKey.decrypt(noisePublicKey, cipherState);

    expect(noisePublicKey.equals(decryptedPK)).to.be.true;
  });

  it("Noise public keys: encrypt an encrypted public key", function () {
    const noisePublicKey = randomNoisePublicKey();
    const cipherState = randomChaChaPolyCipherState(rng);

    const encryptedPK = NoisePublicKey.encrypt(noisePublicKey, cipherState);
    const encryptedPK2 = NoisePublicKey.encrypt(encryptedPK, cipherState);

    expect(encryptedPK.equals(encryptedPK2)).to.be.true;
  });

  it("Noise public keys: encrypt, decrypt and decrypt a public key", function () {
    const noisePublicKey = randomNoisePublicKey();
    const cipherState = randomChaChaPolyCipherState(rng);

    const encryptedPK = NoisePublicKey.encrypt(noisePublicKey, cipherState);
    const decryptedPK = NoisePublicKey.decrypt(encryptedPK, cipherState);
    const decryptedPK2 = NoisePublicKey.decrypt(decryptedPK, cipherState);

    expect(decryptedPK.equals(decryptedPK2)).to.be.true;
  });

  it("Noise public keys: serialize and deserialize an unencrypted public key", function () {
    const noisePublicKey = randomNoisePublicKey();
    const serializedNoisePublicKey = noisePublicKey.serialize();
    const deserializedNoisePublicKey = NoisePublicKey.deserialize(serializedNoisePublicKey);

    expect(noisePublicKey.equals(deserializedNoisePublicKey)).to.be.true;
  });

  it("Noise public keys: encrypt, serialize, deserialize and decrypt a public key", function () {
    const noisePublicKey = randomNoisePublicKey();
    const cipherState = randomChaChaPolyCipherState(rng);

    const encryptedPK = NoisePublicKey.encrypt(noisePublicKey, cipherState);
    const serializedNoisePublicKey = encryptedPK.serialize();
    const deserializedNoisePublicKey = NoisePublicKey.deserialize(serializedNoisePublicKey);
    const decryptedPK = NoisePublicKey.decrypt(deserializedNoisePublicKey, cipherState);

    expect(noisePublicKey.equals(decryptedPK)).to.be.true;
  });

  it("PayloadV2: serialize/deserialize PayloadV2 to byte sequence", function () {
    const payload2 = randomPayloadV2(rng);
    const serializedPayload = payload2.serialize();
    const deserializedPayload = PayloadV2.deserialize(serializedPayload);
    expect(deserializedPayload.equals(payload2)).to.be.true;
  });

  it("Noise State Machine: Diffie-Hellman operation", function () {
    const aliceKey = generateX25519KeyPair();
    const bobKey = generateX25519KeyPair();

    // A Diffie-Hellman operation between Alice's private key and Bob's public key must be equal to
    // a Diffie-hellman operation between Alice's public key and Bob's private key
    const dh1 = dh(aliceKey.privateKey, bobKey.publicKey);
    const dh2 = dh(bobKey.privateKey, aliceKey.publicKey);

    expect(uint8ArrayEquals(dh1, dh2)).to.be.true;
  });

  it("Noise State Machine: Cipher State primitives", function () {
    // We generate a random Cipher State, associated data ad and plaintext
    let cipherState = randomCipherState(rng);
    let nonceValue = Math.floor(Math.random() * MAX_NONCE);
    const ad = randomBytes(128, rng);
    let plaintext = randomBytes(128, rng);
    let nonce = new Nonce(nonceValue);

    // We set the random nonce generated in the cipher state
    cipherState.setNonce(nonce);

    // We perform encryption
    let ciphertext = cipherState.encryptWithAd(ad, plaintext);

    // After any encryption/decryption operation, the Cipher State's nonce increases by 1
    expect(cipherState.getNonce().getUint64()).to.be.equals(nonceValue + 1);

    // We set the nonce back to its original value for decryption
    cipherState.setNonce(new Nonce(nonceValue));

    // We decrypt (using the original nonce)
    const decrypted = cipherState.decryptWithAd(ad, ciphertext);

    // We check if encryption and decryption are correct and that nonce correctly increased after decryption
    expect(cipherState.getNonce().getUint64()).to.be.equals(nonceValue + 1);
    expect(uint8ArrayEquals(plaintext, decrypted)).to.be.true;

    // If a Cipher State has no key set, encryptWithAd should return the plaintext without increasing the nonce
    cipherState.setCipherStateKey(createEmptyKey());
    nonce = cipherState.getNonce();
    nonceValue = nonce.getUint64();
    plaintext = randomBytes(128, rng);
    ciphertext = cipherState.encryptWithAd(ad, plaintext);

    expect(uint8ArrayEquals(ciphertext, plaintext)).to.be.true;
    expect(cipherState.getNonce().getUint64()).to.be.equals(nonceValue);

    // If a Cipher State has no key set, decryptWithAd should return the ciphertext without increasing the nonce
    cipherState.setCipherStateKey(createEmptyKey());
    nonce = cipherState.getNonce();
    nonceValue = nonce.getUint64();
    ciphertext = randomBytes(128, rng);
    plaintext = cipherState.decryptWithAd(ad, ciphertext);

    expect(uint8ArrayEquals(ciphertext, plaintext)).to.be.true;
    expect(cipherState.getNonce().getUint64()).to.be.equals(nonceValue);

    // A Cipher State cannot have a nonce greater or equal 0xffffffff in this implementation (see nonce.ts for details)
    // Note that nonce is increased after each encryption and decryption operation

    // We generate a test Cipher State with nonce set to MaxNonce
    cipherState = randomCipherState(rng);
    cipherState.setNonce(new Nonce(MAX_NONCE));
    plaintext = randomBytes(128, rng);

    // We test if encryption fails. Any subsequent encryption call over the Cipher State should fail similarly and leave the nonce unchanged
    for (let i = 0; i < 5; i++) {
      try {
        ciphertext = cipherState.encryptWithAd(ad, plaintext);
        expect(true).to.be.false; // Should not reach this line
      } catch (err) {
        // Do nothing
      }
      expect(cipherState.getNonce().getUint64()).to.be.equals(MAX_NONCE + 1);
    }

    // We generate a test Cipher State
    // Since nonce is increased after decryption as well, we need to generate a proper ciphertext in order to test MaxNonceError error handling
    // We cannot call encryptWithAd to encrypt a plaintext using a nonce equal MaxNonce, since this will trigger a MaxNonceError.
    // To perform such test, we then need to encrypt a test plaintext using directly ChaChaPoly primitive
    cipherState = randomCipherState(rng);
    cipherState.setNonce(new Nonce(MAX_NONCE));
    plaintext = randomBytes(128, rng);

    // We perform encryption using the Cipher State key, NonceMax and ad
    ciphertext = chaCha20Poly1305Encrypt(plaintext, cipherState.getNonce().getBytes(), ad, cipherState.getKey());

    // At this point ciphertext is a proper encryption of the original plaintext obtained with nonce equal to NonceMax
    // We can now test if decryption fails with a NoiseNonceMaxError error. Any subsequent decryption call over the Cipher State should fail similarly and leave the nonce unchanged
    // Note that decryptWithAd doesn't fail in decrypting the ciphertext (otherwise a NoiseDecryptTagError would have been triggered)
    for (let i = 0; i < 5; i++) {
      try {
        plaintext = cipherState.decryptWithAd(ad, ciphertext);
        expect(true).to.be.false; // Should not reach this line
      } catch (err) {
        // Do nothing
      }

      expect(cipherState.getNonce().getUint64()).to.be.equals(MAX_NONCE + 1);
    }
  });

  it("Noise State Machine: Cipher State primitives", function () {
    // We select one supported handshake pattern and we initialize a symmetric state
    const hsPattern = NoiseHandshakePatterns.XX;
    let symmetricState = new SymmetricState(hsPattern);

    // We get all the Symmetric State field
    let cs = symmetricState.getCipherState().clone(); // Cipher State
    let ck = c(symmetricState.getChainingKey()); // chaining key
    let h = c(symmetricState.getHandshakeHash()); // handshake hash

    // When a Symmetric state is initialized, handshake hash and chaining key are (byte-wise) equal
    expect(uint8ArrayEquals(h, ck)).to.be.true;

    // mixHash
    // ==========

    // We generate a random byte sequence and execute a mixHash over it
    symmetricState.mixHash(rng.randomBytes(128));

    // mixHash changes only the handshake hash value of the Symmetric state
    expect(cs.equals(symmetricState.getCipherState())).to.be.true;
    expect(uint8ArrayEquals(symmetricState.getChainingKey(), ck)).to.be.true;
    expect(uint8ArrayEquals(symmetricState.getHandshakeHash(), h)).to.be.false;

    // We update test values
    h = c(symmetricState.getHandshakeHash());

    // mixKey
    // ==========

    // We generate random input key material and we execute mixKey
    let inputKeyMaterial = rng.randomBytes(128);
    symmetricState.mixKey(inputKeyMaterial);

    // mixKey changes the Symmetric State's chaining key and encryption key of the embedded Cipher State
    // It further sets to 0 the nonce of the embedded Cipher State
    expect(uint8ArrayEquals(cs.getKey(), symmetricState.cs.getKey())).to.be.false;
    expect(symmetricState.getCipherState().getNonce().equals(new Nonce())).to.be.true;
    expect(cs.equals(symmetricState.getCipherState())).to.be.false;
    expect(uint8ArrayEquals(symmetricState.getChainingKey(), ck)).to.be.false;
    expect(uint8ArrayEquals(symmetricState.getHandshakeHash(), h)).to.be.true;

    // We update test values
    cs = symmetricState.getCipherState().clone();
    ck = c(symmetricState.getChainingKey());

    // mixKeyAndHash
    // ==========

    // We generate random input key material and we execute mixKeyAndHash
    inputKeyMaterial = rng.randomBytes(128);
    symmetricState.mixKeyAndHash(inputKeyMaterial);

    // mixKeyAndHash executes a mixKey and a mixHash using the input key material
    // All Symmetric State's fields are updated
    expect(cs.equals(symmetricState.getCipherState())).to.be.false;
    expect(uint8ArrayEquals(symmetricState.getChainingKey(), ck)).to.be.false;
    expect(uint8ArrayEquals(symmetricState.getHandshakeHash(), h)).to.be.false;

    // We update test values
    cs = symmetricState.getCipherState().clone();
    ck = c(symmetricState.getChainingKey());
    h = c(symmetricState.getHandshakeHash());

    // encryptAndHash and decryptAndHash
    // =========

    // We store the initial symmetricState in order to correctly perform decryption
    const initialSymmetricState = symmetricState.clone();

    // We generate random plaintext and we execute encryptAndHash
    const plaintext = rng.randomBytes(128);
    const nonce = symmetricState.getCipherState().getNonce().clone();
    const ciphertext = symmetricState.encryptAndHash(plaintext);
    // encryptAndHash combines encryptWithAd and mixHash over the ciphertext (encryption increases the nonce of the embedded Cipher State but does not change its key)
    // We check if only the handshake hash value and the Symmetric State changed accordingly
    expect(cs.equals(symmetricState.getCipherState())).to.be.false;
    expect(uint8ArrayEquals(cs.getKey(), symmetricState.getCipherState().getKey())).to.be.true;
    expect(symmetricState.getCipherState().getNonce().getUint64()).to.be.equals(nonce.getUint64() + 1);
    expect(uint8ArrayEquals(ck, symmetricState.getChainingKey())).to.be.true;
    expect(uint8ArrayEquals(h, symmetricState.getHandshakeHash())).to.be.false;

    // We restore the symmetric State to its initial value to test decryption
    symmetricState = initialSymmetricState;

    // We execute decryptAndHash over the ciphertext
    const decrypted = symmetricState.decryptAndHash(ciphertext);
    // decryptAndHash combines decryptWithAd and mixHash over the ciphertext (encryption increases the nonce of the embedded Cipher State but does not change its key)
    // We check if only the handshake hash value and the Symmetric State changed accordingly
    // We further check if decryption corresponds to the original plaintext
    expect(cs.equals(symmetricState.getCipherState())).to.be.false;
    expect(uint8ArrayEquals(cs.getKey(), symmetricState.getCipherState().getKey())).to.be.true;
    expect(symmetricState.getCipherState().getNonce().getUint64()).to.be.equals(nonce.getUint64() + 1);
    expect(uint8ArrayEquals(ck, symmetricState.getChainingKey())).to.be.true;
    expect(uint8ArrayEquals(h, symmetricState.getHandshakeHash())).to.be.false;
    expect(uint8ArrayEquals(decrypted, plaintext)).to.be.true;

    // split
    // ==========

    // If at least one mixKey is executed (as above), ck is non-empty
    expect(uint8ArrayEquals(symmetricState.getChainingKey(), createEmptyKey())).to.be.false;

    // When a Symmetric State's ck is non-empty, we can execute split, which creates two distinct Cipher States cs1 and cs2
    // with non-empty encryption keys and nonce set to 0
    const { cs1, cs2 } = symmetricState.split();
    expect(uint8ArrayEquals(cs1.getKey(), createEmptyKey())).to.be.false;
    expect(uint8ArrayEquals(cs2.getKey(), createEmptyKey())).to.be.false;
    expect(cs1.getNonce().getUint64()).to.be.equals(0);
    expect(cs2.getNonce().getUint64()).to.be.equals(0);
    expect(uint8ArrayEquals(cs1.getKey(), cs2.getKey())).to.be.false;
  });

  it("Noise XX Handhshake and message encryption (extended test)", function () {
    const hsPattern = NoiseHandshakePatterns.XX;

    // We initialize Alice's and Bob's Handshake State
    const aliceStaticKey = generateX25519KeyPair();
    const aliceHS = new Handshake({ hsPattern, staticKey: aliceStaticKey, initiator: true });

    const bobStaticKey = generateX25519KeyPair();
    const bobHS = new Handshake({ hsPattern, staticKey: bobStaticKey });

    let sentTransportMessage: Uint8Array;
    let aliceStep: HandshakeStepResult;
    let bobStep: HandshakeStepResult;

    // Here the handshake starts
    // Write and read calls alternate between Alice and Bob: the handhshake progresses by alternatively calling stepHandshake for each user

    // 1st step
    // ==========

    // We generate a random transport message
    sentTransportMessage = randomBytes(32, rng);

    // By being the handshake initiator, Alice writes a Waku2 payload v2 containing her handshake message
    // and the (encrypted) transport message
    aliceStep = aliceHS.stepHandshake({ transportMessage: sentTransportMessage });
    // Bob reads Alice's payloads, and returns the (decrypted) transport message Alice sent to him
    bobStep = bobHS.stepHandshake({ readPayloadV2: aliceStep.payload2 });

    expect(uint8ArrayEquals(bobStep.transportMessage, sentTransportMessage)).to.be.true;

    // 2nd step
    // ==========

    // We generate a random transport message
    sentTransportMessage = randomBytes(32, rng);

    // At this step, Bob writes and returns a payload
    bobStep = bobHS.stepHandshake({ transportMessage: sentTransportMessage });

    // While Alice reads and returns the (decrypted) transport message
    aliceStep = aliceHS.stepHandshake({ readPayloadV2: bobStep.payload2 });

    expect(uint8ArrayEquals(aliceStep.transportMessage, sentTransportMessage)).to.be.true;

    // 3rd step
    // ==========

    // We generate a random transport message
    sentTransportMessage = randomBytes(32, rng);

    // Similarly as in first step, Alice writes a Waku2 payload containing the handshake message and the (encrypted) transport message
    aliceStep = aliceHS.stepHandshake({ transportMessage: sentTransportMessage });

    // Bob reads Alice's payloads, and returns the (decrypted) transport message Alice sent to him
    bobStep = bobHS.stepHandshake({ readPayloadV2: aliceStep.payload2 });

    expect(uint8ArrayEquals(bobStep.transportMessage, sentTransportMessage)).to.be.true;

    // Note that for this handshake pattern, no more message patterns are left for processing
    // Another call to stepHandshake would return an empty HandshakeStepResult
    // We test that extra calls to stepHandshake do not affect parties' handshake states
    // and that the intermediate HandshakeStepResult are empty
    const prevAliceHS = aliceHS.clone();
    const prevBobHS = bobHS.clone();

    const bobStep1 = bobHS.stepHandshake({ transportMessage: sentTransportMessage });
    const aliceStep1 = aliceHS.stepHandshake({ readPayloadV2: bobStep1.payload2 });
    const aliceStep2 = aliceHS.stepHandshake({ transportMessage: sentTransportMessage });
    const bobStep2 = bobHS.stepHandshake({ readPayloadV2: aliceStep2.payload2 });

    const defaultHandshakeStepResult = new HandshakeStepResult();

    expect(aliceStep1.equals(defaultHandshakeStepResult)).to.be.true;
    expect(aliceStep2.equals(defaultHandshakeStepResult)).to.be.true;
    expect(bobStep1.equals(defaultHandshakeStepResult)).to.be.true;
    expect(bobStep2.equals(defaultHandshakeStepResult)).to.be.true;
    expect(aliceHS.equals(prevAliceHS)).to.be.true;
    expect(bobHS.equals(prevBobHS)).to.be.true;

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
      let payload2 = aliceHSResult.writeMessage(message, defaultMessageNametagBuffer);
      let serializedPayload = payload2.serialize();
      let deserializedPayload = PayloadV2.deserialize(serializedPayload);
      let readMessage = bobHSResult.readMessage(deserializedPayload, defaultMessageNametagBuffer);

      expect(uint8ArrayEquals(message, readMessage)).to.be.true;

      // Bob writes to Alice
      message = randomBytes(32);
      payload2 = bobHSResult.writeMessage(message, defaultMessageNametagBuffer);
      serializedPayload = payload2.serialize();
      deserializedPayload = PayloadV2.deserialize(serializedPayload);
      readMessage = aliceHSResult.readMessage(deserializedPayload, defaultMessageNametagBuffer);

      expect(uint8ArrayEquals(message, readMessage)).to.be.true;
    }
  });

  it("Noise XXpsk0 Handhshake and message encryption (short test)", function () {
    const hsPattern = NoiseHandshakePatterns.XXpsk0;

    // We generate a random psk
    const psk = randomBytes(32, rng);

    // We initialize Alice's and Bob's Handshake State
    const aliceStaticKey = generateX25519KeyPair();
    const aliceHS = new Handshake({ hsPattern, staticKey: aliceStaticKey, psk, initiator: true });

    const bobStaticKey = generateX25519KeyPair();
    const bobHS = new Handshake({ hsPattern, staticKey: bobStaticKey, psk });

    let sentTransportMessage: Uint8Array;
    let aliceStep: HandshakeStepResult;
    let bobStep: HandshakeStepResult;

    // Here the handshake starts
    // Write and read calls alternate between Alice and Bob: the handhshake progresses by alternatively calling stepHandshake for each user

    // 1st step
    // ==========

    // We generate a random transport message
    sentTransportMessage = randomBytes(32, rng);

    // By being the handshake initiator, Alice writes a Waku2 payload v2 containing her handshake message
    // and the (encrypted) transport message
    aliceStep = aliceHS.stepHandshake({ transportMessage: sentTransportMessage });
    // Bob reads Alice's payloads, and returns the (decrypted) transport message Alice sent to him
    bobStep = bobHS.stepHandshake({ readPayloadV2: aliceStep.payload2 });

    expect(uint8ArrayEquals(bobStep.transportMessage, sentTransportMessage)).to.be.true;

    // 2nd step
    // ==========

    // We generate a random transport message
    sentTransportMessage = randomBytes(32, rng);

    // At this step, Bob writes and returns a payload
    bobStep = bobHS.stepHandshake({ transportMessage: sentTransportMessage });

    // While Alice reads and returns the (decrypted) transport message
    aliceStep = aliceHS.stepHandshake({ readPayloadV2: bobStep.payload2 });

    expect(uint8ArrayEquals(aliceStep.transportMessage, sentTransportMessage)).to.be.true;

    // 3rd step
    // ==========

    // We generate a random transport message
    sentTransportMessage = randomBytes(32, rng);

    // Similarly as in first step, Alice writes a Waku2 payload containing the handshake message and the (encrypted) transport message
    aliceStep = aliceHS.stepHandshake({ transportMessage: sentTransportMessage });

    // Bob reads Alice's payloads, and returns the (decrypted) transport message Alice sent to him
    bobStep = bobHS.stepHandshake({ readPayloadV2: aliceStep.payload2 });

    expect(uint8ArrayEquals(bobStep.transportMessage, sentTransportMessage)).to.be.true;

    // Note that for this handshake pattern, no more message patterns are left for processing

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
      let payload2 = aliceHSResult.writeMessage(message, defaultMessageNametagBuffer);
      let serializedPayload = payload2.serialize();
      let deserializedPayload = PayloadV2.deserialize(serializedPayload);
      let readMessage = bobHSResult.readMessage(deserializedPayload, defaultMessageNametagBuffer);

      expect(uint8ArrayEquals(message, readMessage)).to.be.true;

      // Bob writes to Alice
      message = randomBytes(32);
      payload2 = bobHSResult.writeMessage(message, defaultMessageNametagBuffer);
      serializedPayload = payload2.serialize();
      deserializedPayload = PayloadV2.deserialize(serializedPayload);
      readMessage = aliceHSResult.readMessage(deserializedPayload, defaultMessageNametagBuffer);

      expect(uint8ArrayEquals(message, readMessage)).to.be.true;
    }
  });

  it("Noise K1K1 Handhshake and message encryption (short test)", function () {
    const hsPattern = NoiseHandshakePatterns.K1K1;

    // We initialize Alice's and Bob's Handshake State
    const aliceStaticKey = generateX25519KeyPair();

    const bobStaticKey = generateX25519KeyPair();

    // This handshake has the following pre-message pattern:
    // -> s
    // <- s
    //   ...
    // So we define accordingly the sequence of the pre-message public keys
    const preMessagePKs = [
      NoisePublicKey.fromPublicKey(aliceStaticKey.publicKey),
      NoisePublicKey.fromPublicKey(bobStaticKey.publicKey),
    ];

    const aliceHS = new Handshake({ hsPattern, staticKey: aliceStaticKey, preMessagePKs, initiator: true });
    const bobHS = new Handshake({ hsPattern, staticKey: bobStaticKey, preMessagePKs });

    let sentTransportMessage: Uint8Array;
    let aliceStep: HandshakeStepResult;
    let bobStep: HandshakeStepResult;

    // Here the handshake starts
    // Write and read calls alternate between Alice and Bob: the handhshake progresses by alternatively calling stepHandshake for each user

    // 1st step
    // ==========

    // We generate a random transport message
    sentTransportMessage = randomBytes(32, rng);
    // By being the handshake initiator, Alice writes a Waku2 payload v2 containing her handshake message
    // and the (encrypted) transport message
    aliceStep = aliceHS.stepHandshake({ transportMessage: sentTransportMessage });
    // Bob reads Alice's payloads, and returns the (decrypted) transport message Alice sent to him
    bobStep = bobHS.stepHandshake({ readPayloadV2: aliceStep.payload2 });

    expect(uint8ArrayEquals(bobStep.transportMessage, sentTransportMessage)).to.be.true;

    // 2nd step
    // ==========

    // We generate a random transport message
    sentTransportMessage = randomBytes(32, rng);

    // At this step, Bob writes and returns a payload
    bobStep = bobHS.stepHandshake({ transportMessage: sentTransportMessage });

    // While Alice reads and returns the (decrypted) transport message
    aliceStep = aliceHS.stepHandshake({ readPayloadV2: bobStep.payload2 });

    expect(uint8ArrayEquals(aliceStep.transportMessage, sentTransportMessage)).to.be.true;

    // 3rd step
    // ==========

    // We generate a random transport message
    sentTransportMessage = randomBytes(32, rng);

    // Similarly as in first step, Alice writes a Waku2 payload containing the handshake message and the (encrypted) transport message
    aliceStep = aliceHS.stepHandshake({ transportMessage: sentTransportMessage });

    // Bob reads Alice's payloads, and returns the (decrypted) transport message Alice sent to him
    bobStep = bobHS.stepHandshake({ readPayloadV2: aliceStep.payload2 });

    expect(uint8ArrayEquals(bobStep.transportMessage, sentTransportMessage)).to.be.true;

    // Note that for this handshake pattern, no more message patterns are left for processing

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
      let payload2 = aliceHSResult.writeMessage(message, defaultMessageNametagBuffer);
      let serializedPayload = payload2.serialize();
      let deserializedPayload = PayloadV2.deserialize(serializedPayload);
      let readMessage = bobHSResult.readMessage(deserializedPayload, defaultMessageNametagBuffer);

      expect(uint8ArrayEquals(message, readMessage)).to.be.true;

      // Bob writes to Alice
      message = randomBytes(32);
      payload2 = bobHSResult.writeMessage(message, defaultMessageNametagBuffer);
      serializedPayload = payload2.serialize();
      deserializedPayload = PayloadV2.deserialize(serializedPayload);
      readMessage = aliceHSResult.readMessage(deserializedPayload, defaultMessageNametagBuffer);

      expect(uint8ArrayEquals(message, readMessage)).to.be.true;
    }
  });

  it("Noise XK1 Handhshake and message encryption (short test)", function () {
    const hsPattern = NoiseHandshakePatterns.XK1;

    // We initialize Alice's and Bob's Handshake State
    const aliceStaticKey = generateX25519KeyPair();
    const bobStaticKey = generateX25519KeyPair();

    // This handshake has the following pre-message pattern:
    // <- s
    //   ...
    // So we define accordingly the sequence of the pre-message public keys
    const preMessagePKs = [NoisePublicKey.fromPublicKey(bobStaticKey.publicKey)];

    const aliceHS = new Handshake({ hsPattern, staticKey: aliceStaticKey, preMessagePKs, initiator: true });
    const bobHS = new Handshake({ hsPattern, staticKey: bobStaticKey, preMessagePKs });

    let sentTransportMessage: Uint8Array;
    let aliceStep: HandshakeStepResult;
    let bobStep: HandshakeStepResult;

    // Here the handshake starts
    // Write and read calls alternate between Alice and Bob: the handhshake progresses by alternatively calling stepHandshake for each user

    // 1st step
    // ==========

    // We generate a random transport message
    sentTransportMessage = randomBytes(32, rng);
    // By being the handshake initiator, Alice writes a Waku2 payload v2 containing her handshake message
    // and the (encrypted) transport message
    aliceStep = aliceHS.stepHandshake({ transportMessage: sentTransportMessage });
    // Bob reads Alice's payloads, and returns the (decrypted) transport message Alice sent to him
    bobStep = bobHS.stepHandshake({ readPayloadV2: aliceStep.payload2 });

    expect(uint8ArrayEquals(bobStep.transportMessage, sentTransportMessage)).to.be.true;

    // 2nd step
    // ==========

    // We generate a random transport message
    sentTransportMessage = randomBytes(32, rng);

    // At this step, Bob writes and returns a payload
    bobStep = bobHS.stepHandshake({ transportMessage: sentTransportMessage });

    // While Alice reads and returns the (decrypted) transport message
    aliceStep = aliceHS.stepHandshake({ readPayloadV2: bobStep.payload2 });

    expect(uint8ArrayEquals(aliceStep.transportMessage, sentTransportMessage)).to.be.true;

    // 3rd step
    // ==========

    // We generate a random transport message
    sentTransportMessage = randomBytes(32, rng);

    // Similarly as in first step, Alice writes a Waku2 payload containing the handshake message and the (encrypted) transport message
    aliceStep = aliceHS.stepHandshake({ transportMessage: sentTransportMessage });

    // Bob reads Alice's payloads, and returns the (decrypted) transport message Alice sent to him
    bobStep = bobHS.stepHandshake({ readPayloadV2: aliceStep.payload2 });

    expect(uint8ArrayEquals(bobStep.transportMessage, sentTransportMessage)).to.be.true;

    // Note that for this handshake pattern, no more message patterns are left for processing

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
      let payload2 = aliceHSResult.writeMessage(message, defaultMessageNametagBuffer);
      let serializedPayload = payload2.serialize();
      let deserializedPayload = PayloadV2.deserialize(serializedPayload);
      let readMessage = bobHSResult.readMessage(deserializedPayload, defaultMessageNametagBuffer);

      expect(uint8ArrayEquals(message, readMessage)).to.be.true;

      // Bob writes to Alice
      message = randomBytes(32);
      payload2 = bobHSResult.writeMessage(message, defaultMessageNametagBuffer);
      serializedPayload = payload2.serialize();
      deserializedPayload = PayloadV2.deserialize(serializedPayload);
      readMessage = aliceHSResult.readMessage(deserializedPayload, defaultMessageNametagBuffer);

      expect(uint8ArrayEquals(message, readMessage)).to.be.true;
    }
  });
});
