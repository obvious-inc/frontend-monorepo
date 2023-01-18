import debug from "debug";
import React from "react";
import combineReducers from "./utils/combine-reducers.js";
import { sort, comparator } from "./utils/array.js";
import {
  OperationTypes,
  getOperationTypeName,
  validateOperationPermissions,
} from "./ns-waku.js";

const log = debug("ns-waku:operation-store");

const useOperationStoreInternal = () => {
  // const [operationHistory, setOperationHistory] = React.useState([]);

  const signersByUserAddress = (state, operation) => {
    switch (operation.data.type) {
      case OperationTypes.SIGNER_ADD: {
        const userAddress = operation.data.user;
        const previousSignerSet = new Set(state.get(userAddress)) ?? new Set();
        const updatedSignerSet = previousSignerSet.add(
          operation.data.body.signer
        );
        return new Map(state.set(userAddress, updatedSignerSet));
      }

      default:
        return state;
    }
  };

  const channelsById = (state, operation) => {
    switch (operation.data.type) {
      case OperationTypes.CHANNEL_ADD: {
        const channel = {
          id: operation.hash,
          name: operation.data.body.name,
          owner: operation.data.user,
        };
        return new Map(state.set(channel.id, channel));
      }

      case OperationTypes.CHANNEL_REMOVE: {
        const { channelId } = operation.data.body;
        const nextState = new Map(state);
        nextState.delete(channelId);
        return nextState;
      }

      case OperationTypes.CHANNEL_BROADCAST: {
        const { channelId } = operation.data.body;
        if (state.get(channelId) != null) return state;
        const nextState = new Map(state).set(channelId, { id: channelId });
        return nextState;
      }

      default:
        return state;
    }
  };

  const memberAddressesByChannelId = (state, operation) => {
    switch (operation.data.type) {
      case OperationTypes.CHANNEL_ADD: {
        const channelId = operation.hash;
        const previousMemberSet = new Set(state.get(channelId)) ?? new Set();
        const updatedMemberSet = new Set(previousMemberSet).add(
          operation.data.user
        );
        if (previousMemberSet.size === updatedMemberSet.size) return state;
        return new Map(state.set(channelId, [...updatedMemberSet]));
      }

      case OperationTypes.CHANNEL_MEMBER_ADD: {
        const channelId = operation.data.body.channelId;
        const previousMemberSet = new Set(state.get(channelId)) ?? new Set();
        const updatedMemberSet = new Set(previousMemberSet).add(
          operation.data.body.user
        );
        if (previousMemberSet.size === updatedMemberSet.size) return state;
        return new Map(state.set(channelId, [...updatedMemberSet]));
      }

      default:
        return state;
    }
  };

  const messagesById = (state, operation) => {
    switch (operation.data.type) {
      case OperationTypes.CHANNEL_MESSAGE_ADD: {
        const message = {
          id: operation.hash,
          signer: operation.signer,
          ...operation.data,
        };
        return new Map(state.set(message.id, message));
      }

      case OperationTypes.CHANNEL_MESSAGE_REMOVE: {
        const { targetMessageId } = operation.data.body;
        state.delete(targetMessageId);
        return new Map(state);
      }

      default:
        return state;
    }
  };

  const messageIdsByChannelId = (state, operation) => {
    switch (operation.data.type) {
      case OperationTypes.CHANNEL_MESSAGE_ADD: {
        const messageId = operation.hash;
        const channelId = operation.data.body.channelId;
        const previousMessageSet = new Set(state.get(channelId)) ?? new Set();
        const updatedMessageSet = previousMessageSet.add(messageId);
        return new Map(state.set(channelId, updatedMessageSet));
      }

      default:
        return state;
    }
  };

  const operationReducer = combineReducers({
    channelsById,
    memberAddressesByChannelId,
    messagesById,
    messageIdsByChannelId,
    signersByUserAddress,
  });

  const [state, dispatch] = React.useReducer(
    (state, action) => {
      switch (action.type) {
        case "merge-batch":
          return action.operations.reduce((s, o) => {
            if (!validateOperationPermissions(o, s)) {
              log(
                `rejecting operation "${getOperationTypeName(o.data.type)}"`,
                o
              );
              return s;
            }
            return operationReducer(s, o);
          }, state);

        default:
          return state;
      }
    },
    {
      channelsById: new Map(),
      memberAddressesByChannelId: new Map(),
      messagesById: new Map(),
      messageIdsByChannelId: new Map(),
      signersByUserAddress: new Map(),
    }
  );

  const mergeOperations = (operations_) => {
    // setOperationHistory((os) => [...os, ...operations]);
    const operations = sort(
      comparator({ value: (o) => o.data.timestamp }),
      operations_
    );
    dispatch({ type: "merge-batch", operations });
  };

  return [state, mergeOperations];
};

const Context = React.createContext();

export const Provider = ({ children }) => {
  const store = useOperationStoreInternal();
  return <Context.Provider value={store}>{children}</Context.Provider>;
};

export const useOperationStore = () => React.useContext(Context);
