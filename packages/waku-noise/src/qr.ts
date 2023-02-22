import { decode, encode, fromUint8Array, toUint8Array } from "js-base64";

import { bytes32 } from "./@types/basic.js";

/**
 * QR code generation
 */
export class QR {
  constructor(
    public readonly applicationName: string,
    public readonly applicationVersion: string,
    public readonly shardId: string,
    public readonly ephemeralKey: bytes32,
    public readonly committedStaticKey: bytes32
  ) {}

  // Serializes input parameters to a base64 string for exposure through QR code (used by WakuPairing)
  toString(): string {
    let qr = encode(this.applicationName) + ":";
    qr += encode(this.applicationVersion) + ":";
    qr += encode(this.shardId) + ":";
    qr += fromUint8Array(this.ephemeralKey) + ":";
    qr += fromUint8Array(this.committedStaticKey);

    return qr;
  }

  /**
   * Convert QR code into byte array
   * @returns byte array serialization of a base64 encoded QR code
   */
  toByteArray(): Uint8Array {
    const enc = new TextEncoder();
    return enc.encode(this.toString());
  }

  /**
   * Deserializes input string in base64 to the corresponding (applicationName, applicationVersion, shardId, ephemeralKey, committedStaticKey)
   * @param input input base64 encoded string
   * @returns QR
   */
  static from(input: string | Uint8Array): QR {
    let qrStr: string;
    if (input instanceof Uint8Array) {
      const dec = new TextDecoder();
      qrStr = dec.decode(input);
    } else {
      qrStr = input;
    }

    const values = qrStr.split(":");

    if (values.length != 5) throw new Error("invalid qr string");

    const applicationName = decode(values[0]);
    const applicationVersion = decode(values[1]);
    const shardId = decode(values[2]);
    const ephemeralKey = toUint8Array(values[3]);
    const committedStaticKey = toUint8Array(values[4]);

    return new QR(applicationName, applicationVersion, shardId, ephemeralKey, committedStaticKey);
  }
}
