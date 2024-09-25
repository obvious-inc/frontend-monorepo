import React from "react";
import { decodeEventLog } from "viem";
import { resolveIdentifier as resolveContractIdentifier } from "../contracts.js";
import { useTransaction, useTransactionReceipt } from "wagmi";

const decodeEventLogs = ({ logs, abi }) => {
  const decodedEventLogs = [];

  // Find matching logs
  for (const log of logs) {
    try {
      const decodedLog = decodeEventLog({
        abi,
        topics: log.topics,
        data: log.data,
      });
      decodedEventLogs.push(decodedLog);
    } catch (e) {
      // Ignore non-matching log
    }
  }

  return decodedEventLogs;
};

const decodeNounTransferEvent = (transactionReceipt) => {
  const { address: nounTokenAddress } = resolveContractIdentifier("token");

  const logs = transactionReceipt.logs.filter(
    (l) => l.address.toLowerCase() === nounTokenAddress,
  );

  const decodedLogs = decodeEventLogs({
    logs,
    abi: [
      {
        inputs: [
          { indexed: true, name: "from", type: "address" },
          { indexed: true, name: "to", type: "address" },
          { indexed: true, name: "tokenId", type: "uint256" },
        ],
        name: "Transfer",
        type: "event",
      },
    ],
  });

  return decodedLogs[0];
};

const decodeForkEvents = (transactionReceipt) => {
  const { address: daoProxyAddress } = resolveContractIdentifier("dao");

  const logs = transactionReceipt.logs.filter(
    (l) => l.address.toLowerCase() === daoProxyAddress,
  );

  const decodedLogs = decodeEventLogs({
    logs,
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
      {
        inputs: [
          { indexed: true, name: "forkId", type: "uint32" },
          { indexed: true, name: "owner", type: "address" },
          { name: "tokenIds", type: "uint256[]" },
          { name: "proposalIds", type: "uint256[]" },
          { name: "reason", type: "string" },
        ],
        name: "EscrowedToFork",
        type: "event",
      },
      {
        inputs: [
          { indexed: true, name: "forkId", type: "uint32" },
          { indexed: true, name: "owner", type: "address" },
          { name: "tokenIds", type: "uint256[]" },
        ],
        name: "WithdrawFromForkEscrow",
        type: "event",
      },
    ],
  });

  return decodedLogs[0];
};

const decodeEthTransferEventLogs = (transactionReceipt) => {
  const { address: wethTokenAddress } = resolveContractIdentifier("weth-token");
  const blurPoolAddress = "0x0000000000a39bb272e79075ade125fd351887ac";

  const logs = transactionReceipt.logs.filter((l) =>
    [wethTokenAddress, blurPoolAddress].includes(l.address.toLowerCase()),
  );

  return decodeEventLogs({
    logs,
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
  });
};

export const useTransferMeta = (transactionHash, { enabled = true } = {}) => {
  const { data: transaction } = useTransaction({
    hash: transactionHash,
    query: {
      enabled,
    },
  });
  const { data: receipt } = useTransactionReceipt({
    hash: transactionHash,
    query: {
      enabled,
    },
  });

  return React.useMemo(() => {
    if (transaction == null || receipt == null || !enabled) return null;

    const forkEvent = decodeForkEvents(receipt);

    if (forkEvent != null) {
      switch (forkEvent.eventName) {
        case "JoinFork":
          return {
            transferType: "fork-join",
            forkId: forkEvent.args.forkId,
            reason: forkEvent.args.reason,
          };
        case "EscrowedToFork":
          return {
            transferType: "fork-escrow",
            forkId: forkEvent.args.forkId,
            reason: forkEvent.args.reason,
          };
        case "WithdrawFromForkEscrow":
          return {
            transferType: "fork-escrow-withdrawal",
            forkId: forkEvent.args.forkId,
          };
        default:
          console.log("Unexpected event", forkEvent);
          throw new Error();
      }
    }

    const nounTransferEvent = decodeNounTransferEvent(receipt);
    const ethTransferLogs = decodeEthTransferEventLogs(receipt);

    const { to: receiverAccount } = nounTransferEvent.args;

    const balanceChangeByAddress = ethTransferLogs.reduce(
      (acc, { args: { src, dst, amount } }) => {
        acc[src.toLowerCase()] = (acc[src.toLowerCase()] ?? 0n) - amount;
        acc[dst.toLowerCase()] = (acc[dst.toLowerCase()] ?? 0n) + amount;
        return acc;
      },
      {
        [transaction.from.toLowerCase()]: 0n - transaction.value,
      },
    );

    const receiverBalanceChange =
      balanceChangeByAddress?.[receiverAccount.toLowerCase()] ?? 0;

    if (receiverBalanceChange < 0)
      return { transferType: "sale", amount: -receiverBalanceChange };

    return { transferType: "transfer" };
  }, [transaction, receipt, enabled]);
};
