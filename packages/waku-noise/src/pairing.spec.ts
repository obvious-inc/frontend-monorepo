import { HMACDRBG } from "@stablelib/hmac-drbg";
import { randomBytes } from "@stablelib/random";
import type { IDecoder, IEncoder, IMessage } from "@waku/interfaces";
import { expect } from "chai";
import { EventEmitter } from "eventemitter3";
import { pEvent } from "p-event";
import { equals as uint8ArrayEquals } from "uint8arrays/equals";

import { NoiseHandshakeMessage } from "./codec";
import { generateX25519KeyPair } from "./crypto";
import { MessageNametagBufferSize } from "./messagenametag";
import { ResponderParameters, WakuPairing } from "./pairing";

describe("js-noise: pairing object", () => {
  const rng = new HMACDRBG();

  const confirmAuthCodeFlow = async function (pairingObj: WakuPairing, shouldConfirm: boolean): Promise<void> {
    const authCode = await pairingObj.getAuthCode();
    console.log("Authcode: ", authCode); // TODO: compare that authCode is the same in both confirmation flows
    pairingObj.validateAuthCode(shouldConfirm);
  };

  // =================
  // Simulate waku. This code is not meant to be used IRL
  const msgEmitter = new EventEmitter();
  const sender = {
    async publish(encoder: IEncoder, msg: IMessage): Promise<void> {
      const protoMsg = await encoder.toProtoObj(msg);
      msgEmitter.emit(encoder.contentTopic, protoMsg);
    },
  };
  const decoderMap: { [key: string]: IDecoder<NoiseHandshakeMessage> } = {};
  const responder = {
    subscribe(decoder: IDecoder<NoiseHandshakeMessage>): Promise<void> {
      return new Promise((resolve) => {
        decoderMap[decoder.contentTopic] = decoder;
        resolve();
      });
    },
    async nextMessage(contentTopic: string): Promise<NoiseHandshakeMessage> {
      const msg = await pEvent(msgEmitter, contentTopic);
      const decodedMessage = await decoderMap[contentTopic].fromProtoObj(msg);
      return decodedMessage!;
    },
    async stop(contentTopic: string): Promise<void> {
      // Do nothing. This is just a simulation
      console.debug("stopping subscription to", contentTopic);
    },
  };
  // =================

  it("should pair", async function () {
    const bobStaticKey = generateX25519KeyPair();
    const aliceStaticKey = generateX25519KeyPair();

    const recvParameters = new ResponderParameters();
    const bobPairingObj = new WakuPairing(sender, responder, bobStaticKey, recvParameters);
    const bobExecP1 = bobPairingObj.execute();

    // Confirmation is done by manually
    confirmAuthCodeFlow(bobPairingObj, true);

    const initParameters = bobPairingObj.getPairingInfo();
    const alicePairingObj = new WakuPairing(sender, responder, aliceStaticKey, initParameters);
    const aliceExecP1 = alicePairingObj.execute();

    // Confirmation is done manually
    confirmAuthCodeFlow(alicePairingObj, true);

    const [bobCodecs, aliceCodecs] = await Promise.all([bobExecP1, aliceExecP1]);

    const bobEncoder = bobCodecs[0];
    const bobDecoder = bobCodecs[1];
    const aliceEncoder = aliceCodecs[0];
    const aliceDecoder = aliceCodecs[1];

    // We test read/write of random messages exchanged between Alice and Bob
    // Note that we exchange more than the number of messages contained in the nametag buffer to test if they are filled correctly as the communication proceeds
    for (let i = 0; i < 10 * MessageNametagBufferSize; i++) {
      // Alice writes to Bob
      let message = randomBytes(32, rng);
      let encodedMsg = await aliceEncoder.toWire({ payload: message });
      let readMessageProto = await bobDecoder.fromWireToProtoObj(encodedMsg!);
      let readMessage = await bobDecoder.fromProtoObj(readMessageProto!);

      expect(uint8ArrayEquals(message, readMessage!.payload)).to.be.true;

      // Bob writes to Alice
      message = randomBytes(32, rng);
      encodedMsg = await bobEncoder.toWire({ payload: message });
      readMessageProto = await aliceDecoder.fromWireToProtoObj(encodedMsg!);
      readMessage = await aliceDecoder.fromProtoObj(readMessageProto!);

      expect(uint8ArrayEquals(message, readMessage!.payload)).to.be.true;
    }
  });

  it("should timeout", async function () {
    const bobPairingObj = new WakuPairing(sender, responder, generateX25519KeyPair(), new ResponderParameters());
    const alicePairingObj = new WakuPairing(sender, responder, generateX25519KeyPair(), bobPairingObj.getPairingInfo());

    const bobExecP1 = bobPairingObj.execute(1000);
    const aliceExecP1 = alicePairingObj.execute(1000);

    try {
      await Promise.all([bobExecP1, aliceExecP1]);
      expect(false, "should not reach here").to.be.true;
    } catch (err) {
      let message;
      if (err instanceof Error) message = err.message;
      else message = String(err);
      expect(message).to.be.equals("pairing has timed out");
    }
  });
});
