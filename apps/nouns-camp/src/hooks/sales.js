import React from "react";
import { decodeEventLog, parseAbi } from "viem";
import { usePublicClient } from "wagmi";

export const useSaleInfo = ({ transactionHash, sourceAddress }) => {
  const publicClient = usePublicClient();
  const [amount, setAmount] = React.useState(0);

  React.useEffect(() => {
    const getReceipts = async () => {
      const receipts = await publicClient.getTransactionReceipt({
        hash: transactionHash,
      });

      let sumAmount = 0;
      receipts?.logs.map((event) => {
        try {
          const decodedEvent = decodeEventLog({
            abi: parseAbi([
              "event Transfer(address indexed src, address indexed dst, uint256 amount)",
            ]),
            topics: event.topics,
            data: event.data,
          });

          const args = decodedEvent.args;
          if (args?.src.toLowerCase() === sourceAddress.toLowerCase()) {
            sumAmount += parseInt(args.amount);
          }
        } catch (e) {
          // ignore errors decoding non-transfer events
        }
      });

      setAmount(sumAmount);
    };

    getReceipts();
  }, [publicClient, transactionHash, sourceAddress]);

  return amount;
};
