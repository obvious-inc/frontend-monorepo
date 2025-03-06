import React from "react";
import NextLink from "next/link";
import { css } from "@emotion/react";
import {
  AutoAdjustingHeightTextarea,
  useMatchMedia,
} from "@shades/common/react";
import { Cross as CrossIcon } from "@shades/ui-web/icons";
import Button from "@shades/ui-web/button";
import Select from "@shades/ui-web/select";
import Avatar from "@shades/ui-web/avatar";
import { CHAIN_ID } from "@/constants/env";
import { getChain } from "@/utils/chains";
import { pickDisplayName as pickFarcasterAccountDisplayName } from "@/utils/farcaster";
import { REPOST_REGEX } from "@/utils/votes-and-feedbacks";
import { useProposal, useDelegate } from "@/store";
import { useConnectedFarcasterAccounts } from "@/hooks/farcaster";
import { usePriorVotes } from "@/hooks/token-contract";
import { useWallet } from "@/hooks/wallet";
import { useDialog } from "@/hooks/global-dialogs";
import NativeSelect from "@/components/native-select";
import AccountPreviewPopoverTrigger from "@/components/account-preview-popover-trigger";

const getByteLength = (string) =>
  new TextEncoder("utf-8").encode(string).length;

const MarkdownRichText = React.lazy(
  () => import("@/components/markdown-rich-text"),
);

const ProposalActionForm = ({
  proposalId,
  size = "default",
  variant,
  mode,
  setMode,
  availableModes,
  reason,
  setReason,
  support,
  setSupport,
  setReply,
  onSubmit,
  onCancel,
  repliesByTargetFeedItemId,
  replyTargetFeedItems,
  repostTargetFeedItems,
  cancelReply,
  cancelRepost,
  inputRef,
  messagePlaceholder,
  helpText: customHelpText,
}) => {
  const isSmallDevice = useMatchMedia("(max-width: 600px)");

  const [isPending, setPending] = React.useState(false);
  // const [error, setError] = React.useState(null);

  const {
    address: connectedWalletAccountAddress,
    chainId: connectedChainId,
    requestAccess: requestWalletAccess,
    switchToTargetChain: requestWalletNetworkSwitchToTargetChain,
    isLoading: hasPendingWalletAction,
    isAuthenticated,
  } = useWallet();

  const chain = getChain(CHAIN_ID);

  const isConnectedToTargetChainId = connectedChainId === CHAIN_ID;

  const [
    selectedFarcasterAccountFidByWalletAccountAddress,
    setSelectedFarcasterAccount,
  ] = React.useState({});
  const farcasterAccounts = useConnectedFarcasterAccounts({
    enabled: mode === "farcaster-comment",
  });

  const selectedFarcasterAccountFid = (() => {
    if (connectedWalletAccountAddress == null) return null;

    const selectedFid =
      selectedFarcasterAccountFidByWalletAccountAddress[
        connectedWalletAccountAddress.toLowerCase()
      ];

    if (selectedFid != null) return selectedFid;

    return farcasterAccounts?.[0]?.fid;
  })();

  const { open: openFarcasterSetupDialog } = useDialog("farcaster-setup");
  const { open: openAuthenticationDialog } = useDialog(
    "account-authentication",
  );
  const connectedDelegate = useDelegate(connectedWalletAccountAddress);

  const proposal = useProposal(proposalId);

  const proposalVoteCount = usePriorVotes({
    account: connectedWalletAccountAddress,
    blockNumber: proposal?.startBlock,
    enabled: mode === "vote",
  });
  const currentVoteCount = connectedDelegate?.nounsRepresented.length ?? 0;

  const hasReplyTarget = replyTargetFeedItems?.length > 0;
  const hasRepostTarget = repostTargetFeedItems?.length > 0;

  const hasRequiredInputs = (() => {
    switch (mode) {
      case "farcaster-comment":
        return (
          reason.trim().length > 0 && getByteLength(reason) <= 320 // Farcaster text limit is set in bytes
        );
      default: {
        if (hasReplyTarget) {
          const hasMissingReply = replyTargetFeedItems.some(
            (item) =>
              repliesByTargetFeedItemId[item.id] == null ||
              repliesByTargetFeedItemId[item.id].trim() === "",
          );
          return !hasMissingReply && support != null;
        }
        if (setSupport == null) return reason.trim().length > 0;
        return support != null;
      }
    }
  })();

  if (mode == null) throw new Error();

  const renderHelpText = () => {
    if (!isConnectedToTargetChainId)
      return `Switch to ${CHAIN_ID === 1 ? "Ethereum Mainnet" : chain.name} to ${
        mode === "vote" ? "vote" : "comment"
      }.`;

    if (mode === "farcaster-comment") {
      const selectedAccount = farcasterAccounts?.find(
        (a) => String(a.fid) === String(selectedFarcasterAccountFid),
      );

      if (
        farcasterAccounts?.length === 0 ||
        (selectedAccount != null && !selectedAccount.hasAccountKey)
      )
        return (
          <>
            <p>
              To cast from Camp you need to verify your address (
              {connectedWalletAccountAddress.slice(0, 6)}...
              {connectedWalletAccountAddress.slice(-4)}) with the Farcaster
              account you wish to use.
            </p>
          </>
        );

      if (getByteLength(reason) > 320) {
        const length = getByteLength(reason);
        return <>Casts are limited to 320 bytes (currently at {length})</>;
      }

      if (selectedAccount != null && selectedAccount.nounerAddress == null) {
        return (
          <>
            Camp defaults to only show casts from accounts that have had onchain
            interactions with Nouns. Users that hasn’t opted out of this filter
            will not see this cast.
          </>
        );
      }
    }

    if (mode === "vote") {
      if (currentVoteCount > 0 && proposalVoteCount === 0)
        return (
          <>
            <p>
              Although you currently control <em>{currentVoteCount}</em>{" "}
              {currentVoteCount === 1 ? "vote" : "votes"}, your voting power on
              this proposal is <em>0</em>, which represents your voting power at
              this proposal’s vote snapshot block.
            </p>
            <p>
              You may still vote with <em>0</em> votes, but gas spent will not
              be refunded.
            </p>
          </>
        );

      if (proposalVoteCount === 0)
        return "You can vote with zero voting power, but gas spent will not be refunded.";

      return "Gas spent on voting will be refunded.";
    }

    return customHelpText;
  };

  const helpText = renderHelpText();

  const showModePicker = availableModes != null && availableModes.length > 1;

  const disableForm =
    isPending ||
    connectedWalletAccountAddress == null ||
    !isConnectedToTargetChainId;

  const helpTextElement =
    helpText == null ? null : <div className="hint-container">{helpText}</div>;

  return (
    <div
      data-size={size ?? undefined}
      data-variant={variant ?? undefined}
      css={(t) =>
        css({
          containerType: "inline-size",
          ".box-container": {
            display: "flex",
            flexDirection: "column",
            gap: "1.2rem",
          },
          form: {
            borderRadius: "0.5rem",
            background: t.colors.backgroundModifierNormal,
            padding: "1rem",
            "&:has(textarea:focus-visible)": { boxShadow: t.shadows.focus },
            ".text-input": {
              background: "transparent",
              fontSize: t.text.sizes.base,
              display: "block",
              color: t.colors.textNormal,
              fontWeight: "400",
              width: "100%",
              maxWidth: "100%",
              outline: "none",
              border: 0,
              padding: "0.3rem 0.2rem",
              "::placeholder": { color: t.colors.inputPlaceholder },
              "&:disabled": {
                color: t.colors.textMuted,
                cursor: "not-allowed",
              },
              // Prevents iOS zooming in on input fields
              "@supports (-webkit-touch-callout: none)": {
                fontSize: "1.6rem",
              },
            },
          },
          ".message-input-label": {
            lineHeight: 1.2,
            fontSize: t.text.sizes.small,
            color: t.colors.textDimmed,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            em: {
              fontStyle: "normal",
              fontWeight: t.text.weights.emphasis,
            },
          },
          ".hint-container": {
            marginTop: "1.2rem",
            fontSize: t.text.sizes.tiny,
            color: t.colors.textDimmed,
            "p + p": { marginTop: "1em" },
            em: {
              fontStyle: "normal",
              fontWeight: t.text.weights.emphasis,
            },
          },

          '&[data-size="small"]': {
            form: {
              padding: "0.8rem",
            },
          },

          '&[data-size="large"]': {
            ".message-input-label": {
              ".account-preview-trigger": {
                color: t.colors.textNormal,
              },
              "@media(min-width: 600px)": {
                fontSize: t.text.sizes.base,
              },
            },
          },

          '&[data-variant="bare"], &[data-variant="boxed"]': {
            form: {
              padding: 0,
              background: "none",
              "&:has(textarea:focus-visible)": { boxShadow: "none" },
              ".text-input": {
                background: t.colors.backgroundModifierNormal,
                padding: "0.3rem 0.7rem",
                borderRadius: "0.5rem",
                "&:focus-visible": { boxShadow: t.shadows.focus },
              },
            },
          },
          '&[data-variant="boxed"]': {
            ".box-container": {
              border: "0.1rem solid",
              borderColor: t.colors.borderLight,
              borderRadius: "0.6rem",
              padding: "1.6rem",
            },
          },
        })
      }
    >
      <div className="box-container">
        <div
          css={css({
            display: "flex",
            gap: "0.6rem",
            justifyContent: "space-between",
            alignItems: "flex-end",
            "@container(max-width: 360px)": {
              ".wide-only": { display: "none" },
            },
          })}
        >
          <label className="message-input-label" htmlFor="message-input">
            {connectedWalletAccountAddress == null ? null : (
              <>
                {mode === "farcaster-comment" ? (
                  (() => {
                    if (
                      farcasterAccounts == null ||
                      farcasterAccounts.length === 0
                    )
                      return <>Comment as ...</>;

                    if (farcasterAccounts.length === 1) {
                      const selectedAccount = farcasterAccounts.find(
                        (a) =>
                          String(a.fid) === String(selectedFarcasterAccountFid),
                      );

                      const { username, pfpUrl } = selectedAccount;
                      const displayName =
                        pickFarcasterAccountDisplayName(selectedAccount);

                      return (
                        <>
                          <span className="wide-only">Comment as </span>
                          {pfpUrl != null && (
                            <Avatar
                              url={pfpUrl}
                              size="1.2em"
                              css={css({
                                display: "inline-block",
                                marginRight: "0.3em",
                                verticalAlign: "sub",
                              })}
                            />
                          )}
                          <em>{displayName}</em>
                          <span className="wide-only">
                            {username !== displayName && <> (@{username})</>}
                          </span>
                        </>
                      );
                    }

                    return (
                      <>
                        <span className="wide-only">Comment as </span>
                        <NativeSelect
                          value={String(selectedFarcasterAccountFid)}
                          options={farcasterAccounts.map((a, i, as) => {
                            const { displayName, username } = a;

                            let label =
                              displayName ?? username ?? `FID ${a.fid}`;

                            if (username != null && username !== displayName)
                              label += ` (@${username})`;

                            const hasDuplicateDisplayName = as.some(
                              (a, y) =>
                                i !== y && a.displayName === displayName,
                            );

                            if (hasDuplicateDisplayName)
                              label += ` (FID ${a.fid})`;

                            return { value: String(a.fid), label };
                          })}
                          onChange={(e) => {
                            setSelectedFarcasterAccount((s) => ({
                              ...s,
                              [connectedWalletAccountAddress.toLowerCase()]:
                                e.target.value,
                            }));
                          }}
                          renderSelectedOption={(o) => {
                            const account = farcasterAccounts.find(
                              (a) => String(a.fid) === o.value,
                            );
                            const { displayName, username, pfpUrl } = account;
                            return (
                              <>
                                {pfpUrl != null && (
                                  <Avatar
                                    url={pfpUrl}
                                    size="1.2em"
                                    css={css({
                                      display: "inline-block",
                                      marginRight: "0.3em",
                                      verticalAlign: "sub",
                                    })}
                                  />
                                )}
                                <em>
                                  {displayName ??
                                    username ??
                                    `FID ${account.fid}`}
                                </em>
                                <span className="wide-only">
                                  {username != null &&
                                    username !== displayName && (
                                      <> (@{username})</>
                                    )}
                                </span>
                              </>
                            );
                          }}
                        />
                      </>
                    );
                  })()
                ) : (
                  <>
                    <span className="wide-only">
                      {mode === "vote" ? "Cast vote as" : "Comment as"}{" "}
                    </span>
                    <AccountPreviewPopoverTrigger
                      showAvatar
                      accountAddress={connectedWalletAccountAddress}
                    />
                  </>
                )}
              </>
            )}
          </label>
          {showModePicker && (
            <div>
              <Select
                aria-label="Pick action type"
                value={mode}
                onChange={(m) => {
                  setMode(m);
                  if (setSupport != null) {
                    // Default to "abstain" for comments, and reset for votes
                    setSupport(m === "onchain-comment" ? 2 : null);
                  }
                }}
                options={availableModes.map((m) => ({
                  value: m,
                  label: {
                    vote: "Cast vote",
                    "onchain-comment": "Comment onchain",
                    "farcaster-comment": "Comment with Farcaster",
                  }[m],
                }))}
                renderTriggerContent={(value) => {
                  switch (value) {
                    case "vote":
                      return "Cast vote";
                    case "onchain-comment":
                      return "Onchain comment";
                    case "farcaster-comment":
                      return "Farcaster comment";
                    default:
                      throw new Error();
                  }
                }}
                // size="tiny"
                // variant="opaque"
                size={
                  size === "large" ? (isSmallDevice ? "tiny" : "small") : "tiny"
                }
                variant={size === "large" ? "default" : "opaque"}
                width="max-content"
                align="right"
              />
            </div>
          )}
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            // setError(null);
            try {
              await onSubmit({ fid: selectedFarcasterAccountFid });
              // } catch (e) {
              //   setError(e);
              //   throw e;
            } finally {
              setPending(false);
            }
          }}
          css={css({ ".reply-list + *": { marginTop: "1.2rem" } })}
        >
          {hasReplyTarget && (
            <ul
              className="reply-list"
              css={(t) =>
                css({
                  margin: "0",
                  "& > li": {
                    listStyle: "none",
                    ".text-input": {
                      margin: "0.4rem 0 0",
                      padding: "0.3rem 0",
                    },
                  },
                  "li + li": { marginTop: "1.6rem" },
                  ".reply-area": {
                    display: "grid",
                    gridTemplateColumns: "auto minmax(0,1fr)",
                    gap: "0.3rem",
                  },
                  ".reply-line-container": {
                    width: "2.2rem",
                    position: "relative",
                  },
                  ".reply-line": {
                    position: "absolute",
                    top: 0,
                    right: "0.2rem",
                    width: "0.6rem",
                    height: "1.9rem",
                    borderLeft: "0.1rem solid",
                    borderBottom: "0.1rem solid",
                    borderColor: t.colors.borderLight,
                    borderBottomLeftRadius: "0.3rem",
                  },
                })
              }
            >
              {replyTargetFeedItems.map((item) => (
                <li key={item.id}>
                  <QuotedFeedItem
                    item={item}
                    onCancel={() => cancelReply(item.id)}
                  />
                  <div className="reply-area">
                    <div className="reply-line-container">
                      <div className="reply-line" />
                    </div>
                    <AutoAdjustingHeightTextarea
                      className="text-input"
                      rows={1}
                      placeholder="Your reply..."
                      value={repliesByTargetFeedItemId[item.id]}
                      onChange={(e) => {
                        setReply(item.id, e.target.value);
                      }}
                      disabled={disableForm}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {hasRepostTarget && (
            <>
              <h3
                css={(t) =>
                  css({
                    fontSize: t.text.sizes.small,
                    fontWeight: t.text.weights.normal,
                    color: t.colors.textDimmed,
                    margin: "0 0 0.8rem",
                    padding: "0 0.2rem",
                  })
                }
              >
                {(() => {
                  const hasRevote = repostTargetFeedItems.some(
                    (i) => i.type === "vote",
                  );
                  const hasMany = repostTargetFeedItems.length > 1;
                  if (mode === "vote" && hasRevote)
                    return hasMany ? "Revotes" : "Revote";
                  return hasMany ? "Reposts" : "Repost";
                })()}
              </h3>
              <ul
                css={css({
                  margin: "0.8rem 0",
                  "& > li": { listStyle: "none" },
                  "li + li": { marginTop: "0.6rem" },
                })}
              >
                {repostTargetFeedItems.map((item) => (
                  <QuotedFeedItem
                    key={item.id}
                    component="li"
                    item={item}
                    onCancel={() => cancelRepost(item.id)}
                  />
                ))}
              </ul>
            </>
          )}
          <AutoAdjustingHeightTextarea
            ref={inputRef}
            id="message-input"
            className="text-input"
            rows={size === "large" ? 3 : 1}
            placeholder={
              messagePlaceholder ??
              (hasRepostTarget
                ? "Optional comment..."
                : hasReplyTarget
                  ? "Optional additional comment..."
                  : "...")
            }
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
            }}
            disabled={disableForm}
          />
          {/* {error != null && (
            <div
              css={(t) =>
                css({
                  padding: "0.3rem",
                  color: t.colors.textDanger,
                  whiteSpace: "pre-wrap",
                  overflow: "auto",
                })
              }
            >
              Error: {error.message}
            </div>
          )} */}
          {variant === "boxed" && helpTextElement}
          <div
            css={css({
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "1.2rem",
            })}
          >
            <div
              css={css({
                display: "grid",
                gridAutoFlow: "column",
                gridGap: "1rem",
              })}
            >
              {onCancel != null && (
                <Button type="button" onClick={onCancel} size={size}>
                  Cancel
                </Button>
              )}

              {(() => {
                // Button size
                const buttonSize =
                  size === "large"
                    ? isSmallDevice
                      ? "small"
                      : "default"
                    : size;

                switch (mode) {
                  case "vote":
                  case "onchain-comment":
                    if (connectedWalletAccountAddress == null)
                      return (
                        <Button
                          type="button"
                          onClick={() => {
                            requestWalletAccess();
                          }}
                          size={buttonSize}
                        >
                          Connect wallet to{" "}
                          {mode === "vote" ? "vote" : "comment"}
                        </Button>
                      );

                    return (
                      <>
                        {setSupport != null && (
                          <SupportSelect
                            mode={mode}
                            size={buttonSize}
                            value={support}
                            onChange={(value) => {
                              setSupport(value);
                            }}
                            disabled={disableForm}
                          />
                        )}

                        {!isConnectedToTargetChainId ? (
                          <Button
                            type="button"
                            variant="primary"
                            disabled={hasPendingWalletAction}
                            isLoading={hasPendingWalletAction}
                            size={buttonSize}
                            onClick={() => {
                              requestWalletNetworkSwitchToTargetChain();
                            }}
                          >
                            Switch to {CHAIN_ID === 1 ? "Mainnet" : chain.name}
                          </Button>
                        ) : (
                          <Button
                            type="submit"
                            variant="primary"
                            disabled={isPending || !hasRequiredInputs}
                            isLoading={isPending}
                            size={buttonSize}
                          >
                            {(() => {
                              switch (mode) {
                                case "vote":
                                  return hasRepostTarget
                                    ? "Cast revote"
                                    : proposalVoteCount === 1
                                      ? "Cast vote"
                                      : `Cast ${proposalVoteCount ?? "..."} votes`;
                                case "onchain-comment": {
                                  if (hasRepostTarget) return "Submit repost";
                                  const isReplyWithoutComment =
                                    hasReplyTarget && reason?.trim() === "";
                                  if (isReplyWithoutComment)
                                    return replyTargetFeedItems.length === 1
                                      ? "Submit reply"
                                      : "Submit replies";
                                  return "Submit comment";
                                }
                                default:
                                  throw new Error();
                              }
                            })()}
                          </Button>
                        )}
                      </>
                    );

                  case "farcaster-comment": {
                    if (connectedWalletAccountAddress == null)
                      return (
                        <Button
                          type="button"
                          onClick={() => {
                            requestWalletAccess();
                          }}
                          size={buttonSize}
                        >
                          Connect wallet to cast
                        </Button>
                      );

                    if (farcasterAccounts == null)
                      return (
                        <Button
                          type="button"
                          size={buttonSize}
                          isLoading
                          disabled
                        >
                          Cast comment
                        </Button>
                      );

                    const selectedAccount = farcasterAccounts.find(
                      (a) =>
                        String(a.fid) === String(selectedFarcasterAccountFid),
                    );

                    if (
                      selectedAccount == null ||
                      !selectedAccount.hasAccountKey
                    )
                      return (
                        <Button
                          type="button"
                          size={buttonSize}
                          onClick={() => {
                            openFarcasterSetupDialog();
                          }}
                        >
                          {selectedAccount == null
                            ? "Setup account to cast"
                            : "Setup account key to cast"}
                        </Button>
                      );

                    if (!isAuthenticated)
                      return (
                        <Button
                          type="button"
                          size={buttonSize}
                          onClick={() => {
                            openAuthenticationDialog({ intent: "cast" });
                          }}
                        >
                          Log in to cast
                        </Button>
                      );

                    return (
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={isPending || !hasRequiredInputs}
                        isLoading={isPending}
                        size={buttonSize}
                      >
                        Cast comment
                      </Button>
                    );
                  }

                  default:
                    throw new Error();
                }
              })()}
            </div>
          </div>
        </form>
      </div>

      {variant !== "boxed" && helpTextElement}
    </div>
  );
};

const SupportSelect = ({ mode, value, ...props }) => (
  <Select
    aria-label="Select support"
    width="15rem"
    variant="default"
    multiline={false}
    value={value}
    renderTriggerContent={
      value == null
        ? null
        : (key, options) => options.find((o) => o.value === key).label
    }
    placeholder={mode === "vote" ? "Select vote" : "Select signal"}
    options={
      mode === "vote"
        ? [
            {
              value: 1,
              textValue: "For",
              label: (
                <span css={(t) => css({ color: t.colors.textPositive })}>
                  For
                </span>
              ),
            },
            {
              value: 0,
              textValue: "Against",
              label: (
                <span css={(t) => css({ color: t.colors.textNegative })}>
                  Against
                </span>
              ),
            },
            { value: 2, label: "Abstain" },
          ]
        : [
            {
              value: 1,
              textValue: "Signal for",
              label: (
                <span css={(t) => css({ color: t.colors.textPositive })}>
                  Signal for
                </span>
              ),
            },
            {
              value: 0,
              textValue: "Signal against",
              label: (
                <span css={(t) => css({ color: t.colors.textNegative })}>
                  Signal against
                </span>
              ),
            },
            { value: 2, label: "No signal" },
          ]
    }
    {...props}
  />
);

const QuotedFeedItem = ({ component: Component = "div", item, onCancel }) => {
  // Strip reposts (some risk of stripping unintened content here (it’s fine))
  const quotedText = item.reason.replaceAll(REPOST_REGEX, "");
  return (
    <Component
      css={(t) =>
        css({
          fontSize: "0.875em",
          position: "relative",
          border: "0.1rem solid",
          borderRadius: "0.5rem",
          borderColor: t.colors.borderLighter,
          padding: "0.4rem 0.4rem 0.4rem 0.6rem",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          "[data-cancel]": {
            padding: "0.3rem",
            position: "relative",
            "@media(hover: hover)": {
              cursor: "pointer",
              ":hover": { color: t.colors.textAccent },
            },
          },
        })
      }
    >
      <React.Suspense fallback={<div>...</div>}>
        <NextLink
          href={`#${item.id}`}
          style={{
            display: "block",
            position: "absolute",
            inset: 0,
          }}
        />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          <AccountPreviewPopoverTrigger
            showAvatar
            accountAddress={item.authorAccount}
          />
          :{" "}
          <MarkdownRichText
            text={quotedText}
            displayImages={false}
            inline
            css={css({
              // Make all headings small
              "h1,h2,h3,h4,h5,h6": { fontSize: "1em" },
              "*+h1,*+h2,*+h3,*+h4,*+h5,*+h6": {
                marginTop: "1.5em",
              },
              "h1:has(+*),h2:has(+*),h3:has(+*),h4:has(+*),h5:has(+*),h6:has(+*)":
                { marginBottom: "0.625em" },
            })}
          />
        </div>
        <button data-cancel onClick={onCancel}>
          <CrossIcon style={{ width: "1.2rem", height: "auto" }} />
        </button>
      </React.Suspense>
    </Component>
  );
};

export default ProposalActionForm;
