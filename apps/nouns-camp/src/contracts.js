import { mainnet, sepolia } from "wagmi/chains";
import { object as objectUtils } from "@shades/common/utils";
import { CHAIN_ID } from "./constants/env.js";

const ETH_TOKEN_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";

const DAO_LOGIC_PROXY_CONTRACT = "0x5d2c31ce16924c2a71d317e5bbfd5ce387854039";
const DAO_EXECUTOR_PROXY_CONTRACT =
  "0xd5f279ff9eb21c6d40c8f345a66f2751c4eea1fb";
const DAO_DATA_PROXY_CONTRACT = "0x5d2c31ce16924c2a71d317e5bbfd5ce387854039";
const DAO_TOKEN_CONTRACT = "0x4b10701bfd7bfedc47d50562b76b436fbb5bdb3b";
const DAO_AUCTION_HOUSE_PROXY_CONTRACT =
  "0x55e0f7a3bb39a28bd7bcc458e04b3cf00ad3219e";
const DAO_DESCRIPTOR_CONTRACT = "0xb2a47999b3117c7dd628920ed8e77ebdfb948b68";
const DAO_TOKEN_BUYER_CONTRACT = "0x387140cd0132ff750263f08acfdfbec7b0cf63c0";
const DAO_PAYER_CONTRACT = "0xf62387d21153fdcbb06ab3026c2089e418688164";

const addressByIdentifierByChainId = {
  [mainnet.id]: {
    "eth-token": ETH_TOKEN_CONTRACT_ADDRESS,
    "weth-token": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    "wsteth-token": "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0",
    "oeth-token": "0x856c4efb76c1d1ae02e20ceb03a2a6a08b0b8dc3",
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
    "auction-house-admin": "0xa4bebec5bf3670bb47a55ff705c91956c703237b",
    descriptor: DAO_DESCRIPTOR_CONTRACT,
    "fork-escrow": "0x0",
    payer: DAO_PAYER_CONTRACT,
    "executor-v1": "0xd5f279ff9eb21c6d40c8f345a66f2751c4eea1fb",
    "token-buyer": DAO_TOKEN_BUYER_CONTRACT,
    "stream-factory": "0xb2ffeef1f68cfacdefdafe6f1a9d30ff47c7cb5e",
    "client-incentives-rewards-proxy":
      "0x0",
    "prop-house-nouns-house": "0x0",
  },
  [sepolia.id]: {
    "eth-token": ETH_TOKEN_CONTRACT_ADDRESS,
    "weth-token": "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
    "usdc-token": "0xebcc972b6b3eb15c0592be1871838963d0b94278",
    "steth-token": "0x3e3fe7dbc6b4c189e7128855dd526361c49b40af",
    "wsteth-token": "0xb82381a3fbd3fafa77b3a7be693342618240067b",
    "$nouns-token": "0x0",

    // Nouns contracts
    dao: "0xa7c37f79ff5e6f932147fc69724b6ed432ca6aa7",
    executor: "0xe54f098b1880c536e0083720922b8a365fb403dc",
    data: "0xa7c37f79ff5e6f932147fc69724b6ed432ca6aa7",
    token: "0x6e48e79f718776cf412a87e047722dbfda5b465d",
    "auction-house": "0xa777a0a132dcc0a1c35e1ea19f28595dbe7ca6a6",
    "auction-house-admin": "0x7dc74e65a3619c28076f06135ef9dcaa9b7ba8cf",
    "fork-escrow": "0x0",
    payer: "0x5a2a0951c6b3479dbee1d5909aac7b325d300d94",
    "token-buyer": "0x821176470cfef1db78f1e2dbae136f73c36ddd48",
    "stream-factory": "0xb78ccf3bd015f209fb9b2d3d132fd8784df78df5",
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
