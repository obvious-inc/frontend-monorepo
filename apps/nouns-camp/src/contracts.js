import { mainnet, sepolia, goerli } from "wagmi/chains";
import { object as objectUtils } from "@shades/common/utils";
import useChainId from "./hooks/chain-id.js";

const ETH_TOKEN_CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";
const USDC_TOKEN_CONTRACT_ADDRESS =
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const WETH_TOKEN_CONTRACT_ADDRESS =
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";

const DAO_LOGIC_PROXY_CONTRACT = "0x6f3e6272a167e8accb32072d08e0957f9c79223d";
const DAO_EXECUTOR_PROXY_CONTRACT =
  "0xb1a32fc9f9d8b2cf86c068cae13108809547ef71";
const DAO_DATA_PROXY_CONTRACT = "0xf790a5f59678dd733fb3de93493a91f472ca1365";
const DAO_TOKEN_CONTRACT = "0x9c8ff314c9bc7f6e59a9d9225fb22946427edc03";
const DAO_AUCTION_HOUSE_PROXY_CONTRACT =
  "0x830bd73e4184cef73443c15111a1df14e495c706";
const DAO_DESCRIPTOR_CONTRACT = "0x6229c811d04501523c6058bfaac29c91bb586268";
const DAO_TOKEN_BUYER_CONTRACT = "0x4f2acdc74f6941390d9b1804fabc3e780388cfe5";
const DAO_PAYER_CONTRACT = "0xd97bcd9f47cee35c0a9ec1dc40c1269afc9e8e1d";

const addressByIdentifierByChainId = {
  [mainnet.id]: {
    "eth-token": ETH_TOKEN_CONTRACT_ADDRESS,
    "weth-token": WETH_TOKEN_CONTRACT_ADDRESS,
    "usdc-token": USDC_TOKEN_CONTRACT_ADDRESS,
    "lido-steth-token": "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
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
    descriptor: DAO_DESCRIPTOR_CONTRACT,
    payer: DAO_PAYER_CONTRACT,
    "token-buyer": DAO_TOKEN_BUYER_CONTRACT,
    "stream-factory": "0x0fd206fc7a7dbcd5661157edcb1ffdd0d02a61ff",
    "prop-house-nouns-house": "0xa1b73d8cb149ab30ec43f83f577646ac8fe7e617",
  },
  [sepolia.id]: {
    "eth-token": ETH_TOKEN_CONTRACT_ADDRESS,
    "weth-token": "0xfff9976782d46cc05630d1f6ebab18b2324d6b14",
    "usdc-token": "0xebcc972b6b3eb15c0592be1871838963d0b94278",

    // Nouns contracts
    dao: "0x35d2670d7c8931aacdd37c89ddcb0638c3c44a57",
    executor: "0x07e5d6a1550ad5e597a9b0698a474aa080a2fb28",
    data: "0x9040f720aa8a693f950b9cf94764b4b06079d002",
    token: "0x4c4674bb72a096855496a7204962297bd7e12b85",
    "auction-house": "0x0000000000000000000000000000000000000000",
    descriptor: "0x0000000000000000000000000000000000000000",
    payer: "0x5a2a0951c6b3479dbee1d5909aac7b325d300d94",
    "token-buyer": "0x821176470cfef1db78f1e2dbae136f73c36ddd48",
    "stream-factory": "0xb78ccf3bd015f209fb9b2d3d132fd8784df78df5",
  },
  [goerli.id]: {
    "eth-token": ETH_TOKEN_CONTRACT_ADDRESS,
    "usdc-token": "0x07865c6e87b9f70255377e024ace6630c1eaa37f",
    "weth-token": "0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6",
    "prop-house": "0x6381795e52fa8bc7957e355d1d685986bc8d841b",
    "prop-house-timed-round-implementation":
      "0x8f6084435799f15a78cd2f5c6dc1555d91ebd473",

    // Nouns contracts
    dao: "0x22f7658f64be277e6b3968ece7b773b092a39864",
    executor: "0xc15008de43d93d115bd64ed4d95817ffdbfb6dea",
    data: "0xc0217355376e414a1c33dc3558a75625c5444006",
    token: "0x99265ce0983aab76f5a3789663fdd887de66638a",
    "auction-house": "0x32bbbf3721a1b05390daf4dec2f5fe4b935f25a1",
    descriptor: "0xc5fcaab38c4ab043e2706f245183d747299df414",
    payer: "0x63f8445c4549d17db181f9ade1a126eff8ee72d6",
    "token-buyer": "0x7ee1fe5973c2f6e42d2d40c93f0fded078c85770",
    "stream-factory": "0xc08a287ecb16ced801f28bb011924f7de5cc53a3",
    "prop-house-nouns-house": "0x0000000000000000000000000000000000000000",
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
    name: "WETH Token",
    token: "WETH",
  },
  "usdc-token": {
    token: "USDC",
  },
  "lido-steth-token": {
    name: "Lido: stETH Token",
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
  executor: { name: "Nouns DAO Executor" },
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

export const useContract = (identifierOrAddress) => {
  const chainId = useChainId();
  return (
    resolveIdentifier(chainId, identifierOrAddress) ??
    resolveAddress(chainId, identifierOrAddress)
  );
};
