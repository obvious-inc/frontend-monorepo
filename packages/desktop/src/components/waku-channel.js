import { utils as EdDSAUtils } from "@noble/ed25519";
import { bytesToHex } from "@waku/byte-utils";
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
  Provider as ClientProvider,
  useClientState,
  useSubmitters,
  useFetchers,
  useChannelMessages,
  useChannelSubscription,
  useUsers,
} from "@shades/common/waku";
import useWallet from "../hooks/wallet";
import Button from "./button";
import Input from "./input";

const { sort, comparator } = arrayUtils;

const sortMessages = (ms) =>
  sort(comparator({ value: "timestamp", order: "desc" }), ms);

const useSignerPrivateKey = (custodyAddress) => {
  const [signerPrivateKey, setSignerPrivateKey] = React.useState(null);

  React.useEffect(() => {
    if (custodyAddress == null) return;

    const storeKey = `ns:keystore:${custodyAddress.toLowerCase()}`;

    const runCreateSignerFlow = () => {
      const privateKey = `0x${bytesToHex(EdDSAUtils.randomPrivateKey())}`;

      setSignerPrivateKey(privateKey);

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
        setSignerPrivateKey(privateKey);
      },
      () => {
        location.reload();
      }
    );
  }, [custodyAddress]);

  return signerPrivateKey;
};

const WakuChannel = () => {
  const { accountAddress } = useWallet();
  const signerPrivateKey = useSignerPrivateKey(accountAddress);

  return (
    <ClientProvider
      account={accountAddress}
      signerEdDSAPrivateKey={signerPrivateKey}
    >
      <ChannelView />
    </ClientProvider>
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

const ChannelView = () => {
  const { channelId } = useParams();

  const {
    connect: connectWallet,
    accountAddress: connectedWalletAddress,
    isConnecting: isConnectingWallet,
  } = useWallet();
  const { signTypedDataAsync: signTypedData } = useSignTypedData();
  const {
    didInitialize: didInitializeClient,
    peers,
    signerKeyPair,
  } = useClientState();

  useChannelSubscription(channelId);

  const [signersFetched, setSignersFetched] = React.useState(false);
  const { submitChannelMessage, submitSigner } = useSubmitters();
  const { fetchChannelMessages, fetchSigners } = useFetchers();
  const messages = useChannelMessages(channelId);
  const users = useUsers();

  const me = users.find((u) => u.address === connectedWalletAddress);

  const hasBroadcastedSigner =
    signerKeyPair?.publicKey != null &&
    me?.signers.includes(signerKeyPair.publicKey);

  const messagesFromVerifiedUsers = messages.filter((m) => {
    const user = users.find((u) => u.id === m.user);
    return user != null && user.signers.includes(m.signer);
  });

  React.useEffect(() => {
    if (!didInitializeClient) return;
    fetchSigners().then(() => {
      setSignersFetched(true);
    });
  }, [didInitializeClient, fetchSigners]);

  React.useEffect(() => {
    if (!didInitializeClient) return;
    fetchChannelMessages(channelId);
  }, [didInitializeClient, channelId, fetchChannelMessages]);

  if (!didInitializeClient) return <C>Establishing network connection...</C>;

  return (
    <div
      css={css({
        flex: 1,
        display: "flex",
        flexDirection: "column",
        li: { listStyle: "none" },
      })}
    >
      {peers.length !== 0 && (
        <ul
          css={(t) =>
            css({
              padding: "1.6rem",
              paddingBottom: 0,
              color: t.colors.link,
              fontSize: t.fontSizes.small,
            })
          }
        >
          {peers.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
      )}

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
          submitChannelMessage(channelId, { content });
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

        {connectedWalletAddress == null ? (
          <Button onClick={connectWallet} disabled={isConnectingWallet}>
            Connect wallet
          </Button>
        ) : !hasBroadcastedSigner ? (
          <Button
            type="button"
            onClick={() => {
              submitSigner({ signTypedData });
            }}
            disabled={!signersFetched}
          >
            Broadcast signer
          </Button>
        ) : (
          <Button type="submit">Send</Button>
        )}
      </form>

      <main style={{ padding: "1.6rem", flex: 1, overflow: "auto" }}>
        <ul>
          {sortMessages(messagesFromVerifiedUsers).map((m, i, ms) => {
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
