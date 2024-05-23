import React from "react";
import { decodeEventLog } from "viem";
import { usePublicClient } from "wagmi";

const fetchAmountFromTransferEvents = ({ event, buyerAddress }) => {
  try {
    const decodedEvent = decodeEventLog({
      abi: [
        {
          inputs: [
            { indexed: true, name: "src", type: "address" },
            { indexed: true, name: "dst", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          name: "Transfer",
          type: "event",
        },
      ],
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
      abi: [
        {
          inputs: [
            { indexed: true, name: "forkId", type: "uint32" },
            { indexed: true, name: "owner", type: "address" },
            { name: "tokenIds", type: "uint256[]" },
            { name: "proposalIds", type: "uint256[]" },
            { name: "reason", type: "string" },
          ],
          name: "JoinFork",
          type: "event",
        },
      ],
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
