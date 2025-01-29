import React from "react";
import { parseAbiItem, parseEther } from "viem";
import { useAccount } from "wagmi";
import { useCachedState } from "@shades/common/app";
import {
  message as messageUtils,
  object as objectUtils,
  function as functionUtils,
} from "@shades/common/utils";

const { omitKey } = objectUtils;
const { createEmptyParagraphElement } = messageUtils;

const createCacheKey = (address) =>
  [address?.toLowerCase(), "proposal-drafts"].filter(Boolean).join("-");

const createEmptyItem = () => ({
  id: String(Date.now()),
  name: "",
  body: [createEmptyParagraphElement()],
  actions: [],
});

const SCHEMA_VERSION = 1;

const migrations = [
  // 0 -> 1
  (state) => {
    if (state.schema != null) return state;

    const migrateAction = (a) => {
      if (a.type !== "custom-transaction") return a;

      const { name, inputs } = parseAbiItem(
        a.contractCallFormattedTargetAbiItem,
      );
      const signature = `${name}(${inputs.map((i) => i.type).join(", ")})`;
      return {
        ...a,
        contractCallTarget: a.contractCallTargetAddress,
        contractCallSignature: signature,
        contractCallValue: parseEther(a.contractCallEthValue),
      };
    };

    return {
      schema: 1,
      entriesById: objectUtils.mapValues(
        (entry) => ({
          ...entry,
          actions: entry.actions.map(migrateAction),
        }),
        state,
      ),
    };
  },
  // Future migrations can be written in the following form:
  //
  // // 1 -> 2
  // (state) => {
  //   if (state.schema >= 2) return state;
  //   const migrate = (s) => {} // dummy
  //   return { ...migrate(state), schema: 2 };
  // },
];

const migrateStore = (state) => {
  if (state == null) return null;
  return functionUtils.pipe(...migrations)(state);
};

const useStore = (accountAddress) => {
  const [state, setState_] = useCachedState(
    createCacheKey(accountAddress),
    { schema: SCHEMA_VERSION, entriesById: {} },
    { middleware: migrateStore },
  );

  const setState = React.useCallback(
    (state) => {
      setState_((currentState) => {
        const newState =
          typeof state === "function" ? state(currentState) : state;
        return { ...currentState, ...newState };
      });
    },
    [setState_],
  );

  return [state, setState];
};

export const useCollection = () => {
  const { address: connectedAccountAddress } = useAccount();

  const [state, setState] = useStore(connectedAccountAddress);

  const { entriesById } = state;

  const items = entriesById == null ? [] : Object.values(entriesById);

  const createItem = React.useCallback(() => {
    const item = createEmptyItem();
    setState((state) => ({
      entriesById: {
        ...state.entriesById,
        [item.id]: item,
      },
    }));
    return item;
  }, [setState]);

  const deleteItem = React.useCallback(
    (id) => {
      setState((state) => ({
        entriesById: omitKey(id, state.entriesById),
      }));
    },
    [setState],
  );

  return { items, createItem, deleteItem };
};

export const useSingleItem = (id) => {
  const { address: connectedAccountAddress } = useAccount();

  const [state, setState] = useStore(connectedAccountAddress);

  const { entriesById } = state;

  const setName = React.useCallback(
    (name) =>
      setState((state) => {
        const item = state.entriesById[id];
        return {
          entriesById: { ...state.entriesById, [item.id]: { ...item, name } },
        };
      }),
    [id, setState],
  );

  const setBody = React.useCallback(
    (body) =>
      setState((state) => {
        const item = state.entriesById[id];
        return {
          entriesById: { ...state.entriesById, [item.id]: { ...item, body } },
        };
      }),
    [id, setState],
  );
  const setActions = React.useCallback(
    (actions) =>
      setState((state) => {
        const item = state.entriesById[id];
        const newActions =
          typeof actions === "function" ? actions(item.actions) : actions;
        return {
          entriesById: {
            ...state.entriesById,
            [item.id]: { ...item, actions: newActions },
          },
        };
      }),
    [id, setState],
  );

  const item = entriesById[id] ?? null;

  return [
    item,
    {
      setName,
      setBody,
      setActions,
    },
  ];
};
