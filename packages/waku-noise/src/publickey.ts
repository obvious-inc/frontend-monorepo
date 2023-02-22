import { concat as uint8ArrayConcat } from "uint8arrays/concat";
import { equals as uint8ArrayEquals } from "uint8arrays/equals";

import { bytes32 } from "./@types/basic.js";
import { chaCha20Poly1305Decrypt, chaCha20Poly1305Encrypt } from "./crypto.js";
import { isEmptyKey } from "./noise.js";

/**
 * A ChaChaPoly Cipher State containing key (k), nonce (nonce) and associated data (ad)
 */
export class ChaChaPolyCipherState {
  k: bytes32;
  nonce: bytes32;
  ad: Uint8Array;

  /**
   * @param k 32-byte key
   * @param nonce 12 byte little-endian nonce
   * @param ad associated data
   */
  constructor(k: bytes32 = new Uint8Array(), nonce: bytes32 = new Uint8Array(), ad: Uint8Array = new Uint8Array()) {
    this.k = k;
    this.nonce = nonce;
    this.ad = ad;
  }

  /**
   * Takes a Cipher State (with key, nonce, and associated data) and encrypts a plaintext.
   * The cipher state in not changed
   * @param plaintext data to encrypt
   * @returns sealed ciphertext including authentication tag
   */
  encrypt(plaintext: Uint8Array): Uint8Array {
    // If plaintext is empty, we raise an error
    if (plaintext.length == 0) {
      throw new Error("tried to encrypt empty plaintext");
    }

    return chaCha20Poly1305Encrypt(plaintext, this.nonce, this.ad, this.k);
  }

  /**
   * Takes a Cipher State (with key, nonce, and associated data) and decrypts a ciphertext
   * The cipher state is not changed
   * @param ciphertext data to decrypt
   * @returns plaintext
   */
  decrypt(ciphertext: Uint8Array): Uint8Array {
    // If ciphertext is empty, we raise an error
    if (ciphertext.length == 0) {
      throw new Error("tried to decrypt empty ciphertext");
    }
    const plaintext = chaCha20Poly1305Decrypt(ciphertext, this.nonce, this.ad, this.k);
    if (!plaintext) {
      throw new Error("decryptWithAd failed");
    }

    return plaintext;
  }
}

/**
 * A Noise public key is a public key exchanged during Noise handshakes (no private part)
 * This follows https://rfc.vac.dev/spec/35/#public-keys-serialization
 */
export class NoisePublicKey {
  /**
   * @param flag 1 to indicate that the public key is encrypted, 0 for unencrypted.
   * Note: besides encryption, flag can be used to distinguish among multiple supported Elliptic Curves
   * @param pk contains the X coordinate of the public key, if unencrypted
   * or the encryption of the X coordinate concatenated with the authorization tag, if encrypted
   */
  constructor(public readonly flag: number, public readonly pk: Uint8Array) {}

  /**
   * Create a copy of the NoisePublicKey
   * @returns a copy of the NoisePublicKey
   */
  clone(): NoisePublicKey {
    return new NoisePublicKey(this.flag, new Uint8Array(this.pk));
  }

  /**
   * Check NoisePublicKey equality
   * @param other object to compare against
   * @returns true if equal, false otherwise
   */
  equals(other: NoisePublicKey): boolean {
    return this.flag == other.flag && uint8ArrayEquals(this.pk, other.pk);
  }

  /**
   * Converts a public Elliptic Curve key to an unencrypted Noise public key
   * @param publicKey 32-byte public key
   * @returns NoisePublicKey
   */
  static fromPublicKey(publicKey: bytes32): NoisePublicKey {
    return new NoisePublicKey(0, publicKey);
  }

  /**
   * Converts a Noise public key to a stream of bytes as in https://rfc.vac.dev/spec/35/#public-keys-serialization
   * @returns Serialized NoisePublicKey
   */
  serialize(): Uint8Array {
    // Public key is serialized as (flag || pk)
    // Note that pk contains the X coordinate of the public key if unencrypted
    // or the encryption concatenated with the authorization tag if encrypted
    const serializedNoisePublicKey = new Uint8Array(uint8ArrayConcat([new Uint8Array([this.flag ? 1 : 0]), this.pk]));
    return serializedNoisePublicKey;
  }

  /**
   * Converts a serialized Noise public key to a NoisePublicKey object as in https://rfc.vac.dev/spec/35/#public-keys-serialization
   * @param serializedPK Serialized NoisePublicKey
   * @returns NoisePublicKey
   */
  static deserialize(serializedPK: Uint8Array): NoisePublicKey {
    if (serializedPK.length == 0) throw new Error("invalid serialized key");

    // We retrieve the encryption flag
    const flag = serializedPK[0];
    if (!(flag == 0 || flag == 1)) throw new Error("invalid flag in serialized public key");

    const pk = serializedPK.subarray(1);

    return new NoisePublicKey(flag, pk);
  }

  /**
   * Encrypt a NoisePublicKey using a ChaChaPolyCipherState
   * @param pk NoisePublicKey to encrypt
   * @param cs ChaChaPolyCipherState used to encrypt
   * @returns encrypted NoisePublicKey
   */
  static encrypt(pk: NoisePublicKey, cs: ChaChaPolyCipherState): NoisePublicKey {
    // We proceed with encryption only if
    // - a key is set in the cipher state
    // - the public key is unencrypted
    if (!isEmptyKey(cs.k) && pk.flag == 0) {
      const encPk = cs.encrypt(pk.pk);
      return new NoisePublicKey(1, encPk);
    }

    // Otherwise we return the public key as it is
    return pk.clone();
  }

  /**
   * Decrypts a Noise public key using a ChaChaPoly Cipher State
   * @param pk NoisePublicKey to decrypt
   * @param cs ChaChaPolyCipherState used to decrypt
   * @returns decrypted NoisePublicKey
   */
  static decrypt(pk: NoisePublicKey, cs: ChaChaPolyCipherState): NoisePublicKey {
    // We proceed with decryption only if
    // - a key is set in the cipher state
    // - the public key is encrypted
    if (!isEmptyKey(cs.k) && pk.flag == 1) {
      const decrypted = cs.decrypt(pk.pk);
      return new NoisePublicKey(0, decrypted);
    }

    // Otherwise we return the public key as it is
    return pk.clone();
  }
}
