import React from "react";
import NextLink from "next/link";
import { css } from "@emotion/react";
import { AutoAdjustingHeightTextarea } from "@shades/common/react";
import { Cross as CrossIcon } from "@shades/ui-web/icons";
import Button from "@shades/ui-web/button";
import Select from "@shades/ui-web/select";
import Avatar from "@shades/ui-web/avatar";
import {
  isFinalState as isFinalProposalState,
  isSucceededState as isSucceededProposalState,
} from "../utils/proposals.js";
import { useProposal, useDelegate } from "../store.js";
import { useAccountsWithVerifiedEthAddress as useFarcasterAccountsWithVerifiedEthAddress } from "../hooks/farcaster.js";
import { usePriorVotes } from "../hooks/token-contract.js";
import { useWallet } from "../hooks/wallet.js";
import { useDialog } from "../hooks/global-dialogs.js";
import NativeSelect from "./native-select.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";

const getByteLength = (string) =>
  new TextEncoder("utf-8").encode(string).length;

const MarkdownRichText = React.lazy(() => import("./markdown-rich-text.js"));

const ProposalActionForm = ({
  proposalId,
  size = "default",
  mode,
  setMode,
  availableModes,
  reason,
  setReason,
  support,
  setSupport,
  onSubmit,
  quotedFeedItems,
  cancelQuote,
  inputRef,
}) => {
  const [isPending, setPending] = React.useState(false);
  // const [error, setError] = React.useState(null);

  const {
    address: connectedWalletAccountAddress,
    requestAccess: requestWalletAccess,
    switchToMainnet: requestWalletNetworkSwitchToMainnet,
    isLoading: hasPendingWalletAction,
    isUnsupportedChain,
  } = useWallet();
  const [
    selectedFarcasterAccountFidByWalletAccountAddress,
    setSelectedFarcasterAccount,
  ] = React.useState({});
  const farcasterAccounts = useFarcasterAccountsWithVerifiedEthAddress(
    connectedWalletAccountAddress,
    { enabled: mode === "farcaster-comment" },
  );

  const selectedFarcasterAccountFid = (() => {
    if (connectedWalletAccountAddress == null) return null;

    const selectedFid =
      selectedFarcasterAccountFidByWalletAccountAddress[
        connectedWalletAccountAddress.toLowerCase()
      ];

    if (selectedFid != null) return selectedFid;

    const firstAccountWithKey = farcasterAccounts?.find((a) => a.hasAccountKey);

    return (firstAccountWithKey ?? farcasterAccounts?.[0])?.fid;
  })();

  const { open: openFarcasterSetupDialog } = useDialog("farcaster-setup");
  const connectedDelegate = useDelegate(connectedWalletAccountAddress);

  const proposal = useProposal(proposalId);

  const proposalVoteCount = usePriorVotes({
    account: connectedWalletAccountAddress,
    blockNumber: proposal?.startBlock,
    enabled: mode === "vote",
  });
  const currentVoteCount = connectedDelegate?.nounsRepresented.length ?? 0;

  const hasRequiredInputs = (() => {
    switch (mode) {
      case "farcaster-comment":
        return (
          reason.trim().length > 0 && getByteLength(reason) <= 320 // Farcaster text limit is set in bytes
        );
      default:
        return support != null;
    }
  })();

  const hasQuote = quotedFeedItems?.length > 0;

  if (mode == null) throw new Error();

  const renderHelpText = () => {
    if (isUnsupportedChain)
      return `Switch to Ethereum Mainnet to ${
        mode === "vote" ? "vote" : "give feedback"
      }.`;

    if (mode === "farcaster-comment" && farcasterAccounts?.length === 0)
      return (
        <>
          <p>
            To cast from Camp you need to verify your address (
            {connectedWalletAccountAddress.slice(0, 6)}...
            {connectedWalletAccountAddress.slice(-4)}) with the Farcaster
            account you wish to use.
          </p>
          <p>You can verify addresses in the Warpcast app.</p>
        </>
      );

    if (mode === "farcaster-comment" && getByteLength(reason) > 320) {
      const length = getByteLength(reason);
      return <>Casts are limited to 320 bytes (currently at {length})</>;
    }

    if (mode !== "vote") {
      const isFinalOrSucceededState =
        proposal != null &&
        (isFinalProposalState(proposal.state) ||
          isSucceededProposalState(proposal.state));

      if (isFinalOrSucceededState) return null;

      return "Signal your voting intentions to influence and guide proposers.";
    }

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
            You may still vote with <em>0</em> votes, but gas spent will not be
            refunded.
          </p>
        </>
      );

    if (proposalVoteCount === 0)
      return "You can vote with zero voting power, but gas spent will not be refunded.";

    return "Gas spent on voting will be refunded.";
  };

  const helpText = renderHelpText();

  const showModePicker = availableModes != null && availableModes.length > 1;

  const disableForm =
    isPending || connectedWalletAccountAddress == null || isUnsupportedChain;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
        <div
          style={{
            display: "flex",
            gap: "0.6rem",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <label
            htmlFor="message-input"
            css={(t) =>
              css({
                fontSize: t.text.sizes.small,
                color: t.colors.textDimmed,
                em: {
                  fontStyle: "normal",
                  fontWeight: t.text.weights.emphasis,
                },
                "& + *": { marginTop: "0.8rem" },
              })
            }
          >
            {connectedWalletAccountAddress == null ? null : (
              <>
                {mode === "farcaster-comment" ? (
                  (() => {
                    if (
                      farcasterAccounts == null ||
                      farcasterAccounts.length === 0
                    )
                      return null;

                    if (farcasterAccounts.length === 1) {
                      const selectedAccount = farcasterAccounts.find(
                        (a) =>
                          String(a.fid) === String(selectedFarcasterAccountFid),
                      );

                      const { displayName, username, pfpUrl } = selectedAccount;

                      return (
                        <>
                          Comment as{" "}
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
                              `FID ${selectedAccount.fid}`}
                          </em>
                          {username != null && username !== displayName && (
                            <> (@{username})</>
                          )}
                        </>
                      );
                    }

                    return (
                      <>
                        Comment as{" "}
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
                                {username != null &&
                                  username !== displayName && (
                                    <> (@{username})</>
                                  )}
                              </>
                            );
                          }}
                        />
                      </>
                    );
                  })()
                ) : (
                  <>
                    {mode === "vote" ? "Cast vote as" : "Comment as"}{" "}
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
                  // Default to "abstain" for comments, and reset for votes
                  setSupport(m === "onchain-comment" ? 2 : null);
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
                size="tiny"
                variant="opaque"
                width="max-content"
                align="right"
                buttonProps={{
                  css: (t) => css({ color: t.colors.textDimmed }),
                }}
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
          css={(t) =>
            css({
              borderRadius: "0.5rem",
              background: t.colors.backgroundModifierNormal,
              padding: "var(--padding, 1rem)",
              "&:has(textarea:focus-visible)": { boxShadow: t.shadows.focus },
            })
          }
          style={{ "--padding": size === "small" ? "0.8rem" : undefined }}
        >
          <AutoAdjustingHeightTextarea
            ref={inputRef}
            id="message-input"
            rows={1}
            placeholder={hasQuote ? "Optional comment" : "..."}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
            }}
            css={(t) =>
              css({
                background: "transparent",
                fontSize: t.text.sizes.base,
                display: "block",
                color: t.colors.textNormal,
                fontWeight: "400",
                width: "100%",
                maxWidth: "100%",
                outline: "none",
                border: 0,
                padding: "0.3rem 0.3rem",
                "::placeholder": { color: t.colors.inputPlaceholder },
                "&:disabled": {
                  color: t.colors.textMuted,
                  cursor: "not-allowed",
                },
                // Prevents iOS zooming in on input fields
                "@supports (-webkit-touch-callout: none)": {
                  fontSize: "1.6rem",
                },
              })
            }
            disabled={disableForm}
          />
          {quotedFeedItems?.length > 0 && (
            <ul
              css={(t) =>
                css({
                  listStyle: "none",
                  fontSize: "0.875em",
                  margin: "0.8rem 0",
                  li: {
                    position: "relative",
                    border: "0.1rem solid",
                    borderRadius: "0.5rem",
                    borderColor: t.colors.borderLighter,
                    padding: "0.4rem 0.4rem 0.4rem 0.6rem",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                  },
                  "li + li": { marginTop: "0.6rem" },
                  button: { position: "relative" },
                  "[data-cancel]": {
                    padding: "0.3rem",
                    "@media(hover: hover)": {
                      cursor: "pointer",
                      ":hover": { color: t.colors.textAccent },
                    },
                  },
                })
              }
            >
              {quotedFeedItems.map((item) => (
                <li key={item.id}>
                  <NextLink
                    href={`#${item.id}`}
                    style={{ display: "block", position: "absolute", inset: 0 }}
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
                      text={item.body}
                      displayImages={false}
                      inline
                      css={css({
                        // Make all headings small
                        "h1,h2,h3,h4,h5,h6": { fontSize: "1em" },
                        "*+h1,*+h2,*+h3,*+h4,*+h5,*+h6": { marginTop: "1.5em" },
                        "h1:has(+*),h2:has(+*),h3:has(+*),h4:has(+*),h5:has(+*),h6:has(+*)":
                          { marginBottom: "0.625em" },
                      })}
                    />
                  </div>
                  <button data-cancel onClick={() => cancelQuote(item.id)}>
                    <CrossIcon style={{ width: "1.2rem", height: "auto" }} />
                  </button>
                </li>
              ))}
            </ul>
          )}
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
          <div
            style={{
              display: "grid",
              gridAutoFlow: "column",
              justifyContent: "flex-end",
              gridGap: "1rem",
              marginTop: "1rem",
            }}
          >
            {(() => {
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
                        size={size}
                      >
                        Connect wallet to{" "}
                        {mode === "vote" ? "vote" : "give feedback"}
                      </Button>
                    );

                  return (
                    <>
                      <SupportSelect
                        mode={mode}
                        size={size}
                        value={support}
                        onChange={(value) => {
                          setSupport(value);
                        }}
                        disabled={disableForm}
                      />

                      {isUnsupportedChain ? (
                        <Button
                          type="button"
                          variant="primary"
                          disabled={hasPendingWalletAction}
                          isLoading={hasPendingWalletAction}
                          size={size}
                          onClick={() => {
                            requestWalletNetworkSwitchToMainnet();
                          }}
                        >
                          Switch to Mainnet
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          variant="primary"
                          disabled={isPending || !hasRequiredInputs}
                          isLoading={isPending}
                          size={size}
                        >
                          {(() => {
                            switch (mode) {
                              case "vote":
                                return hasQuote
                                  ? "Cast revote"
                                  : proposalVoteCount === 1
                                    ? "Cast vote"
                                    : `Cast ${proposalVoteCount ?? "..."} votes`;
                              case "onchain-comment":
                                return hasQuote
                                  ? "Submit repost"
                                  : "Submit comment";
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
                        size={size}
                      >
                        Connect wallet to cast
                      </Button>
                    );

                  if (farcasterAccounts == null)
                    return (
                      <Button type="button" size={size} isLoading disabled>
                        Cast comment
                      </Button>
                    );

                  if (farcasterAccounts.length === 0)
                    return (
                      <Button type="button" size={size} disabled>
                        No account found
                      </Button>
                    );

                  const selectedAccount = farcasterAccounts.find(
                    (a) =>
                      String(a.fid) === String(selectedFarcasterAccountFid),
                  );

                  if (!selectedAccount.hasAccountKey)
                    return (
                      <Button
                        type="button"
                        size={size}
                        onClick={() => {
                          openFarcasterSetupDialog();
                        }}
                      >
                        Setup account key to cast
                      </Button>
                    );

                  return (
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isPending || !hasRequiredInputs}
                      isLoading={isPending}
                      size={size}
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
        </form>

        {helpText != null && (
          <div
            css={(t) =>
              css({
                fontSize: t.text.sizes.tiny,
                color: t.colors.textDimmed,
                "p + p": { marginTop: "1em" },
                em: {
                  fontStyle: "normal",
                  fontWeight: t.text.weights.emphasis,
                },
              })
            }
          >
            {helpText}
          </div>
        )}
      </div>
    </>
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

export default ProposalActionForm;
