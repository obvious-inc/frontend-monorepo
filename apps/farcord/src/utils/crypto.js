import { getPublicKeyAsync, utils as EdDSAUtils } from "@noble/ed25519";
import { bytesToHex } from "viem";

export const createKeyPair = async () => {
  const signerPrivateKey = EdDSAUtils.randomPrivateKey();
  return getPublicKeyAsync(signerPrivateKey)
    .then((publicKey) => {
      const createdSigner = {
        privateKey: bytesToHex(signerPrivateKey),
        publicKey: bytesToHex(publicKey),
      };
      return createdSigner;
    })
    .catch((e) => {
      throw e;
    });
};
