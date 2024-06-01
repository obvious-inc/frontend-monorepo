import React from "react";
import useBlockNumber from "./block-number.js";

const secondsPerBlock = 12;

export const approximateBlockTimestamp = (blockNumber, referenceBlock) => {
  const blockNumberDiff = Number(blockNumber) - Number(referenceBlock.number);
  return new Date(
    referenceBlock.timestamp.getTime() +
      blockNumberDiff * secondsPerBlock * 1000,
  );
};

const useApproximateBlockTimestampCalculator = () => {
  const latestBlockNumber = useBlockNumber();

  return React.useCallback(
    (blockNumber, optionalReferenceBlock) => {
      if (blockNumber == null) return null;
      if (latestBlockNumber == null && optionalReferenceBlock) return null;

      const referenceBlock = optionalReferenceBlock ?? {
        number: latestBlockNumber,
        timestamp: new Date(),
      };

      return approximateBlockTimestamp(blockNumber, referenceBlock);
    },
    [latestBlockNumber],
  );
};

export default useApproximateBlockTimestampCalculator;
