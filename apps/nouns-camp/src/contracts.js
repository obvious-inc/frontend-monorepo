import { object as objectUtils } from "@shades/common/utils";
import { mainnet, sepolia, goerli } from "./chains.js";

const ETH_TOKEN_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";

const DAO_LOGIC_PROXY_CONTRACT = "0x5d2C31ce16924C2a71D317e5BbFd5ce387854039";
const DAO_EXECUTOR_PROXY_CONTRACT =
  "0xd5f279ff9EB21c6D40C8f345a66f2751C4eeA1fB";
const DAO_DATA_PROXY_CONTRACT = "0x5d2C31ce16924C2a71D317e5BbFd5ce387854039";
const DAO_TOKEN_CONTRACT = "0x4b10701Bfd7BFEdc47d50562b76b436fbB5BdB3B";
const DAO_AUCTION_HOUSE_PROXY_CONTRACT =
  "0x55e0F7A3bB39a28Bd7Bcc458e04b3cF00Ad3219E";
const DAO_DESCRIPTOR_CONTRACT = "0xb2a47999b3117c7dD628920ED8e77eBDfB948B68";
const DAO_TOKEN_BUYER_CONTRACT = "0x0000000000000000000000000000000000000000";
const DAO_PAYER_CONTRACT = "0x0000000000000000000000000000000000000000";

const addressByIdentifierByChainId = {
  [mainnet.id]: {
    "eth-token": ETH_TOKEN_CONTRACT_ADDRESS,
    "weth-token": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    "wsteth-token": "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0",
    "reth-token": "0xae78736cd615f374d3085123a210448e74fc6393",
    "usdc-token": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "steth-token": "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
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
    "auction-house-admin": "0xc1c119932d78ab9080862c5fcb964029f086401e",
    descriptor: DAO_DESCRIPTOR_CONTRACT,
    "fork-escrow": "",
    payer: DAO_PAYER_CONTRACT,
    "executor-v1": "0x0bc3807ec262cb779b38d65b38158acc3bfede10",
    "token-buyer": DAO_TOKEN_BUYER_CONTRACT,
    "stream-factory": "0x0000000000000000000000000000000000000000",
    "prop-house-nouns-house": "0x0000000000000000000000000000000000000000",
  },
  [sepolia.id]: {
    "eth-token": ETH_TOKEN_CONTRACT_ADDRESS,
    "weth-token": "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
    "usdc-token": "0xebcc972b6b3eb15c0592be1871838963d0b94278",

    // Nouns contracts
    dao: "0x0F4a7f71174E79e20fc192C487c2492A82d46FAE",
    executor: "0x97c9d93e9Bec3b764aA1F9f344F7da0456c3D289",
    data: "0x0F4a7f71174E79e20fc192C487c2492A82d46FAE",
    token: "0xb189804b02C3A435dD8147335d7E3ba6E15C0366",
    "auction-house": "0xB2e042E602582Aa58F076eB0aae379744bc6247E",
    "auction-house-admin": "0x0c9342c19E12DB744802BA7fC60B42c79f9Dc013",
    descriptor: "0x21bd07BF66267Ab3B15F83C888AFE9f56A2b58c7",
    "fork-escrow": "0x0000000000000000000000000000000000000000",
    payer: "0x0000000000000000000000000000000000000000",
    "token-buyer": "0x0000000000000000000000000000000000000000",
    "stream-factory": "0x0000000000000000000000000000000000000000",
    "prop-house-nouns-house": "0x0000000000000000000000000000000000000000",
  },
  [goerli.id]: {
    "eth-token": ETH_TOKEN_CONTRACT_ADDRESS,
    "usdc-token": "0x07865c6e87b9f70255377e024ace6630c1eaa37f",
    "weth-token": "0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6",
    "prop-house": "0x6381795e52fa8bc7957e355d1d685986bc8d841b",
    "prop-house-timed-round-implementation":
      "0x8f6084435799f15a78cd2f5c6dc1555d91ebd473",

    // Nouns contracts
    dao: "0xddE586Bc15E36aFE7ED322DF8582171f224374ad",
    executor: "0x4733DbF4dB8a0AFe3cc17921792dd2545a84B505",
    data: "0xddE586Bc15E36aFE7ED322DF8582171f224374ad",
    token: "0x77a74fBb28a1E08645587f52B73170D4c69Ba212",
    "auction-house": "0x598949186a38683C18697705aDcdC705bFc691a0",
    descriptor: "0xB6D0AF8C27930E13005Bf447d54be8235724a102",
    payer: "0x0000000000000000000000000000000000000000",
    "token-buyer": "0x0000000000000000000000000000000000000000",
    "stream-factory": "0x0000000000000000000000000000000000000000",
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
  return { address, identifier, ...meta };
};
