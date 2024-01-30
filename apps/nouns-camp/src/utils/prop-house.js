import { parseEther, formatEther } from "viem";
import {
  GovPowerManager,
  TimedRound,
  AssetType,
  GovPowerStrategyType,
} from "@prophouse/sdk";
import { resolveIdentifier as resolveContractIdentifier } from "../contracts.js";

const parseFlattened2dArray = (array) => {
  const offsetsLength =
    typeof array[0] === "string"
      ? parseInt(array[0].slice(2), 16)
      : Number(array[0]);
  const offsets = array.slice(1, 1 + offsetsLength).map(Number);
  const elements = array.slice(1 + offsetsLength);
  return offsets.map((offset, i) => {
    if (i === offsets.length - 1) return elements.slice(offset);
    return elements.slice(offset, offsets[i + 1]);
  });
};

const createChainConfig = ({ publicClient }) => {
  const {
    // chain,
    transport,
  } = publicClient;
  return {
    // Prophouse SDK doesn’t support testnets
    evmChainId: 1, // chain.id,
    evm:
      transport.type === "fallback"
        ? transport.transports[0].value.url
        : transport.url,
  };
};

const getAsset = ({ type, amount }) => {
  switch (type) {
    case "eth": {
      return {
        assetType: AssetType.ETH,
        amount: parseEther(amount),
      };
    }

    default:
      throw new Error();
  }
};

const parseAsset = ({ assetType, amount }) => {
  switch (assetType) {
    case AssetType.ETH: {
      return {
        type: "eth",
        amount: formatEther(amount),
      };
    }

    default:
      throw new Error();
  }
};

const getStrategy = (
  identifier,
  {
    multiplier,
    // chainId
  }
) => {
  switch (identifier) {
    case "nouns-token": {
      const { address: nounsTokenAddress } = resolveContractIdentifier(
        1, // Prophouse SDK doesn’t support testnets
        "token"
      );
      return {
        strategyType: GovPowerStrategyType.CHECKPOINTABLE_ERC721,
        assetType: AssetType.ERC721,
        address: nounsTokenAddress,
        multiplier,
      };
    }

    default:
      throw new Error();
  }
};

export const getTimedRoundConfigStruct = async (config, { publicClient }) => {
  const round = TimedRound.for(createChainConfig({ publicClient }));

  const struct = await round.getConfigStruct({
    awards: config.awardAssets.map(getAsset),
    votingStrategies: [
      getStrategy(config.votingStrategy, {
        multiplier: config.voteMultiplier,
        chainId: publicClient.chain.id,
      }),
    ],
    proposalPeriodStartUnixTimestamp: Math.floor(
      config.proposalPeriodStartMillis / 1000
    ),
    proposalPeriodDurationSecs: Math.floor(
      config.proposalPeriodDurationMillis / 1000
    ),
    votePeriodDurationSecs: Math.floor(config.votePeriodDurationMillis / 1000),
    winnerCount: config.winnerCount,
  });

  // Make serializable
  return JSON.parse(
    JSON.stringify(struct, (_, value) => {
      if (value?.type === "BigNumber") return BigInt(value.hex).toString();
      if (typeof value === "bigint") return value.toString();
      return value;
    })
  );
};

export const parseTimedRoundConfigStruct = (struct, { publicClient }) => {
  const strategyUtil = GovPowerManager.for(createChainConfig({ publicClient }));

  const parseStrategy = ({ address, params }) => {
    const { type } = strategyUtil.get(address.toString());

    switch (type) {
      case GovPowerStrategyType.CHECKPOINTABLE_ERC721: {
        const { address: nounsTokenAddress } = resolveContractIdentifier(
          1, // Prophouse SDK doesn’t support testnets
          "token"
        );
        const contractAddress = params[0];
        const multiplier = params[3];

        if (BigInt(contractAddress) !== BigInt(nounsTokenAddress))
          throw new Error();

        return {
          identifier: "nouns-token",
          multiplier:
            multiplier == null ? null : Number(BigInt(multiplier).toString()),
        };
      }

      default:
        return { identifier: "custom" };
    }
  };

  const votingStrategyParams = parseFlattened2dArray(
    struct.votingStrategyParamsFlat
  );

  const votingStrategies = struct.votingStrategies.map((address, i) =>
    parseStrategy({
      address,
      params: votingStrategyParams[i],
    })
  );

  return {
    votingStrategy: votingStrategies[0]?.identifier,
    voteMultiplier: votingStrategies[0]?.multiplier,
    proposalPeriodStartMillis: struct.proposalPeriodStartTimestamp * 1000,
    proposalPeriodDurationMillis: struct.proposalPeriodDuration * 1000,
    votePeriodDurationMillis: struct.votePeriodDuration * 1000,
    winnerCount: struct.winnerCount,
    awardAssets: struct.awards.map(parseAsset),
  };
};
