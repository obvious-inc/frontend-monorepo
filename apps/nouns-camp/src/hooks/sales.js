import React from "react";
import { decodeEventLog, parseAbi } from "viem";
import { usePublicClient } from "wagmi";

const fetchAmountFromTransferEvents = ({ event, buyerAddress }) => {
  try {
    const decodedEvent = decodeEventLog({
      abi: parseAbi([
        "event Transfer(address indexed src, address indexed dst, uint256 amount)",
      ]),
      topics: event.topics,
      data: event.data,
    });

    const args = decodedEvent.args;

    if (args?.src.toLowerCase() === buyerAddress.toLowerCase())
      return parseInt(args.amount);
  } catch (e) {
    // ignore errors decoding non-transfer events
  }
};

const fetchForkIdFromEvent = ({ event }) => {
  try {
    const decodedEvent = decodeEventLog({
      abi: parseAbi([
        "event JoinFork(uint32 indexed forkId, address indexed owner, uint256[] tokenIds, uint256[] proposals, string reason)",
      ]),
      topics: event.topics,
      data: event.data,
    });

    const args = decodedEvent.args;
    return args?.forkId;
  } catch (e) {
    // ignore errors decoding other events
  }

  return null;
};

export const useSaleInfo = ({ transactionHash, sourceAddress }) => {
  const publicClient = usePublicClient();
  const [amount, setAmount] = React.useState(0);
  const [forkId, setForkId] = React.useState(null);

  React.useEffect(() => {
    const getReceipts = async () => {
      const receipts = await publicClient.getTransactionReceipt({
        hash: transactionHash,
      });

      let sumAmount = 0;

      receipts?.logs.map((event) => {
        const transferAmount = fetchAmountFromTransferEvents({
          event,
          buyerAddress: sourceAddress,
        });
        if (transferAmount) sumAmount += transferAmount;

        const fork = fetchForkIdFromEvent({ event });
        if (fork != null) setForkId(fork);
      });

      setAmount(sumAmount);
    };

    getReceipts();
  }, [publicClient, transactionHash, sourceAddress]);

  return { amount, forkId };
};
