import { BN } from "bn.js";
import * as pkcs7 from "pkcs7-padding";
import { equals as uint8ArrayEquals } from "uint8arrays/equals";

import { bytes32 } from "./@types/basic";
import { KeyPair } from "./@types/keypair";
import { HKDF } from "./crypto.js";
import { HandshakeState, NoisePaddingBlockSize } from "./handshake_state.js";
import { MessageNametagBuffer, toMessageNametag } from "./messagenametag.js";
import { CipherState } from "./noise.js";
import { HandshakePattern, PayloadV2ProtocolIDs } from "./patterns.js";
import { PayloadV2 } from "./payload.js";
import { NoisePublicKey } from "./publickey.js";

// Noise state machine

// While processing messages patterns, users either:
// - read (decrypt) the other party's (encrypted) transport message
// - write (encrypt) a message, sent through a PayloadV2
// These two intermediate results are stored in the HandshakeStepResult data structure
export class HandshakeStepResult {
  payload2: PayloadV2 = new PayloadV2();
  transportMessage: Uint8Array = new Uint8Array();

  equals(b: HandshakeStepResult): boolean {
    return this.payload2.equals(b.payload2) && uint8ArrayEquals(this.transportMessage, b.transportMessage);
  }

  clone(): HandshakeStepResult {
    const r = new HandshakeStepResult();
    r.transportMessage = new Uint8Array(this.transportMessage);
    r.payload2 = this.payload2.clone();
    return r;
  }
}

// When a handshake is complete, the HandshakeResult will contain the two
// Cipher States used to encrypt/decrypt outbound/inbound messages
// The recipient static key rs and handshake hash values h are stored to address some possible future applications (channel-binding, session management, etc.).
// However, are not required by Noise specifications and are thus optional
export class HandshakeResult {
  // Optional fields:
  nametagsInbound: MessageNametagBuffer = new MessageNametagBuffer();
  nametagsOutbound: MessageNametagBuffer = new MessageNametagBuffer();
  rs: bytes32 = new Uint8Array();
  h: bytes32 = new Uint8Array();

  constructor(private csOutbound: CipherState, private csInbound: CipherState) { }

  // Noise specification, Section 5:
  // Transport messages are then encrypted and decrypted by calling EncryptWithAd()
  // and DecryptWithAd() on the relevant CipherState with zero-length associated data.
  // If DecryptWithAd() signals an error due to DECRYPT() failure, then the input message is discarded.
  // The application may choose to delete the CipherState and terminate the session on such an error,
  // or may continue to attempt communications. If EncryptWithAd() or DecryptWithAd() signal an error
  // due to nonce exhaustion, then the application must delete the CipherState and terminate the session.

  // Writes an encrypted message using the proper Cipher State
  writeMessage(
    transportMessage: Uint8Array,
    outboundMessageNametagBuffer: MessageNametagBuffer | undefined = undefined
  ): PayloadV2 {
    const payload2 = new PayloadV2();

    // We set the message nametag using the input buffer
    payload2.messageNametag = (outboundMessageNametagBuffer ?? this.nametagsOutbound).pop();

    // According to 35/WAKU2-NOISE RFC, no Handshake protocol information is sent when exchanging messages
    // This correspond to setting protocol-id to 0
    payload2.protocolId = 0;
    // We pad the transport message
    const paddedTransportMessage = pkcs7.pad(transportMessage, NoisePaddingBlockSize);
    // Encryption is done with zero-length associated data as per specification
    payload2.transportMessage = this.csOutbound.encryptWithAd(payload2.messageNametag, paddedTransportMessage);

    return payload2;
  }

  // Reads an encrypted message using the proper Cipher State
  // Decryption is attempted only if the input PayloadV2 has a messageNametag equal to the one expected
  readMessage(
    readPayload2: PayloadV2,
    inboundMessageNametagBuffer: MessageNametagBuffer | undefined = undefined
  ): Uint8Array {
    // The output decrypted message
    let message = new Uint8Array();

    // If the message nametag does not correspond to the nametag expected in the inbound message nametag buffer
    // an error is raised (to be handled externally, i.e. re-request lost messages, discard, etc.)
    const nametagIsOk = (inboundMessageNametagBuffer ?? this.nametagsInbound).checkNametag(readPayload2.messageNametag);
    if (!nametagIsOk) {
      throw new Error("nametag is not ok");
    }

    // At this point the messageNametag matches the expected nametag.
    // According to 35/WAKU2-NOISE RFC, no Handshake protocol information is sent when exchanging messages
    if (readPayload2.protocolId == 0) {
      // On application level we decide to discard messages which fail decryption, without raising an error
      try {
        // Decryption is done with messageNametag as associated data
        const paddedMessage = this.csInbound.decryptWithAd(readPayload2.messageNametag, readPayload2.transportMessage);
        // We unpad the decrypted message
        message = pkcs7.unpad(paddedMessage);
        // The message successfully decrypted, we can delete the first element of the inbound Message Nametag Buffer
        this.nametagsInbound.delete(1);
      } catch (err) {
        console.debug("A read message failed decryption. Returning empty message as plaintext.");
        message = new Uint8Array();
      }
    }

    return message;
  }
}

export interface HandshakeParameters {
  hsPattern: HandshakePattern;
  ephemeralKey?: KeyPair;
  staticKey?: KeyPair;
  prologue?: Uint8Array;
  psk?: Uint8Array;
  preMessagePKs?: Array<NoisePublicKey>;
  initiator?: boolean;
}

export interface StepHandshakeParameters {
  readPayloadV2?: PayloadV2;
  transportMessage?: Uint8Array;
  messageNametag?: Uint8Array;
}

export class MessageNametagError extends Error {
  constructor(public readonly expectedNametag: Uint8Array, public readonly actualNametag: Uint8Array) {
    super("the message nametag of the read message doesn't match the expected one");
    this.name = "MessageNametagError";
  }
}

export class Handshake {
  hs: HandshakeState;
  constructor({
    hsPattern,
    ephemeralKey,
    staticKey,
    prologue = new Uint8Array(),
    psk = new Uint8Array(),
    preMessagePKs = [],
    initiator = false,
  }: HandshakeParameters) {
    this.hs = new HandshakeState(hsPattern, psk);
    this.hs.ss.mixHash(prologue);
    this.hs.e = ephemeralKey;
    this.hs.s = staticKey;
    this.hs.psk = psk;
    this.hs.msgPatternIdx = 0;
    this.hs.initiator = initiator;

    // We process any eventual handshake pre-message pattern by processing pre-message public keys
    this.hs.processPreMessagePatternTokens(preMessagePKs);
  }

  equals(b: Handshake): boolean {
    return this.hs.equals(b.hs);
  }

  clone(): Handshake {
    const result = new Handshake({
      hsPattern: this.hs.handshakePattern,
    });
    result.hs = this.hs.clone();
    return result;
  }

  // Generates an 8 decimal digits authorization code using HKDF and the handshake state
  genAuthcode(): string {
    const [output0] = HKDF(this.hs.ss.h, new Uint8Array(), 8, 1);
    const bn = new BN(output0);
    const code = bn.mod(new BN(100_000_000)).toString().padStart(8, "0");
    return code.toString();
  }

  // Advances 1 step in handshake
  //  Each user in a handshake alternates writing and reading of handshake messages.
  // If the user is writing the handshake message, the transport message (if not empty) and eventually a non-empty message nametag has to be passed to transportMessage and messageNametag and readPayloadV2 can be left to its default value
  // It the user is reading the handshake message, the read payload v2 has to be passed to readPayloadV2 and the transportMessage can be left to its default values. Decryption is skipped if the PayloadV2 read doesn't have a message nametag equal to messageNametag (empty input nametags are converted to all-0 MessageNametagLength bytes arrays)
  stepHandshake({
    readPayloadV2 = new PayloadV2(),
    transportMessage = new Uint8Array(),
    messageNametag = new Uint8Array(),
  }: StepHandshakeParameters): HandshakeStepResult {
    const hsStepResult = new HandshakeStepResult();

    // If there are no more message patterns left for processing
    // we return an empty HandshakeStepResult
    if (this.hs.msgPatternIdx > this.hs.handshakePattern.messagePatterns.length - 1) {
      console.debug("stepHandshake called more times than the number of message patterns present in handshake");
      return hsStepResult;
    }

    // We process the next handshake message pattern

    // We get if the user is reading or writing the input handshake message
    const direction = this.hs.handshakePattern.messagePatterns[this.hs.msgPatternIdx].direction;
    const { reading, writing } = this.hs.getReadingWritingState(direction);

    // If we write an answer at this handshake step
    if (writing) {
      // We initialize a payload v2 and we set proper protocol ID (if supported)
      const protocolId = PayloadV2ProtocolIDs[this.hs.handshakePattern.name];
      if (protocolId === undefined) {
        throw new Error("handshake pattern not supported");
      }

      hsStepResult.payload2.protocolId = protocolId;

      // We set the messageNametag and the handshake and transport messages
      hsStepResult.payload2.messageNametag = toMessageNametag(messageNametag);
      hsStepResult.payload2.handshakeMessage = this.hs.processMessagePatternTokens();

      // We write the payload by passing the messageNametag as extra additional data
      hsStepResult.payload2.transportMessage = this.hs.processMessagePatternPayload(
        transportMessage,
        hsStepResult.payload2.messageNametag
      );

      // If we read an answer during this handshake step
    } else if (reading) {
      // If the read message nametag doesn't match the expected input one we raise an error
      const expectedNametag = toMessageNametag(messageNametag);
      if (!uint8ArrayEquals(readPayloadV2.messageNametag, expectedNametag)) {
        throw new MessageNametagError(expectedNametag, readPayloadV2.messageNametag);
      }

      // We process the read public keys and (eventually decrypt) the read transport message
      const readHandshakeMessage = readPayloadV2.handshakeMessage;
      const readTransportMessage = readPayloadV2.transportMessage;

      // Since we only read, nothing meaningful (i.e. public keys) is returned
      this.hs.processMessagePatternTokens(readHandshakeMessage);
      // We retrieve and store the (decrypted) received transport message by passing the messageNametag as extra additional data
      hsStepResult.transportMessage = this.hs.processMessagePatternPayload(
        readTransportMessage,
        readPayloadV2.messageNametag
      );
    } else {
      throw new Error("handshake Error: neither writing or reading user");
    }

    // We increase the handshake state message pattern index to progress to next step
    this.hs.msgPatternIdx += 1;

    return hsStepResult;
  }

  // Finalizes the handshake by calling Split and assigning the proper Cipher States to users
  finalizeHandshake(): HandshakeResult {
    let hsResult: HandshakeResult;

    // Noise specification, Section 5:
    // Processing the final handshake message returns two CipherState objects,
    // the first for encrypting transport messages from initiator to responder,
    // and the second for messages in the other direction.

    // We call Split()
    const { cs1, cs2 } = this.hs.ss.split();

    // Optional: We derive a secret for the nametag derivation
    const { nms1, nms2 } = this.hs.genMessageNametagSecrets();

    // We assign the proper Cipher States
    if (this.hs.initiator) {
      hsResult = new HandshakeResult(cs1, cs2);
      // and nametags secrets
      hsResult.nametagsInbound.secret = nms1;
      hsResult.nametagsOutbound.secret = nms2;
    } else {
      hsResult = new HandshakeResult(cs2, cs1);
      // and nametags secrets
      hsResult.nametagsInbound.secret = nms2;
      hsResult.nametagsOutbound.secret = nms1;
    }

    // We initialize the message nametags inbound/outbound buffers
    hsResult.nametagsInbound.initNametagsBuffer();
    hsResult.nametagsOutbound.initNametagsBuffer();

    if (!this.hs.rs) throw new Error("invalid handshake state");

    // We store the optional fields rs and h
    hsResult.rs = new Uint8Array(this.hs.rs);
    hsResult.h = new Uint8Array(this.hs.ss.h);

    return hsResult;
  }
}
