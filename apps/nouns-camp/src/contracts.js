import { mainnet, sepolia } from "wagmi/chains";
import { object as objectUtils } from "@shades/common/utils";
import { CHAIN_ID } from "./constants/env.js";

const ETH_TOKEN_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";

const DAO_LOGIC_PROXY_CONTRACT = "0x5d2C31ce16924C2a71D317e5BbFd5ce387854039";
const DAO_EXECUTOR_PROXY_CONTRACT =
  "0xd5f279ff9EB21c6D40C8f345a66f2751C4eeA1fB";
const DAO_DATA_PROXY_CONTRACT = "0x5d2C31ce16924C2a71D317e5BbFd5ce387854039";
const DAO_TOKEN_CONTRACT = "0x4b10701Bfd7BFEdc47d50562b76b436fbB5BdB3B";
const DAO_AUCTION_HOUSE_PROXY_CONTRACT =
  "0x55e0F7A3bB39a28Bd7Bcc458e04b3cF00Ad3219E";
const DAO_DESCRIPTOR_CONTRACT = "0xb2a47999b3117c7dD628920ED8e77eBDfB948B68";
const DAO_TOKEN_BUYER_CONTRACT = "0x4f2acdc74f6941390d9b1804fabc3e780388cfe5";
const DAO_PAYER_CONTRACT = "0x0";

const addressByIdentifierByChainId = {
  [mainnet.id]: {
    "eth-token": ETH_TOKEN_CONTRACT_ADDRESS,
    "weth-token": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    "wsteth-token": "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0",
    "oeth-token": "0x856c4Efb76C1D1AE02e20CEB03A2A6a08b0b8dC3",
    "reth-token": "0xae78736cd615f374d3085123a210448e74fc6393",
    "usdc-token": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "steth-token": "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
    "$nouns-token": "0x5c1760c98be951a4067df234695c8014d8e7619c",
    "lido-withdrawal-queque": "0x889edc2edab5f40e902b864ad4d7ade8e412f9b1",
    "prop-house": "0x000000002c93cad6f9cfd00c603aef62458d8a48",
    "prop-house-timed-round-implementation":
      "0x43c015df7f3868b287ad94d88b1e05f596bba453",

    // Nouns contracts
    dao: DAO_LOGIC_PROXY_CONTRACT,
    executor: DAO_EXECUTOR_PROXY_CONTRACT,
    data: DAO_DATA_PROXY_CONTRACT,
    token: DAO_TOKEN_CONTRACT,
    "auction-house": DAO_AUCTION_HOUSE_PROXY_CONTRACT,
    "auction-house-admin": "0x0",
    descriptor: DAO_DESCRIPTOR_CONTRACT,
    "fork-escrow": "0x0",
    payer: DAO_PAYER_CONTRACT,
    "executor-v1": "0xd5f279ff9EB21c6D40C8f345a66f2751C4eeA1fB",
    "token-buyer": DAO_TOKEN_BUYER_CONTRACT,
    "stream-factory": "0x0",
    "client-incentives-rewards-proxy":
      "0x0",
    "prop-house-nouns-house": "0x0",
  },
  [sepolia.id]: {
    "eth-token": ETH_TOKEN_CONTRACT_ADDRESS,
    "weth-token": "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
    "usdc-token": "0xebcc972b6b3eb15c0592be1871838963d0b94278",

    // Nouns contracts
    dao: "0xa7C37f79ff5E6F932147fC69724B6ED432CA6Aa7",
    executor: "0xE54f098b1880C536e0083720922b8a365FB403DC",
    data: "0xa7C37f79ff5E6F932147fC69724B6ED432CA6Aa7",
    token: "0x6e48e79f718776CF412a87e047722dBFda5B465D",
    "auction-house": "0xA777a0a132dCc0a1c35E1eA19f28595dBe7ca6a6",
    "auction-house-admin": "0x7Dc74E65a3619C28076F06135ef9DCAa9b7ba8cF",
    descriptor: "0x852f20f0140a4b5aa29c70bf39c9a85edc2b454e",
    "fork-escrow": "0x0",
    payer: "0x0",
    "executor-v1": "0x0",
    "token-buyer": "0x0",
    "stream-factory": "0x0",
    "client-incentives-rewards-proxy": "0x0",
    "prop-house-nouns-house": "0x0",
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
    description: "NounsDescriptorV2",
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
};

export const resolveIdentifier = (identifier) => {
  const address = addressByIdentifierByChainId[CHAIN_ID]?.[identifier];
  if (address == null) return null;
  const meta = metaByIdentifier[identifier];
  return { address, ...meta };
};

export const resolveAddress = (address) => {
  const identifier =
    identifierByAddressByChainId[CHAIN_ID]?.[address.toLowerCase()];
  if (identifier == null) return null;
  const meta = metaByIdentifier[identifier];
  return { address, identifier, ...meta };
};
