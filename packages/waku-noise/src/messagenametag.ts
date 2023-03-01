import { concat as uint8ArrayConcat } from "uint8arrays/concat";
import { equals as uint8ArrayEquals } from "uint8arrays/equals";

import { MessageNametag } from "./@types/handshake.js";
import { hashSHA256 } from "./crypto.js";
import { writeUIntLE } from "./utils.js";

export const MessageNametagLength = 16;

export const MessageNametagBufferSize = 50;

/**
 * Converts a sequence or array (arbitrary size) to a MessageNametag
 * @param input
 * @returns
 */
export function toMessageNametag(input: Uint8Array): MessageNametag {
  return input.subarray(0, MessageNametagLength);
}

export class MessageNametagBuffer {
  private buffer: Array<MessageNametag> = new Array<MessageNametag>(MessageNametagBufferSize);
  private counter = 0;
  secret?: Uint8Array;

  constructor() {
    for (let i = 0; i < this.buffer.length; i++) {
      this.buffer[i] = new Uint8Array(MessageNametagLength);
    }
  }

  /**
   * Initializes the empty Message nametag buffer. The n-th nametag is equal to HKDF( secret || n )
   */
  initNametagsBuffer(counter = 0): void {
    // We default the counter and buffer fields
    this.counter = counter;
    this.buffer = new Array<MessageNametag>(MessageNametagBufferSize);

    if (this.secret) {
      for (let i = 0; i < this.buffer.length; i++) {
        const counterBytesLE = writeUIntLE(new Uint8Array(8), this.counter, 0, 8);
        const d = hashSHA256(uint8ArrayConcat([this.secret, counterBytesLE]));
        this.buffer[i] = toMessageNametag(d);
        this.counter++;
      }
    } else {
      // We warn users if no secret is set
      console.debug("The message nametags buffer has not a secret set");
    }
  }

  /**
   * Pop the nametag from the message nametag buffer
   * @returns MessageNametag
   */
  pop(): MessageNametag {
    // Note that if the input MessageNametagBuffer is set to default, an all 0 messageNametag is returned
    const messageNametag = new Uint8Array(this.buffer[0]);
    this.delete(1);
    return messageNametag;
  }

  /**
   * Checks if the input messageNametag is contained in the input MessageNametagBuffer
   * @param messageNametag Message nametag to verify
   * @returns true if it's the expected nametag, false otherwise
   */
  checkNametag(messageNametag: MessageNametag): boolean {
    const index = this.buffer.findIndex((x) => uint8ArrayEquals(x, messageNametag));

    if (index == -1) {
      console.debug("Message nametag not found in buffer");
      return false;
    } else if (index > 0) {
      console.debug(
        "Message nametag is present in buffer but is not the next expected nametag. One or more messages were probably lost"
      );
      return false;
    }

    // index is 0, hence the read message tag is the next expected one
    return true;
  }

  private rotateLeft(k: number): void {
    if (k < 0 || this.buffer.length == 0) {
      return;
    }
    const idx = this.buffer.length - (k % this.buffer.length);
    const a1 = this.buffer.slice(idx);
    const a2 = this.buffer.slice(0, idx);
    this.buffer = a1.concat(a2);
  }

  /**
   * Deletes the first n elements in buffer and appends n new ones
   * @param n number of message nametags to delete
   */
  delete(n: number): void {
    if (n <= 0) {
      return;
    }

    // We ensure n is at most MessageNametagBufferSize (the buffer will be fully replaced)
    n = Math.min(n, MessageNametagBufferSize);

    // We update the last n values in the array if a secret is set
    // Note that if the input MessageNametagBuffer is set to default, nothing is done here
    if (this.secret) {
      // We rotate left the array by n
      this.rotateLeft(n);

      for (let i = 0; i < n; i++) {
        const counterBytesLE = writeUIntLE(new Uint8Array(8), this.counter, 0, 8);
        const d = hashSHA256(uint8ArrayConcat([this.secret, counterBytesLE]));

        this.buffer[this.buffer.length - n + i] = toMessageNametag(d);
        this.counter++;
      }
    } else {
      // We warn users that no secret is set
      console.debug("The message nametags buffer has no secret set");
    }
  }

  getCounter() {
    return this.counter;
  }
}
