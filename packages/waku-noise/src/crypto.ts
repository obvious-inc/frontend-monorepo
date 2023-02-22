import { ChaCha20Poly1305, TAG_LENGTH } from "@stablelib/chacha20poly1305";
import { HKDF as hkdf } from "@stablelib/hkdf";
import { hash, SHA256 } from "@stablelib/sha256";
import * as x25519 from "@stablelib/x25519";
import { concat as uint8ArrayConcat } from "uint8arrays/concat";

import type { bytes32 } from "./@types/basic.js";
import type { KeyPair } from "./@types/keypair.js";

export const Curve25519KeySize = x25519.PUBLIC_KEY_LENGTH;

export const ChachaPolyTagLen = TAG_LENGTH;

/**
 * Generate hash using SHA2-256
 * @param data data to hash
 * @returns hash digest
 */
export function hashSHA256(data: Uint8Array): Uint8Array {
  return hash(data);
}

/**
 * Convert an Uint8Array into a 32-byte value. If the input data length is different
 * from 32, throw an error. This is used mostly as a validation function to ensure
 * that an Uint8Array represents a valid x25519 key
 * @param s input data
 * @return 32-byte key
 */
export function intoCurve25519Key(s: Uint8Array): bytes32 {
  if (s.length != x25519.PUBLIC_KEY_LENGTH) {
    throw new Error("invalid public key length");
  }

  return s;
}

/**
 * HKDF key derivation function using SHA256
 * @param ck chaining key
 * @param ikm input key material
 * @param length length of each generated key
 * @param numKeys number of keys to generate
 * @returns array  of `numValues` length containing Uint8Array keys of a given byte `length`
 */
export function HKDF(ck: bytes32, ikm: Uint8Array, length: number, numKeys: number): Array<Uint8Array> {
  const numBytes = length * numKeys;
  const okm = new hkdf(SHA256, ikm, ck).expand(numBytes);
  const result = [];
  for (let i = 0; i < numBytes; i += length) {
    const k = okm.subarray(i, i + length);
    result.push(k);
  }
  return result;
}

/**
 * Generate a random keypair
 * @returns Keypair
 */
export function generateX25519KeyPair(): KeyPair {
  const keypair = x25519.generateKeyPair();

  return {
    publicKey: keypair.publicKey,
    privateKey: keypair.secretKey,
  };
}

/**
 * Generate x25519 keypair using an input seed
 * @param seed 32-byte secret
 * @returns Keypair
 */
export function generateX25519KeyPairFromSeed(seed: bytes32): KeyPair {
  const keypair = x25519.generateKeyPairFromSeed(seed);

  return {
    publicKey: keypair.publicKey,
    privateKey: keypair.secretKey,
  };
}

/**
 * Encrypt and authenticate data using ChaCha20-Poly1305
 * @param plaintext data to encrypt
 * @param nonce 12 byte little-endian nonce
 * @param ad associated data
 * @param k 32-byte key
 * @returns sealed ciphertext including authentication tag
 */
export function chaCha20Poly1305Encrypt(
  plaintext: Uint8Array,
  nonce: Uint8Array,
  ad: Uint8Array,
  k: bytes32
): Uint8Array {
  const ctx = new ChaCha20Poly1305(k);
  return ctx.seal(nonce, plaintext, ad);
}

/**
 * Authenticate and decrypt data using ChaCha20-Poly1305
 * @param ciphertext data to decrypt
 * @param nonce 12 byte little-endian nonce
 * @param ad associated data
 * @param k 32-byte key
 * @returns plaintext if decryption was successful, `null` otherwise
 */
export function chaCha20Poly1305Decrypt(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  ad: Uint8Array,
  k: bytes32
): Uint8Array | null {
  const ctx = new ChaCha20Poly1305(k);

  return ctx.open(nonce, ciphertext, ad);
}

/**
 * Perform a Diffie–Hellman key exchange
 * @param privateKey x25519 private key
 * @param publicKey x25519 public key
 * @returns shared secret
 */
export function dh(privateKey: bytes32, publicKey: bytes32): bytes32 {
  try {
    const derivedU8 = x25519.sharedKey(privateKey, publicKey);

    if (derivedU8.length === 32) {
      return derivedU8;
    }

    return derivedU8.subarray(0, 32);
  } catch (e) {
    console.error(e);
    return new Uint8Array(32);
  }
}

/**
 * Generates a random static key commitment using a public key pk for randomness r as H(pk || s)
 * @param publicKey x25519 public key
 * @param r random fixed-length value
 * @returns 32 byte hash
 */
export function commitPublicKey(publicKey: bytes32, r: Uint8Array): bytes32 {
  return hashSHA256(uint8ArrayConcat([publicKey, r]));
}
