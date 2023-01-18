import { utils as ethersUtils } from "ethers";
import React from "react";
import { css } from "@emotion/react";
import { useParams } from "react-router-dom";
import { useEnsName, useSignTypedData } from "wagmi";
import {
  array as arrayUtils,
  ethereum as ethereumUtils,
} from "@shades/common/utils";
import {
  useClientState,
  useSubmitters,
  useFetchers,
  useChannel,
  useChannelMembers,
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

const WakuChannel = () => {
  const { channelId } = useParams();

  const {
    connect: connectWallet,
    accountAddress: connectedWalletAddress,
    isConnecting: isConnectingWallet,
  } = useWallet();
  const { signTypedDataAsync: signTypedData } = useSignTypedData();
  const { peers, signerKeyPair } = useClientState();

  const [signersFetched, setSignersFetched] = React.useState(false);

  useChannelSubscription(channelId);

  const {
    submitChannelMessageAdd,
    submitChannelMessageRemove,
    submitChannelMemberAdd,
    submitSignerAdd,
    submitChannelBroadcast,
  } = useSubmitters();
  const { fetchChannel, fetchChannelMessages, fetchSigners } = useFetchers();

  const users = useUsers();
  const channel = useChannel(channelId);
  const memberAddresses = useChannelMembers(channelId);
  const messages = useChannelMessages(channelId);
  // TODO enforce upstream in "sdk"
  const messagesWithVerifiedSigners = messages.filter((m) => {
    const authorUser = users.find((u) => u.id === m.user);
    return authorUser != null && authorUser.signers.includes(m.signer);
  });

  const me = users.find((u) => u.address === connectedWalletAddress);
  const hasBroadcastedSigner = me?.signers.includes(signerKeyPair.publicKey);

  const isMember = memberAddresses.some((a) => a === connectedWalletAddress);
  const canPost = isMember && hasBroadcastedSigner;

  React.useEffect(() => {
    fetchSigners().then(() => {
      setSignersFetched(true);
    });
  }, [fetchSigners]);

  React.useEffect(() => {
    // Need to fetch channel first for now to ensure we have membership info when messages arrive
    fetchChannel(channelId).then(() => {
      fetchChannelMessages(channelId);
    });
  }, [channelId, fetchChannel, fetchChannelMessages]);

  React.useEffect(() => {
    submitChannelBroadcast({ channelIds: [channelId] });
  }, [channelId, submitChannelBroadcast]);

  return (
    <div
      css={css({
        flex: 1,
        display: "flex",
        flexDirection: "column",
        li: { listStyle: "none" },
      })}
    >
      <header style={{ padding: "1.6rem" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto minmax(0,1fr)",
            gridGap: "1.6rem",
            alignItems: "flex-start",
          }}
        >
          <div
            css={(t) =>
              css({
                fontWeight: t.text.weights.header,
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
              })
            }
          >
            {channel?.name ?? channelId}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              overflow: "hidden",
            }}
          >
            <ul
              css={(t) =>
                css({
                  color: t.colors.link,
                  fontSize: t.fontSizes.small,
                  flex: 1,
                  minWidth: 0,
                })
              }
            >
              {peers.map((p) => (
                <li
                  key={p.id}
                  style={{
                    textAlign: "right",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {p.name}
                </li>
              ))}
            </ul>

            {connectedWalletAddress == null ? (
              <Button
                size="small"
                onClick={connectWallet}
                disabled={isConnectingWallet}
                style={{ marginLeft: "1.6rem" }}
              >
                Connect wallet
              </Button>
            ) : signersFetched && !hasBroadcastedSigner ? (
              <Button
                size="small"
                type="button"
                onClick={() => {
                  submitSignerAdd({ signTypedData });
                }}
                style={{ marginLeft: "1.6rem" }}
              >
                Broadcast signer
              </Button>
            ) : null}
          </div>
        </div>

        <div
          css={(t) =>
            css({
              fontSize: t.fontSizes.small,
              color: t.colors.textMuted,
              fontWeight: "600",
              marginTop: "1rem",
            })
          }
        >
          Member list
        </div>
        <ul>
          {memberAddresses.map((a) => (
            <li key={a}>
              <UserDisplayName address={a} />
            </li>
          ))}
        </ul>
        {channel?.owner === connectedWalletAddress && (
          <Button
            onClick={() => {
              try {
                const maybeAddress = prompt("Member address");
                const address = ethersUtils.getAddress(maybeAddress);
                submitChannelMemberAdd(channelId, address);
              } catch (e) {
                alert("Invalid address");
              }
            }}
            style={{ marginTop: "1rem" }}
          >
            Add member
          </Button>
        )}
      </header>

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
          submitChannelMessageAdd(channelId, { content });
          e.target.message.value = "";
        }}
      >
        <Input
          name="message"
          placeholder={
            connectedWalletAddress == null
              ? "Connect wallet to message"
              : !isMember
              ? "Only members can post"
              : !hasBroadcastedSigner
              ? "Broadcast signer to message"
              : "..."
          }
          disabled={!canPost}
        />

        <Button type="submit" disabled={!canPost}>
          Send
        </Button>
      </form>

      <main style={{ padding: "1.6rem", flex: 1, overflow: "auto" }}>
        <ul>
          {sortMessages(messagesWithVerifiedSigners).map((m, i, ms) => {
            const compact = ms[i - 1]?.user === m.user;
            const isAuthor = m.user === connectedWalletAddress;
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
                <button
                  css={(t) => css({ color: t.colors.textNormal })}
                  onClick={() => {
                    if (!isAuthor) return;
                    if (!confirm("Remove message?")) return;
                    submitChannelMessageRemove(channelId, {
                      targetMessageId: m.id,
                    });
                  }}
                >
                  {m.body.content}
                </button>
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
