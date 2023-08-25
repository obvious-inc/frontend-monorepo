import React from "react";
import { useBlockNumber } from "wagmi";

const useApproximateBlockTimestampCalculator = () => {
  const { data: latestBlockNumber } = useBlockNumber();

  return React.useCallback(
    (blockNumber) => {
      if (blockNumber == null) return null;
      if (latestBlockNumber == null) return null;

      const secondsPerBlock = 12; // Copied from agora

      const nowSeconds = new Date().getTime() / 1000;

      const timestampSeconds =
        nowSeconds +
        secondsPerBlock * (parseInt(blockNumber) - Number(latestBlockNumber));

      return new Date(timestampSeconds * 1000);
    },
    [latestBlockNumber]
  );
};

export default useApproximateBlockTimestampCalculator;
