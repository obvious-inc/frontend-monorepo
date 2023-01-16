import {
  getPublicKey as getEdDSAPublicKey,
  utils as EdDSAUtils,
} from "@noble/ed25519";
import { hexToBytes, bytesToHex } from "@waku/byte-utils";
import { encrypt, decrypt } from "@metamask/browser-passworder";
import React from "react";
import { css } from "@emotion/react";
import { useParams } from "react-router-dom";
import { useEnsName, useSignTypedData } from "wagmi";
import {
  array as arrayUtils,
  ethereum as ethereumUtils,
} from "@shades/common/utils";
import {
  createClient as createNSWakuClient,
  OperationTypes,
} from "@shades/common/waku";
import useWallet from "../hooks/wallet";
import Button from "./button";
import Input from "./input";

const { sort, comparator } = arrayUtils;

const sortMessages = (ms) =>
  sort(comparator({ value: "timestamp", order: "desc" }), ms);

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

  const {
    connect: connectWallet,
    accountAddress: connectedWalletAddress,
    isConnecting: isConnectingWallet,
  } = useWallet();
  const { signTypedDataAsync: signTypedData } = useSignTypedData();

  const [signerKeyPair, setSignerKeyPair] = React.useState(null);
  const [isConnected, setConnected] = React.useState(false);
  const [{ messagesById, signersByUserAddress }, mergeOperations] =
    useOperationStore();

  const users = [...signersByUserAddress.entries()].map(
    ([address, signers]) => ({
      id: address,
      address,
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
    if (signerKeyPair == null) return;

    createNSWakuClient({
      userEthereumAddress: connectedWalletAddress,
      signerEdDSAPrivateKey: hexToBytes(signerKeyPair.privateKey),
    }).then((client) => {
      clientRef.current = client;
      setConnected(true);
    });
  }, [connectedWalletAddress, signerKeyPair]);

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
    if (connectedWalletAddress == null) return;

    const storeKey = `ns:keystore:${connectedWalletAddress.toLowerCase()}`;

    const getPublicKey = (privateKey) =>
      getEdDSAPublicKey(hexToBytes(privateKey)).then(
        (signerPublicKey) => `0x${bytesToHex(signerPublicKey)}`
      );

    const runCreateSignerFlow = () => {
      const privateKey = `0x${bytesToHex(EdDSAUtils.randomPrivateKey())}`;

      getPublicKey(privateKey).then((publicKey) => {
        setSignerKeyPair({ privateKey, publicKey });
      });

      const password = prompt(
        "Signer key created. Password protect your key, or leave empty to use a throwaway key."
      );

      if ((password?.trim() || "") === "") return;

      encrypt(password, { signer: privateKey }).then((blob) => {
        localStorage.setItem(storeKey, blob);
      });
    };

    const storedBlob = localStorage.getItem(storeKey);

    if (storedBlob == null) {
      runCreateSignerFlow();
      return;
    }

    const password = prompt(
      "Unlock stored signer key, or leave emply to create a new one."
    );
    const gavePassword = (password?.trim() || "") !== "";

    if (!gavePassword) {
      runCreateSignerFlow();
      return;
    }

    decrypt(password, storedBlob).then(
      ({ signer: privateKey }) => {
        getPublicKey(privateKey).then((publicKey) => {
          setSignerKeyPair({ publicKey, privateKey });
        });
      },
      () => {
        location.reload();
      }
    );
  }, [connectedWalletAddress]);

  const signerPublicKey = signerKeyPair?.publicKey;

  if (connectedWalletAddress == null)
    return (
      <C>
        <Button onClick={connectWallet} disabled={isConnectingWallet}>
          Connect wallet
        </Button>
      </C>
    );
  if (!isConnected) return <C>Establishing network connection...</C>;
  if (signerPublicKey == null) return null;

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

const C = (props) => (
  <div
    style={{
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
    {...props}
  />
);

const ChannelView = ({
  users,
  messages,
  submitMessage,
  hasBroadcastedSigner,
  broadcastSigner,
}) => {
  return (
    <div
      css={css({
        flex: 1,
        display: "flex",
        flexDirection: "column",
        li: { listStyle: "none" },
      })}
    >
      {users.length === 0 ? (
        <div style={{ height: "1.6rem" }} />
      ) : (
        <header style={{ padding: "1.6rem" }}>
          <div
            css={(t) =>
              css({
                fontSize: t.fontSizes.small,
                color: t.colors.textMuted,
                fontWeight: "600",
              })
            }
          >
            Member list
          </div>
          <ul>
            {users.map((u) => (
              <li key={u.id}>
                <UserDisplayName address={u.address} />
              </li>
            ))}
          </ul>
        </header>
      )}
      <form
        style={{
          padding: "0 1.6rem",
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto",
          gridGap: "1rem",
        }}
        onSubmit={(e) => {
          e.preventDefault();
          e.target.message.focus();
          const content = e.target.message.value;
          if (content.trim() === "") return;
          submitMessage({ content });
          e.target.message.value = "";
        }}
      >
        <Input
          name="message"
          placeholder={
            hasBroadcastedSigner ? "..." : "Broadcast signer to message"
          }
          disabled={!hasBroadcastedSigner}
        />

        {hasBroadcastedSigner ? (
          <Button type="submit">Send</Button>
        ) : (
          <Button
            type="button"
            onClick={() => {
              broadcastSigner();
            }}
          >
            Broadcast signer
          </Button>
        )}
      </form>
      <main style={{ padding: "1.6rem", flex: 1, overflow: "auto" }}>
        <ul>
          {sortMessages(messages).map((m, i, ms) => {
            const compact = ms[i - 1]?.user === m.user;
            return (
              <li
                key={m.id}
                style={{ margin: i === 0 || compact ? 0 : "0.5rem 0 0" }}
              >
                {!compact && (
                  <div
                    css={(t) =>
                      css({
                        fontSize: t.fontSizes.small,
                        color: t.colors.textDimmed,
                      })
                    }
                  >
                    <UserDisplayName address={m.user} />
                  </div>
                )}
                <div
                  css={(t) =>
                    css({ color: t.colors.textNormal, userSelect: "text" })
                  }
                >
                  {m.body.content}
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
};

const UserDisplayName = ({ address }) => {
  const { data: name } = useEnsName({ address });
  return name ?? ethereumUtils.truncateAddress(address);
};

export default WakuChannel;
