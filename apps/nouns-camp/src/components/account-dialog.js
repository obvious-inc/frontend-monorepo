import React from "react";
import { getAddress as checksumEncodeAddress } from "viem";
import { css } from "@emotion/react";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import Dialog from "@shades/ui-web/dialog";
import Button from "@shades/ui-web/button";
import {
  Cross as CrossIcon,
  DotsHorizontal as DotsHorizontalIcon,
} from "@shades/ui-web/icons";
import {
  useAccount,
  useDelegate,
  useNoun,
  useSubgraphFetch,
} from "../store.js";
import { useNavigate } from "../hooks/navigation.js";
import { useCurrentDynamicQuorum } from "../hooks/dao-contract.js";
import { useWallet } from "../hooks/wallet.js";
import { useState as useSessionState } from "@/session-provider";
import { useDialog } from "../hooks/global-dialogs.js";
import useEnsName from "../hooks/ens-name.js";
import useAccountDisplayName from "../hooks/account-display-name.js";
import AccountAvatar from "./account-avatar.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import NounPreviewPopoverTrigger from "./noun-preview-popover-trigger.js";
import NounAvatar from "./noun-avatar.js";
import { buildEtherscanLink } from "../utils/etherscan.js";
import {
  useCurrentTick,
  useFastForwardStream,
} from "@/hooks/stream-escrow-contract.js";
import { useFetch } from "@shades/common/react";
import * as DropdownMenu from "@shades/ui-web/dropdown-menu";

const AccountDialog = ({ isOpen, close }) => (
  <Dialog
    isOpen={isOpen}
    onRequestClose={() => {
      close();
    }}
    width="44rem"
  >
    {(props) => <Content dismiss={close} {...props} />}
  </Dialog>
);

const Content = ({ titleProps, dismiss }) => {
  const navigate = useNavigate();

  const { address: connectedAccountAddress } = useWallet();
  const { address: loggedInAccountAddress } = useSessionState();
  const accountAddress = connectedAccountAddress ?? loggedInAccountAddress;

  const displayName = useAccountDisplayName(accountAddress);
  const ensName = useEnsName(accountAddress);
  const truncatedAddress = ethereumUtils.truncateAddress(
    checksumEncodeAddress(accountAddress),
  );

  const { open: openDelegationDialog } = useDialog("delegation");

  const account = useAccount(accountAddress);
  const delegate = useDelegate(accountAddress);
  const currentQuorum = useCurrentDynamicQuorum();

  const hasNouns = account?.nouns != null && account.nouns.length > 0;
  const nounsRepresented = delegate?.nounsRepresented ?? [];
  const nounsDelegatedToAccount = nounsRepresented.filter(
    (n) => n.ownerId.toLowerCase() !== accountAddress,
  );
  const voteCount = nounsRepresented.length;
  const votePowerQuorumPercentage =
    currentQuorum == null
      ? null
      : Math.round((voteCount / currentQuorum) * 1000) / 10;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <header
        css={(t) =>
          css({
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            borderBottom: "0.1rem solid",
            borderColor: t.colors.borderLighter,
            padding: "1.6rem",
            "@media (min-width: 600px)": {
              padding: "2rem",
            },
          })
        }
      >
        <h1
          {...titleProps}
          css={(t) =>
            css({
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: "1.6rem",
              fontSize: t.text.sizes.header,
              fontWeight: t.text.weights.header,
              color: t.colors.textHeader,
              lineHeight: 1.3,
            })
          }
        >
          <AccountAvatar
            address={accountAddress}
            size="3.2rem"
            css={css({ margin: "-0.2rem" })}
          />
          <a
            href={buildEtherscanLink(`/address/${accountAddress}`)}
            target="_blank"
            rel="noreferrer"
            css={css({
              color: "inherit",
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              maxHeight: "2.8rem",
              justifyContent: "center",
              "@media(hover: hover)": {
                ":hover [data-name]": { textDecoration: "underline" },
              },
            })}
          >
            <div data-name>{displayName}</div>
            {displayName !== truncatedAddress && (
              <div
                css={(t) =>
                  css({
                    fontSize: t.text.sizes.small,
                    fontWeight: "400",
                    color: t.colors.textDimmed,
                  })
                }
              >
                {truncatedAddress}
              </div>
            )}
          </a>
        </h1>
        <Button
          size="small"
          icon={
            <CrossIcon
              style={{ width: "1.5rem", height: "auto", margin: "auto" }}
            />
          }
          onClick={dismiss}
        />
      </header>
      <main
        css={css({
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: "1.6rem",
          "@media (min-width: 600px)": {
            padding: "2rem",
          },
        })}
      >
        <dl
          css={(t) =>
            css({
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) auto",
              gap: "1rem 1.6rem",
              dt: { fontWeight: t.text.weights.emphasis },
              dd: { textAlign: "right" },
              "dd[data-block]": {
                textAlign: "left",
                gridColumn: "span 2",
                paddingLeft: "1rem",
                paddingBottom: "1.6rem",
              },
            })
          }
        >
          <dt style={{ padding: "0 0 1.6rem" }}>Voting power</dt>
          <dd>
            {voteCount} {voteCount === 1 ? "vote" : "votes"}
            {voteCount !== 0 && (
              <>
                {votePowerQuorumPercentage == null ? (
                  <div style={{ paddingTop: "0.3rem" }}>
                    <div
                      css={(t) =>
                        css({
                          height: "1.8rem",
                          width: "11rem",
                          background: t.colors.backgroundModifierHover,
                          borderRadius: "0.3rem",
                        })
                      }
                    />
                  </div>
                ) : (
                  <div>{votePowerQuorumPercentage}% of quorum</div>
                )}
              </>
            )}
          </dd>
          {hasNouns && (
            <>
              <dt>Your nouns</dt>
              <dd data-block>
                <NounList
                  contextAccount={accountAddress}
                  items={account.nouns}
                />
              </dd>
            </>
          )}
          {nounsDelegatedToAccount.length > 0 && (
            <>
              <dt>Nouns delegated to you</dt>
              <dd data-block>
                <NounList
                  contextAccount={accountAddress}
                  items={nounsDelegatedToAccount}
                />
              </dd>
            </>
          )}
        </dl>
      </main>

      <footer
        css={css({
          display: "flex",
          justifyContent: "flex-end",
          gap: "1rem",
          padding: "0 1.6rem 1.6rem",
          "@media (min-width: 600px)": {
            padding: "0 2rem 2rem",
          },
        })}
      >
        {hasNouns && (
          <Button
            onClick={() => {
              dismiss();
              openDelegationDialog();
            }}
          >
            Manage delegation
          </Button>
        )}
        <Button
          onClick={() => {
            dismiss();
            navigate(`/voters/${ensName ?? accountAddress}`);
          }}
        >
          Account page
        </Button>
      </footer>
    </div>
  );
};

const NounListItem = ({ noun, contextAccount }) => {
  const isOwned =
    contextAccount != null &&
    noun.ownerId.toLowerCase() === contextAccount.toLowerCase();
  const isDelegated =
    noun.delegateId.toLowerCase() !== noun.ownerId.toLowerCase();

  const { open: openStreamCancelDialog } = useDialog("stream-cancel");

  const [isForwardingNoun, setForwardingNoun] = React.useState(false);

  const n = useNoun(noun.id);
  const stream = n?.stream;
  const currentTick = useCurrentTick();
  const ticksLeft = stream?.lastTick - currentTick;

  const isStreamActive = !stream?.canceled && ticksLeft > 0;

  const fastForwardStream = useFastForwardStream(noun.id, ticksLeft);

  const handleFastForward = async () => {
    try {
      setForwardingNoun(true);
      await fastForwardStream();
    } catch (error) {
      console.error(error);
    } finally {
      setForwardingNoun(false);
    }
  };

  const handleDropDownAction = async (key) => {
    switch (key) {
      case "cancel-stream":
        openStreamCancelDialog({ nounId: noun.id });
        break;

      case "fast-forward-stream":
        handleFastForward();
        break;
    }
  };

  const subgraphFetch = useSubgraphFetch();

  useFetch(
    ({ signal }) => {
      const fetchStreams = async () => {
        const { streams } = await subgraphFetch({
          query: `{
            streams(
              where: {noun: "${noun.id}"}
            ) {
              id
              createdBlock
              createdTimestamp
              ethPerTick
              streamLengthInTicks
              lastTick
              totalAmount
              canceled
              noun {
                id
                owner { id }
              }
            }
          }`,
        });
        if (signal?.aborted) return null;
        if (streams.length == 0) return null;
        return streams;
      };

      return fetchStreams();
    },
    [subgraphFetch],
  );

  return (
    <li key={noun.id}>
      <NounAvatar id={noun.id} size="2.4rem" />
      <div data-content>
        <NounPreviewPopoverTrigger
          nounId={noun.id}
          contextAccount={contextAccount}
        >
          <button
            css={(t) =>
              css({
                outline: "none",
                fontWeight: t.text.weights.emphasis,
                "@media(hover: hover)": {
                  cursor: "pointer",
                  ":hover": { textDecoration: "underline" },
                },
              })
            }
          >
            Noun {noun.id}
          </button>
        </NounPreviewPopoverTrigger>
        {isDelegated && (
          <>
            {" "}
            delegated {isOwned ? "to" : "from"}{" "}
            <AccountPreviewPopoverTrigger
              accountAddress={isOwned ? noun.delegateId : noun.ownerId}
            />
          </>
        )}
      </div>
      {stream && isStreamActive && (
        <div css={css({ justifySelf: "end" })}>
          <DropdownMenu.Root placement="bottom end" offset={18} crossOffset={5}>
            <DropdownMenu.Trigger asChild>
              <Button
                variant="transparent"
                size="small"
                icon={
                  <DotsHorizontalIcon
                    style={{ width: "1.8rem", height: "auto" }}
                  />
                }
                style={{ pointerEvents: "all" }}
              />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              css={css({
                width: "min-content",
                minWidth: "min-content",
                maxWidth: "calc(100vw - 2rem)",
              })}
              items={[
                {
                  id: "main",
                  children: [
                    { id: "cancel-stream", label: "Quit" },
                    {
                      id: "fast-forward-stream",
                      label: "Fast-forward",
                    },
                  ].filter(Boolean),
                },
              ]}
              onAction={handleDropDownAction}
            >
              {(item) => (
                <DropdownMenu.Section items={item.children}>
                  {(item) => (
                    <DropdownMenu.Item>{item.label}</DropdownMenu.Item>
                  )}
                </DropdownMenu.Section>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      )}
    </li>
  );
};

export const NounList = ({ contextAccount, items }) => {
  return (
    <ul
      css={(t) =>
        css({
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: "0.8rem",
          li: {
            display: "grid",
            gridTemplateColumns: "repeat(2, auto) minmax(0, 1fr)",
            alignItems: "center",
            gap: "0.8rem",
            em: { fontStyle: "normal", fontWeight: t.text.weights.emphasis },
            "[data-content]": { padding: "0.2rem 0" },
          },
        })
      }
    >
      {items.map((n) => (
        <NounListItem key={n.id} noun={n} contextAccount={contextAccount} />
      ))}
    </ul>
  );
};

export default AccountDialog;
