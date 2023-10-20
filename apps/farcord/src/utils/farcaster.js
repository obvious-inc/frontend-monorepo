import { decodeAbiParameters, toHex } from "viem";
import { DEFAULT_CHAIN_ID } from "../hooks/farcord";

export const ID_REGISTRY_ADDRESS = "0x00000000fcaf86937e41ba038b4fa40baa4b780a";
export const STORAGE_REGISTRY_ADDRESS =
  "0x00000000fcCe7f938e7aE6D3c335bD6a1a7c593D";
export const BUNDLER_CONTRACT_ADDRESS =
  "0x00000000fc94856F3967b047325F88d47Bc225d0";

export const WARPCAST_RECOVERY_PROXY_ADDRESS =
  "0x00000000fcD5A8E45785c8A4b9a718C9348e4F18";

export const KEY_METADATA_TYPE = [
  {
    components: [
      {
        internalType: "uint256",
        name: "requestFid",
        type: "uint256",
      },
      {
        internalType: "address",
        name: "requestSigner",
        type: "address",
      },
      {
        internalType: "bytes",
        name: "signature",
        type: "bytes",
      },
      {
        internalType: "uint256",
        name: "deadline",
        type: "uint256",
      },
    ],
    internalType: "struct SignedKeyRequestValidator.SignedKeyRequestMetadata",
    name: "metadata",
    type: "tuple",
  },
];

export const REGISTER_REQUEST_VALIDATOR_EIP_712_DOMAIN = {
  name: "Farcaster IdRegistry",
  version: "1",
  chainId: DEFAULT_CHAIN_ID,
  verifyingContract: ID_REGISTRY_ADDRESS,
};

export const ID_REGISTRATION_REQUEST_TYPE = [
  { name: "to", type: "address" },
  { name: "recovery", type: "address" },
  { name: "nonce", type: "uint256" },
  { name: "deadline", type: "uint256" },
];

export const ID_TRANSFER_REQUEST_TYPE = [
  { name: "fid", type: "uint256" },
  { name: "to", type: "address" },
  { name: "nonce", type: "uint256" },
  { name: "deadline", type: "uint256" },
];

export const KEY_REGISTRY_EIP_712_DOMAIN = {
  name: "Farcaster KeyRegistry",
  version: "1",
  chainId: DEFAULT_CHAIN_ID,
  verifyingContract: "0x00000000fc9e66f1c6d86d750b4af47ff0cc343d",
};

export const KEY_REGISTRY_ADD_TYPE = [
  { name: "owner", type: "address" },
  { name: "keyType", type: "uint32" },
  { name: "key", type: "bytes" },
  { name: "metadataType", type: "uint8" },
  { name: "metadata", type: "bytes" },
  { name: "nonce", type: "uint256" },
  { name: "deadline", type: "uint256" },
];

export const decodeMetadata = (metadata) => {
  // if metadata is of type buffer, convert to hex
  if (Buffer.isBuffer(metadata) || metadata instanceof Uint8Array) {
    metadata = toHex(metadata);
  }

  const parsedMetadata = decodeAbiParameters(KEY_METADATA_TYPE, metadata);
  return parsedMetadata;
};
