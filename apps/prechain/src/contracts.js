import { mainnet, sepolia } from "wagmi/chains";
import { object as objectUtils } from "@shades/common/utils";
import useChainId from "./hooks/chain-id.js";

export const ETH_TOKEN_CONTRACT_ADDRESS =
  "0x0000000000000000000000000000000000000000";
export const USDC_TOKEN_CONTRACT_ADDRESS =
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
export const WETH_TOKEN_CONTRACT_ADDRESS =
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

export const DAO_TOKEN_BUYER_CONTRACT =
  "0x4f2acdc74f6941390d9b1804fabc3e780388cfe5";
export const DAO_PAYER_CONTRACT = "0xd97bcd9f47cee35c0a9ec1dc40c1269afc9e8e1d";
export const DAO_PROXY_CONTRACT = "0x6f3e6272a167e8accb32072d08e0957f9c79223d";
export const DAO_DATA_PROXY_CONTRACT =
  "0xf790a5f59678dd733fb3de93493a91f472ca1365";
export const DAO_TOKEN_CONTRACT = "0x9c8ff314c9bc7f6e59a9d9225fb22946427edc03";
export const DAO_AUCTION_HOUSE_PROXY_CONTRACT =
  "0x830bd73e4184cef73443c15111a1df14e495c706";
export const DAO_DESCRIPTOR_CONTRACT =
  "0x6229c811d04501523c6058bfaac29c91bb586268";

const addressByIdentifierByChainId = {
  [mainnet.id]: {
    "eth-token": ETH_TOKEN_CONTRACT_ADDRESS,
    "weth-token": WETH_TOKEN_CONTRACT_ADDRESS,
    "usdc-token": USDC_TOKEN_CONTRACT_ADDRESS,

    // Nouns contracts
    dao: DAO_PROXY_CONTRACT,
    data: DAO_DATA_PROXY_CONTRACT,
    token: DAO_TOKEN_CONTRACT,
    "auction-house": DAO_AUCTION_HOUSE_PROXY_CONTRACT,
    descriptor: DAO_DESCRIPTOR_CONTRACT,
    payer: DAO_PAYER_CONTRACT,
    "token-buyer": DAO_TOKEN_BUYER_CONTRACT,
  },
  [sepolia.id]: {
    "eth-token": "0x0000000000000000000000000000000000000000",
    "weth-token": "0x0000000000000000000000000000000000000000",
    "usdc-token": "0x0000000000000000000000000000000000000000",

    // Nouns contracts
    dao: "0x35d2670d7c8931aacdd37c89ddcb0638c3c44a57",
    data: "0x9040f720aa8a693f950b9cf94764b4b06079d002",
    token: "0x4c4674bb72a096855496a7204962297bd7e12b85",
    "auction-house": "0x0000000000000000000000000000000000000000",
    descriptor: "0x0000000000000000000000000000000000000000",
    payer: "0x0000000000000000000000000000000000000000",
    "token-buyer": "0x0000000000000000000000000000000000000000",
  },
};

const identifierByAddressByChainId = objectUtils.mapValues(
  (addressByIdentifier) => objectUtils.mirror(addressByIdentifier),
  addressByIdentifierByChainId
);

const metaByIdentifier = {
  "eth-token": {
    token: "ETH",
  },
  "weth-token": {
    name: "WETH Token Contract",
    token: "WETH",
  },
  "usdc-token": {
    token: "USDC",
  },

  // Nouns contracts
  dao: {
    name: "DAO Governance",
    description: "NounsDAOProxy",
  },
  data: {
    name: "DAO Candidates",
    description: "NounsDAODataProxy",
  },
  token: {
    name: "Nouns Token",
  },
  "auction-house": {
    name: "Nouns Auction House",
    description: "NounsAuctionHouseProxy",
  },
  descriptor: {
    name: "Nouns Art",
    description: "NounsDescriptorV2",
  },
  "token-buyer": {
    name: "DAO Token Buyer",
  },
  payer: {
    name: "DAO Payer",
  },
};

export const resolveIdentifier = (chainId, identifier) => {
  const address = addressByIdentifierByChainId[chainId]?.[identifier];
  if (address == null) return null;
  const meta = metaByIdentifier[identifier];
  return { address, ...meta };
};

export const resolveAddress = (chainId, address) => {
  const identifier =
    identifierByAddressByChainId[chainId]?.[address.toLowerCase()];
  if (identifier == null) return null;
  const meta = metaByIdentifier[identifier];
  return { address, ...meta };
};

export const useContract = (identifierOrAddress) => {
  const chainId = useChainId();
  return (
    resolveIdentifier(chainId, identifierOrAddress) ??
    resolveAddress(chainId, identifierOrAddress)
  );
};
