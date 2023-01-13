import {
  getPublicKey as getEdDSAPublicKey,
  utils as EdDSAUtils,
} from "@noble/ed25519";
import React from "react";
import { useParams } from "react-router-dom";
import { useAccount, useSignTypedData } from "wagmi";
import {
  array as arrayUtils,
  ethereum as ethereumUtils,
} from "@shades/common/utils";
import {
  createClient as createNSWakuClient,
  OperationTypes,
} from "@shades/common/waku";

const { sort, comparator } = arrayUtils;

// TODO: encrypted keystore
const signerEdDSAPrivateKey = EdDSAUtils.randomPrivateKey();

const sortMessages = (ms) => sort(comparator("timestamp"), ms);

const useOperationStore = () => {
  const signersByUserAddressReducer = (state, operation) => {
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

  const messagesByIdReducer = (state, operation) => {
    switch (operation.data.type) {
      case OperationTypes.MESSAGE_ADD: {
        const message = {
          id: operation.hash,
          signer: operation.signer,
          ...operation.data,
        };
        return new Map(state.set(message.id, message));
      }
      default:
        return state;
    }
  };

  const operationReducer = (state, operation) => ({
    ...state,
    messagesById: messagesByIdReducer(state.messagesById, operation),
    signersByUserAddress: signersByUserAddressReducer(
      state.signersByUserAddress,
      operation
    ),
  });

  const [state, dispatch] = React.useReducer(
    (state, operations) =>
      operations.reduce((s, o) => operationReducer(s, o), state),
    { messagesById: new Map(), signersByUserAddress: new Map() }
  );

  return [state, dispatch];
};

const WakuChannel = () => {
  const { channelId } = useParams();

  const clientRef = React.useRef();

  const { address: connectedWalletAddress } = useAccount();
  const { signTypedDataAsync: signTypedData } = useSignTypedData();

  const [signerPublicKey, setSignerPublicKey] = React.useState(null);
  const [isConnected, setConnected] = React.useState(false);
  const [{ messagesById, signersByUserAddress }, mergeOperations] =
    useOperationStore();

  const users = [...signersByUserAddress.entries()].map(
    ([address, signers]) => ({
      id: address,
      displayName: ethereumUtils.truncateAddress(address),
      signers: [...signers],
    })
  );

  const messagesFromVerifiedUsers = [...messagesById.values()].filter((m) => {
    const userSigners = signersByUserAddress.get(m.user);
    return userSigners != null && userSigners.has(m.signer);
  });

  const submitMessage = React.useCallback(
    (message) => clientRef.current.submitChannelMessage(channelId, message),
    [channelId]
  );

  React.useEffect(() => {
    if (connectedWalletAddress == null) return;

    createNSWakuClient({
      userEthereumAddress: connectedWalletAddress,
      signerEdDSAPrivateKey,
    }).then((client) => {
      clientRef.current = client;
      setConnected(true);
    });
  }, [connectedWalletAddress]);

  React.useEffect(() => {
    if (!isConnected) return;
    clientRef.current.fetchSigners().then(mergeOperations);
  }, [isConnected, mergeOperations]);

  React.useEffect(() => {
    if (!isConnected) return;
    clientRef.current.fetchChannelMessages(channelId).then(mergeOperations);
  }, [isConnected, channelId, mergeOperations]);

  React.useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = clientRef.current.subscribe(
      [channelId],
      (operation) => {
        switch (operation.data.type) {
          case OperationTypes.MESSAGE_ADD:
          case OperationTypes.SIGNER_ADD:
            mergeOperations([operation]);
            break;
          default:
            console.warn(`Unknown operation type "${operation.data.type}"`);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isConnected, channelId, mergeOperations]);

  React.useEffect(() => {
    getEdDSAPublicKey(signerEdDSAPrivateKey).then((signerPublicKey) => {
      setSignerPublicKey(`0x${EdDSAUtils.bytesToHex(signerPublicKey)}`);
    });
  }, []);

  if (signerPublicKey == null) return null;
  if (connectedWalletAddress == null) return "Connect wallet";
  if (!isConnected) return "Establishing network connection...";

  const userBroadcastedSigners = signersByUserAddress.get(
    connectedWalletAddress
  );
  const hasBroadcastedSigner = userBroadcastedSigners?.has(signerPublicKey);

  return (
    <ChannelView
      users={users}
      messages={messagesFromVerifiedUsers}
      submitMessage={submitMessage}
      hasBroadcastedSigner={hasBroadcastedSigner}
      broadcastSigner={() => {
        clientRef.current.submitSigner({ signerPublicKey, signTypedData });
      }}
    />
  );
};

const ChannelView = ({
  users,
  messages,
  submitMessage,
  hasBroadcastedSigner,
  broadcastSigner,
}) => {
  return (
    <div>
      <ul>
        {users.map((u) => {
          const signerCount = u.signers.length;
          return (
            <li key={u.id}>
              {u.displayName} ({signerCount}{" "}
              {signerCount === 1 ? "signer" : "signers"})
            </li>
          );
        })}
      </ul>

      <hr />

      <ul>
        {sortMessages(messages).map((m) => (
          <li key={m.id}>
            {ethereumUtils.truncateAddress(m.user)}: {m.body.content}
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const content = e.target.message.value;
          if (content.trim() === "") return;
          submitMessage({ content });
          e.target.message.value = "";
        }}
      >
        <input
          name="message"
          placeholder={
            hasBroadcastedSigner ? "..." : "Broadcast signer to message"
          }
          disabled={!hasBroadcastedSigner}
        />

        {hasBroadcastedSigner ? (
          <input type="submit" value="Send" />
        ) : (
          <button
            onClick={() => {
              broadcastSigner();
            }}
          >
            Broadcast signer
          </button>
        )}
      </form>
    </div>
  );
};

export default WakuChannel;
