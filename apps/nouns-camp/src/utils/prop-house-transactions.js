import { encodeAbiParameters, decodeAbiParameters } from "viem";

export const CREATE_AND_FUND_ROUND_INPUT_TYPES = [
  { type: "address" },
  {
    type: "tuple",
    components: [
      { type: "address", name: "impl" },
      { type: "bytes", name: "config" },
      { type: "string", name: "title" },
      { type: "string", name: "description" },
    ],
  },
  {
    type: "tuple[]",
    components: [
      { type: "uint8", name: "assetType" },
      { type: "address", name: "token" },
      { type: "uint256", name: "identifier" },
      { type: "uint256", name: "amount" },
    ],
  },
];

const TIMED_ROUND_CONFIG_TYPE = {
  type: "tuple",
  components: [
    {
      name: "awards",
      type: "tuple[]",
      components: [
        { name: "assetType", type: "uint8" },
        { name: "token", type: "address" },
        { name: "identifier", type: "uint256" },
        { name: "amount", type: "uint256" },
      ],
    },
    {
      name: "metaTx",
      type: "tuple",
      components: [
        { name: "relayer", type: "address" },
        { name: "deposit", type: "uint256" },
      ],
    },
    { name: "proposalThreshold", type: "uint248" },
    { name: "proposingStrategies", type: "uint256[]" },
    { name: "proposingStrategyParamsFlat", type: "uint256[]" },
    { name: "votingStrategies", type: "uint256[]" },
    { name: "votingStrategyParamsFlat", type: "uint256[]" },
    { name: "proposalPeriodStartTimestamp", type: "uint40" },
    { name: "proposalPeriodDuration", type: "uint40" },
    { name: "votePeriodDuration", type: "uint40" },
    { name: "winnerCount", type: "uint16" },
  ],
};

export const encodeTimedRoundConfig = (config) =>
  encodeAbiParameters([TIMED_ROUND_CONFIG_TYPE], [config]);

export const decodeTimedRoundConfig = (encodedConfig) =>
  decodeAbiParameters([TIMED_ROUND_CONFIG_TYPE], encodedConfig)[0];
