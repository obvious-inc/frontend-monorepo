import { mainnet, sepolia } from "wagmi/chains";
import { object as objectUtils } from "@shades/common/utils";
import { CHAIN_ID } from "./constants/env.js";

const ETH_TOKEN_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";

const DAO_LOGIC_PROXY_CONTRACT = "0x6f3e6272a167e8accb32072d08e0957f9c79223d";
const DAO_EXECUTOR_PROXY_CONTRACT =
  "0xb1a32fc9f9d8b2cf86c068cae13108809547ef71";
const DAO_DATA_PROXY_CONTRACT = "0xf790a5f59678dd733fb3de93493a91f472ca1365";
const DAO_TOKEN_CONTRACT = "0x9c8ff314c9bc7f6e59a9d9225fb22946427edc03";
const DAO_AUCTION_HOUSE_PROXY_CONTRACT =
  "0x830bd73e4184cef73443c15111a1df14e495c706";
const DAO_DESCRIPTOR_CONTRACT = "0x33a9c445fb4fb21f2c030a6b2d3e2f12d017bfac";
const DAO_TOKEN_BUYER_CONTRACT = "0x4f2acdc74f6941390d9b1804fabc3e780388cfe5";
const DAO_PAYER_CONTRACT = "0xd97bcd9f47cee35c0a9ec1dc40c1269afc9e8e1d";

const addressByIdentifierByChainId = {
  [mainnet.id]: {
    "eth-token": ETH_TOKEN_CONTRACT_ADDRESS,
    "weth-token": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    "wsteth-token": "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0",
    "reth-token": "0xae78736cd615f374d3085123a210448e74fc6393",
    "usdc-token": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "steth-token": "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
    "$nouns-token": "0x5c1760c98be951a4067df234695c8014d8e7619c",
    "lido-withdrawal-queque": "0x889edc2edab5f40e902b864ad4d7ade8e412f9b1",
    "prop-house": "0x000000002c93cad6f9cfd00c603aef62458d8a48",
    "prop-house-timed-round-implementation":
      "0x43c015df7f3868b287ad94d88b1e05f596bba453",
    "chainlink-reth-eth-price-feed":
      "0x536218f9e9eb48863970252233c8f271f554c2d0",
    "chainlink-usdc-eth-price-feed":
      "0x986b5e1e1755e3c2440e960477f25201b0a8bbd4",

    // Nouns contracts
    dao: DAO_LOGIC_PROXY_CONTRACT,
    executor: DAO_EXECUTOR_PROXY_CONTRACT,
    data: DAO_DATA_PROXY_CONTRACT,
    token: DAO_TOKEN_CONTRACT,
    "auction-house": DAO_AUCTION_HOUSE_PROXY_CONTRACT,
    "auction-house-admin": "0xc1c119932d78ab9080862c5fcb964029f086401e",
    descriptor: DAO_DESCRIPTOR_CONTRACT,
    "fork-escrow": "0x44d97d22b3d37d837ce4b22773aad9d1566055d9",
    payer: DAO_PAYER_CONTRACT,
    "executor-v1": "0x0bc3807ec262cb779b38d65b38158acc3bfede10",
    "token-buyer": DAO_TOKEN_BUYER_CONTRACT,
    "stream-factory": "0x0fd206fc7a7dbcd5661157edcb1ffdd0d02a61ff",
    "client-incentives-rewards-proxy":
      "0x883860178f95d0c82413edc1d6de530cb4771d55",
    "prop-house-nouns-house": "0xa1b73d8cb149ab30ec43f83f577646ac8fe7e617",
  },
  [sepolia.id]: {
    "eth-token": ETH_TOKEN_CONTRACT_ADDRESS,
    "weth-token": "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
    "usdc-token": "0xebcc972b6b3eb15c0592be1871838963d0b94278",
    "steth-token": "0x3e3fe7dbc6b4c189e7128855dd526361c49b40af",
    "wsteth-token": "0xb82381a3fbd3fafa77b3a7be693342618240067b",
    "$nouns-token": "0x0000000000000000000000000000000000000000",

    // Nouns contracts
    dao: "0xac986edbae8bd8009751b314b8e21066b12ddc91",
    executor: "0x59d71479099fdcba4af3e48342243718a31c9918",
    data: "0xa78119641335df7eee3004de00b240dbdd20eb90",
    token: "0xdc562ce9f4a02c09be607198240ba8d75978e2db",
    descriptor: "0xeff9b9f788c2577b272abacc4ecdc8f7cf2f2114",
    "auction-house": "0x011671a1ba431f39479861ebe2813743a11183ff",
    "auction-house-admin": "0x4ac92d97979f7febd053ec905ceabbb0081c8942",
    "stream-escrow": "0x94cb8eee1d227ba2c693ce907541cc2325f10135",
    "fork-escrow": "0xa15b495deb1b77f066b0c286fdb640c81ef356c4",
    payer: "0x5a2a0951c6b3479dbee1d5909aac7b325d300d94",
    "token-buyer": "0x821176470cfef1db78f1e2dbae136f73c36ddd48",
    "stream-factory": "0xb78ccf3bd015f209fb9b2d3d132fd8784df78df5",
    "prop-house-nouns-house": "0x0000000000000000000000000000000000000000",
  },
};

const identifierByAddressByChainId = objectUtils.mapValues(
  (addressByIdentifier) => objectUtils.mirror(addressByIdentifier),
  addressByIdentifierByChainId,
);

const metaByIdentifier = {
  "eth-token": {
    token: "ETH",
  },
  "weth-token": {
    name: "wETH Token",
    token: "wETH",
  },
  "usdc-token": {
    name: "USDC Token",
    token: "USDC",
  },
  "steth-token": {
    name: "stETH Token",
    token: "stETH",
  },
  "$nouns-token": {
    name: "$nouns Token",
    token: "$nouns",
  },
  "lido-withdrawal-queque": {
    name: "Lido: Withdrawal Queue",
  },
  "prop-house": { name: "Prop House" },

  // Nouns contracts
  dao: {
    name: "Nouns DAO Governance",
    description: "NounsDAOProxy",
  },
  data: {
    name: "Nouns DAO Candidates",
    description: "NounsDAODataProxy",
  },
  executor: { name: "Nouns DAO Treasury" },
  token: {
    name: "Nouns Token",
  },
  "auction-house": {
    name: "Nouns Auction House",
    description: "NounsAuctionHouseProxy",
  },
  "auction-house-admin": {
    name: "Nouns Auction House Admin",
    description: "NounsAuctionHouseProxyAdmin",
  },
  descriptor: {
    name: "Nouns Art",
    description: "NounsDescriptorV3",
  },
  "fork-escrow": { name: "Nouns DAO Fork Escrow" },
  "token-buyer": {
    name: "Nouns DAO Token Buyer",
  },
  payer: {
    name: "Nouns DAO Payer",
  },
  "stream-factory": {
    name: "Nouns Stream Factory",
  },
  "client-incentives-rewards-proxy": {
    name: "Nouns Client Incentives Rewards Proxy",
  },
  "executor-v1": { name: "Nouns DAO Treasury v1" },
  "stream-escrow": { name: "Stream Escrow" },
};

export const resolveIdentifier = (identifier, { chainId = CHAIN_ID } = {}) => {
  const address = addressByIdentifierByChainId[chainId]?.[identifier];
  if (address == null) return null;
  const meta = metaByIdentifier[identifier];
  return { address, ...meta };
};

export const resolveAddress = (address, { chainId = CHAIN_ID } = {}) => {
  const identifier =
    identifierByAddressByChainId[chainId]?.[address?.toLowerCase()];
  if (identifier == null) return null;
  const meta = metaByIdentifier[identifier];
  return { address, identifier, ...meta };
};
