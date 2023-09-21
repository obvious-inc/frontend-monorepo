import React from "react";
import { useAccount } from "wagmi";
import { useCachedState } from "@shades/common/app";
import {
  message as messageUtils,
  object as objectUtils,
} from "@shades/common/utils";

const { omitKey } = objectUtils;
const { createEmptyParagraphElement } = messageUtils;

const createCacheKey = (address) =>
  [address?.toLowerCase(), "proposal-drafts"].filter(Boolean).join("-");

const createEmptyItem = () => ({
  id: String(Date.now()),
  name: "",
  body: [createEmptyParagraphElement()],
  transactions: [],
});

export const useCollection = () => {
  const { address: connectedAccountAddress } = useAccount();

  const [entriesById, setEntries] = useCachedState(
    createCacheKey(connectedAccountAddress)
  );
  const items = entriesById == null ? [] : Object.values(entriesById);

  const createItem = React.useCallback(async () => {
    const item = createEmptyItem();
    await setEntries((entriesById) => ({
      ...entriesById,
      [item.id]: item,
    }));
    return item;
  }, [setEntries]);

  const deleteItem = React.useCallback(
    (id) => setEntries((entriesById) => omitKey(id, entriesById)),
    [setEntries]
  );

  return { items, createItem, deleteItem };
};

export const useSingleItem = (id) => {
  const { address: connectedAccountAddress } = useAccount();

  const [entriesById, setEntries] = useCachedState(
    createCacheKey(connectedAccountAddress)
  );
  const item = entriesById == null ? null : entriesById[id];

  const setName = React.useCallback(
    (name) =>
      setEntries((entriesById) => {
        const item = entriesById[id];
        return { ...entriesById, [item.id]: { ...item, name } };
      }),
    [id, setEntries]
  );

  const setBody = React.useCallback(
    (body) =>
      setEntries((entriesById) => {
        const item = entriesById[id];
        return { ...entriesById, [item.id]: { ...item, body } };
      }),
    [id, setEntries]
  );
  const setTransactions = React.useCallback(
    (transactions) =>
      setEntries((entriesById) => {
        const item = entriesById[id];
        return { ...entriesById, [item.id]: { ...item, transactions } };
      }),
    [id, setEntries]
  );

  return [item, { setName, setBody, setTransactions }];
};
