import React from "react";
import { decodeEventLog, zeroAddress } from "viem";
import { array as arrayUtils } from "@shades/common/utils";
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

const decodeNounTransferEvents = (transactionReceipt) => {
  const { address: nounTokenAddress } = resolveContractIdentifier("token");

  const logs = transactionReceipt.logs.filter(
    (l) => l.address.toLowerCase() === nounTokenAddress,
  );

  return decodeEventLogs({
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
      const nounIds = forkEvent.args.tokenIds.map((id) => parseInt(id));
      switch (forkEvent.eventName) {
        case "JoinFork":
          return {
            transferType: "fork-join",
            forkId: forkEvent.args.forkId,
            reason: forkEvent.args.reason,
            nounIds,
          };
        case "EscrowedToFork":
          return {
            transferType: "fork-escrow",
            forkId: forkEvent.args.forkId,
            reason: forkEvent.args.reason,
            nounIds,
          };
        case "WithdrawFromForkEscrow":
          return {
            transferType: "fork-escrow-withdrawal",
            forkId: forkEvent.args.forkId,
            nounIds,
          };
        default:
          console.log("Unexpected event", forkEvent);
          throw new Error();
      }
    }

    const transactionSenderAccount = transaction.from.toLowerCase();

    const nounTransferEvents = decodeNounTransferEvents(receipt);
    const transfers = nounTransferEvents
      .map((e) => ({
        from: e.args.from.toLowerCase(),
        to: e.args.to.toLowerCase(),
        nounId: parseInt(e.args.tokenId),
      }))
      .filter((t) => t.from !== zeroAddress);
    const senders = arrayUtils.unique(transfers.map((t) => t.from));
    const receivers = arrayUtils.unique(transfers.map((t) => t.to));

    const isSender = senders.includes(transactionSenderAccount);
    const isReceiver = receivers.includes(transactionSenderAccount);

    // If the account submitting the transaction isn’t involved in the
    // transfer, we don’t want to show it as the author of the event
    const authorAccount =
      isSender || isReceiver ? transactionSenderAccount : null;

    const isSwap =
      senders.toSorted().toString() === receivers.toSorted().toString();

    if (isSwap && senders.length === 2)
      return { transferType: "swap", authorAccount, transfers };

    const ethTransferLogs = decodeEthTransferEventLogs(receipt);

    const balanceChangeByAddress = ethTransferLogs.reduce(
      (acc, { args: { src, dst, amount } }) => {
        acc[src.toLowerCase()] = (acc[src.toLowerCase()] ?? 0n) - amount;
        acc[dst.toLowerCase()] = (acc[dst.toLowerCase()] ?? 0n) + amount;
        return acc;
      },
      {
        [transactionSenderAccount]: 0n - transaction.value,
      },
    );

    const isSale = [...senders, ...receivers].some((address) => {
      const change = balanceChangeByAddress?.[address] ?? 0n;
      return change !== 0n;
    });

    const hasTargetAccount = receivers.length === 1 || senders.length === 1;

    // The account all transfers are targeting or originating from
    const targetAccount = (() => {
      if (!hasTargetAccount) return null;
      if (receivers.length === senders.length)
        return authorAccount ?? senders[0];
      return senders.length === 1 ? senders[0] : receivers[0];
    })();

    if (isSale) {
      if (!hasTargetAccount) return { transferType: "bundled-sale", transfers };

      // We only trust the balance change enough to show it when it’s from the
      // author (transaction sender)
      if (targetAccount !== authorAccount)
        return { transferType: "sale", targetAccount, transfers };

      const balanceChange = balanceChangeByAddress?.[authorAccount] ?? 0n;
      const amount = balanceChange < 0n ? -balanceChange : balanceChange;

      return {
        transferType: "sale",
        authorAccount: targetAccount,
        amount: amount > 0n ? amount : null,
        transfers,
      };
    }

    if (!hasTargetAccount)
      return { transferType: "bundled-transfer", transfers };

    if (targetAccount === authorAccount)
      return { transferType: "transfer", authorAccount, transfers };

    return { transferType: "transfer", targetAccount, transfers };
  }, [transaction, receipt, enabled]);
};
