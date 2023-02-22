import type { bytes32 } from "./basic.js";

export interface KeyPair {
  publicKey: bytes32;
  privateKey: bytes32;
}
