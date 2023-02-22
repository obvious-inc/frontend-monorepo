import { HMACDRBG } from "@stablelib/hmac-drbg";
import { randomBytes } from "@stablelib/random";
import type { IDecoder, IEncoder, IMessage } from "@waku/interfaces";
import debug from "debug";
import { EventEmitter } from "eventemitter3";
import { pEvent } from "p-event";
import { equals as uint8ArrayEquals } from "uint8arrays/equals";

import { KeyPair } from "./@types/keypair.js";
import {
  NoiseHandshakeDecoder,
  NoiseHandshakeEncoder,
  NoiseHandshakeMessage,
  NoiseSecureTransferDecoder,
  NoiseSecureTransferEncoder,
} from "./codec.js";
import { commitPublicKey, generateX25519KeyPair } from "./crypto.js";
import { Handshake, HandshakeResult, HandshakeStepResult, MessageNametagError } from "./handshake.js";
import { MessageNametagLength } from "./messagenametag.js";
import { NoiseHandshakePatterns } from "./patterns.js";
import { NoisePublicKey } from "./publickey.js";
import { QR } from "./qr.js";

const log = debug("waku:noise:pairing");

/**
 * Sender interface that an object must implement so the pairing object can publish noise messages
 */
export interface Sender {
  /**
   * Publish a message
   * @param encoder NoiseHandshakeEncoder encoder to use to encrypt the messages
   * @param msg message to broadcast
   */
  publish(encoder: IEncoder, msg: IMessage): Promise<void>;
}

/**
 * Responder interface than an object must implement so the pairing object can receive noise messages
 */
export interface Responder {
  /**
   * subscribe to receive the messages from a content topic
   * @param decoder Decoder to use to decrypt the NoiseHandshakeMessages
   */
  subscribe(decoder: IDecoder<NoiseHandshakeMessage>): Promise<void>;

  /**
   * should return messages received in a content topic
   * messages should be kept in a queue, meaning that nextMessage
   * will call pop in the queue to remove the oldest message received
   * (it's important to maintain order of received messages)
   * @param contentTopic content topic to get the next message from
   */
  nextMessage(contentTopic: string): Promise<NoiseHandshakeMessage>;

  /**
   * Stop the subscription to the content topic
   * @param contentTopic
   */
  stop(contentTopic: string): Promise<void>;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const rng = new HMACDRBG();

/**
 * Initiator parameters used to setup the pairing object
 */
export class InitiatorParameters {
  constructor(public readonly qrCode: string, public readonly qrMessageNameTag: Uint8Array) {}
}

/**
 * Responder parameters used to setup the pairing object
 */
export class ResponderParameters {
  constructor(
    public readonly applicationName: string = "waku-noise-sessions",
    public readonly applicationVersion: string = "0.1",
    public readonly shardId: string = "10"
  ) {}
}

/**
 * Pairing object to setup a noise session
 */
export class WakuPairing {
  public readonly contentTopic: string;

  private initiator: boolean;
  private randomFixLenVal: Uint8Array; // r or s depending on who is sending the message
  private handshake: Handshake;
  private myCommittedStaticKey: Uint8Array;
  private qr: QR;
  private qrMessageNameTag: Uint8Array;
  private authCode?: string;
  private started = false;
  private handshakeResult: HandshakeResult | undefined;

  private eventEmitter = new EventEmitter();

  /**
   * Convert a QR into a content topic
   * @param qr
   * @returns content topic string
   */
  private static toContentTopic(qr: QR): string {
    return (
      "/" + qr.applicationName + "/" + qr.applicationVersion + "/wakunoise/1/sessions_shard-" + qr.shardId + "/proto"
    );
  }

  /**
   * @param sender object that implements Sender interface to publish waku messages
   * @param responder object that implements Responder interface to subscribe and receive waku messages
   * @param myStaticKey x25519 keypair
   * @param pairingParameters Pairing parameters (depending if this is the initiator or responder)
   * @param myEphemeralKey optional ephemeral key
   */
  constructor(
    private sender: Sender,
    private responder: Responder,
    private myStaticKey: KeyPair,
    pairingParameters: InitiatorParameters | ResponderParameters,
    private myEphemeralKey: KeyPair = generateX25519KeyPair()
  ) {
    this.randomFixLenVal = randomBytes(32, rng);
    this.myCommittedStaticKey = commitPublicKey(this.myStaticKey.publicKey, this.randomFixLenVal);

    if (pairingParameters instanceof InitiatorParameters) {
      this.initiator = true;
      this.qr = QR.from(pairingParameters.qrCode);
      this.qrMessageNameTag = pairingParameters.qrMessageNameTag;
    } else {
      this.initiator = false;
      this.qrMessageNameTag = randomBytes(MessageNametagLength, rng);
      this.qr = new QR(
        pairingParameters.applicationName,
        pairingParameters.applicationVersion,
        pairingParameters.shardId,
        this.myEphemeralKey.publicKey,
        this.myCommittedStaticKey
      );
    }

    // We set the contentTopic from the content topic parameters exchanged in the QR
    this.contentTopic = WakuPairing.toContentTopic(this.qr);

    // Pre-handshake message
    // <- eB {H(sB||r), contentTopicParams, messageNametag}
    const preMessagePKs = [NoisePublicKey.fromPublicKey(this.qr.ephemeralKey)];

    this.handshake = new Handshake({
      hsPattern: NoiseHandshakePatterns.WakuPairing,
      ephemeralKey: myEphemeralKey,
      staticKey: myStaticKey,
      prologue: this.qr.toByteArray(),
      preMessagePKs,
      initiator: this.initiator,
    });
  }

  /**
   * Get pairing information (as an InitiatorParameter object)
   * @returns InitiatorParameters
   */
  public getPairingInfo(): InitiatorParameters {
    return new InitiatorParameters(this.qr.toString(), this.qrMessageNameTag);
  }

  /**
   * Get auth code (to validate that pairing). It must be displayed on both
   * devices and the user(s) must confirm if the auth code match
   * @returns Promise that resolves to an auth code
   */
  public async getAuthCode(): Promise<string> {
    return new Promise((resolve) => {
      if (this.authCode) {
        resolve(this.authCode);
      } else {
        this.eventEmitter.on("authCodeGenerated", (authCode: string) => {
          this.authCode = authCode;
          resolve(authCode);
        });
      }
    });
  }

  /**
   * Indicate if auth code is valid. This is a function that must be
   * manually called by the user(s) if the auth code in both devices being
   * paired match. If false, pairing session is terminated
   * @param isValid true if authcode is correct, false otherwise.
   */
  public validateAuthCode(isValid: boolean): void {
    this.eventEmitter.emit("confirmAuthCode", isValid);
  }

  private async isAuthCodeConfirmed(): Promise<boolean | undefined> {
    // wait for user to confirm or not, or for the whole pairing process to time out
    const p1 = pEvent(this.eventEmitter, "confirmAuthCode");
    const p2 = pEvent(this.eventEmitter, "pairingTimeout");
    return Promise.race<boolean | undefined>([p1, p2]);
  }

  private async executeReadStepWithNextMessage(
    contentTopic: string,
    messageNametag: Uint8Array
  ): Promise<HandshakeStepResult> {
    // TODO: create test unit for this function
    let stopLoop = false;

    this.eventEmitter.once("pairingTimeout", () => {
      stopLoop = true;
    });

    this.eventEmitter.once("pairingComplete", () => {
      stopLoop = true;
    });

    while (!stopLoop) {
      try {
        const hsMessage = await this.responder.nextMessage(contentTopic);
        const step = this.handshake.stepHandshake({
          readPayloadV2: hsMessage.payloadV2,
          messageNametag,
        });
        return step;
      } catch (err) {
        if (err instanceof MessageNametagError) {
          log("Unexpected message nametag", err.expectedNametag, err.actualNametag);
        } else {
          throw err;
        }
      }
    }

    throw new Error("could not obtain next message");
  }

  private async initiatorHandshake(): Promise<[NoiseSecureTransferEncoder, NoiseSecureTransferDecoder]> {
    // Subscribe to the contact content topic
    const decoder = new NoiseHandshakeDecoder(this.contentTopic);
    await this.responder.subscribe(decoder);

    // The handshake initiator writes a Waku2 payload v2 containing the handshake message
    // and the (encrypted) transport message
    // The message is sent with a messageNametag equal to the one received through the QR code
    let hsStep = this.handshake.stepHandshake({
      transportMessage: this.myCommittedStaticKey,
      messageNametag: this.qrMessageNameTag,
    });

    // We prepare a message from initiator's payload2
    // At this point wakuMsg is sent over the Waku network to responder content topic
    let encoder = new NoiseHandshakeEncoder(this.contentTopic, hsStep);
    await this.sender.publish(encoder, {});

    // We generate an authorization code using the handshake state
    // this check has to be confirmed with a user interaction, comparing auth codes in both ends
    const confirmationPromise = this.isAuthCodeConfirmed();
    await delay(100);
    this.eventEmitter.emit("authCodeGenerated", this.handshake.genAuthcode());
    console.log("Waiting for authcode confirmation...");
    const confirmed = await confirmationPromise;
    if (!confirmed) {
      throw new Error("authcode is not confirmed");
    }

    // 2nd step
    // <- sB, eAsB    {r}
    hsStep = await this.executeReadStepWithNextMessage(this.contentTopic, this.handshake.hs.toMessageNametag());

    await this.responder.stop(this.contentTopic);

    if (!this.handshake.hs.rs) throw new Error("invalid handshake state");

    // Initiator further checks if responder's commitment opens to responder's static key received
    const expectedResponderCommittedStaticKey = commitPublicKey(this.handshake.hs.rs, hsStep.transportMessage);
    if (!uint8ArrayEquals(expectedResponderCommittedStaticKey, this.qr.committedStaticKey)) {
      throw new Error("expected committed static key does not match the responder actual committed static key");
    }

    // 3rd step
    // -> sA, sAeB, sAsB  {s}
    // Similarly as in first step, the initiator writes a Waku2 payload containing the handshake message and the (encrypted) transport message
    hsStep = this.handshake.stepHandshake({
      transportMessage: this.randomFixLenVal,
      messageNametag: this.handshake.hs.toMessageNametag(),
    });

    encoder = new NoiseHandshakeEncoder(this.contentTopic, hsStep);
    await this.sender.publish(encoder, {});

    // Secure Transfer Phase
    this.handshakeResult = this.handshake.finalizeHandshake();

    this.eventEmitter.emit("pairingComplete");

    return WakuPairing.getSecureCodec(this.contentTopic, this.handshakeResult);
  }

  private async responderHandshake(): Promise<[NoiseSecureTransferEncoder, NoiseSecureTransferDecoder]> {
    // Subscribe to the contact content topic
    const decoder = new NoiseHandshakeDecoder(this.contentTopic);
    await this.responder.subscribe(decoder);

    // the received reads the initiator's payloads, and returns the (decrypted) transport message the initiator sent
    // Note that the received verifies if the received payloadV2 has the expected messageNametag set
    let hsStep = await this.executeReadStepWithNextMessage(this.contentTopic, this.qrMessageNameTag);

    const initiatorCommittedStaticKey = new Uint8Array(hsStep.transportMessage);

    const confirmationPromise = this.isAuthCodeConfirmed();
    await delay(100);
    this.eventEmitter.emit("authCodeGenerated", this.handshake.genAuthcode());
    console.log("Waiting for authcode confirmation...");
    const confirmed = await confirmationPromise;
    if (!confirmed) {
      throw new Error("authcode is not confirmed");
    }
    // 2nd step
    // <- sB, eAsB    {r}
    // Responder writes and returns a payload
    hsStep = this.handshake.stepHandshake({
      transportMessage: this.randomFixLenVal,
      messageNametag: this.handshake.hs.toMessageNametag(),
    });

    // We prepare a Waku message from responder's payload2
    const encoder = new NoiseHandshakeEncoder(this.contentTopic, hsStep);
    await this.sender.publish(encoder, {});

    // 3rd step
    // -> sA, sAeB, sAsB  {s}

    // The responder reads the initiator's payload sent by the initiator
    hsStep = await this.executeReadStepWithNextMessage(this.contentTopic, this.handshake.hs.toMessageNametag());

    await this.responder.stop(this.contentTopic);

    if (!this.handshake.hs.rs) throw new Error("invalid handshake state");

    // The responder further checks if the initiator's commitment opens to the initiator's static key received
    const expectedInitiatorCommittedStaticKey = commitPublicKey(this.handshake.hs.rs, hsStep.transportMessage);
    if (!uint8ArrayEquals(expectedInitiatorCommittedStaticKey, initiatorCommittedStaticKey)) {
      throw new Error("expected committed static key does not match the initiator actual committed static key");
    }

    // Secure Transfer Phase
    this.handshakeResult = this.handshake.finalizeHandshake();

    this.eventEmitter.emit("pairingComplete");

    return WakuPairing.getSecureCodec(this.contentTopic, this.handshakeResult);
  }

  /**
   * Get codecs for encoding/decoding messages in js-waku. This function can be used
   * to continue a session using a stored hsResult
   * @param contentTopic Content topic for the waku messages
   * @param hsResult Noise Pairing result
   * @returns an array with [NoiseSecureTransferEncoder, NoiseSecureTransferDecoder]
   */
  static getSecureCodec(
    contentTopic: string,
    hsResult: HandshakeResult
  ): [NoiseSecureTransferEncoder, NoiseSecureTransferDecoder] {
    const secureEncoder = new NoiseSecureTransferEncoder(contentTopic, hsResult);
    const secureDecoder = new NoiseSecureTransferDecoder(contentTopic, hsResult);

    return [secureEncoder, secureDecoder];
  }

  /**
   * Get handshake result
   * @returns result of a successful pairing
   */
  public getHandshakeResult(): HandshakeResult {
    if (!this.handshakeResult) {
      throw new Error("handshake is not complete");
    }
    return this.handshakeResult;
  }

  /**
   * Execute handshake
   * @param timeoutMs Timeout in milliseconds after which the pairing session is invalid
   * @returns promise that resolves to codecs for encoding/decoding messages in js-waku
   */
  async execute(timeoutMs = 60000): Promise<[NoiseSecureTransferEncoder, NoiseSecureTransferDecoder]> {
    if (this.started) {
      throw new Error("pairing already executed. Create new pairing object");
    }

    this.started = true;
    return new Promise((resolve, reject) => {
      //  Limit QR exposure to some timeout
      const timer = setTimeout(() => {
        reject(new Error("pairing has timed out"));
        this.eventEmitter.emit("pairingTimeout");
      }, timeoutMs);

      const handshakeFn = this.initiator ? this.initiatorHandshake : this.responderHandshake;
      handshakeFn
        .bind(this)()
        .then(
          (response) => resolve(response),
          (err) => reject(err)
        )
        .finally(() => clearTimeout(timer));
    });
  }
}
