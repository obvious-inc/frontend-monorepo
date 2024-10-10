"use client";

import getDateYear from "date-fns/getYear";
import { formatEther, parseEther } from "viem";
import React from "react";
import { css, ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import NextLink from "next/link";
import { useQuery } from "@tanstack/react-query";
import { array as arrayUtils } from "@shades/common/utils";
import { useInterval, useMatchMedia } from "@shades/common/react";
import {
  Cross as CrossIcon,
  Fullscreen as FullscreenIcon,
} from "@shades/ui-web/icons";
import Dialog from "@shades/ui-web/dialog";
import DialogHeader from "@shades/ui-web/dialog-header";
import Switch from "@shades/ui-web/switch";
import Spinner from "@shades/ui-web/spinner";
import Button from "@shades/ui-web/button";
import Input from "@shades/ui-web/input";
import { CHAIN_ID } from "@/constants/env";
import { getTheme } from "@/theme";
import { getChain as getSupportedChain } from "@/utils/chains";
import { useActions } from "@/store";
import usePublicClient from "@/hooks/public-client";
import {
  useAuction as useContractAuction,
  useReservePrice,
  useMinBidIncrementPercentage,
  useCreateBid,
  useSettleCurrentAndCreateNewAuction,
} from "@/hooks/auction-house-contract";
import useThemePreferred from "@/hooks/preferred-theme";
import useKeyboardShortcuts, {
  isEventTargetInputOrTextArea,
} from "@/hooks/keyboard-shortcuts";
import { useWallet } from "@/hooks/wallet";
import { useNounSeed } from "@/hooks/token-contract";
import { useGenerateSVGImage } from "@/hooks/nouns-token-descriptor-contract";
import AccountPreviewPopoverTrigger from "@/components/account-preview-popover-trigger";
import FormattedDateWithTooltip from "@/components/formatted-date-with-tooltip";
import ChainExporerTransactionLink from "@/components/chain-explorer-transaction-link";
import { useSearchParams } from "@/hooks/navigation";
import NativeSelect from "@/components/native-select";

const chain = getSupportedChain(CHAIN_ID);

const useAuction = ({ nounId, watch = false, enabled = true } = {}) => {
  const contractAuction = useContractAuction({
    watch,
    enabled: enabled && nounId == null,
  });

  const { subgraphFetch } = useActions();

  const { data: subgraphAuction } = useQuery({
    queryKey: ["auction", String(nounId)],
    onError: console.log,
    queryFn: async () => {
      const { noun, auction } = await subgraphFetch({
        query: `{
          noun(id: ${nounId}) {
            id
          }
          auction(id: ${nounId}) {
            id
            startTime
            endTime
            amount
            settled
            bidder { id }
            bids {
              id
              amount
              blockNumber
              blockTimestamp
              txHash
              bidder { id }
            }
          }
        }`,
      });

      if (noun == null) throw new Error("not-found");

      if (auction == null)
        return {
          nounId,
          nounderReward: true,
        };

      return auction;
    },
    enabled: enabled && nounId != null,
  });

  return React.useMemo(() => {
    if (nounId != null) return subgraphAuction;
    if (contractAuction == null) return null;
    const parseTimestamp = (unixSeconds) =>
      new Date(parseInt(unixSeconds) * 1000);
    return {
      ...contractAuction,
      nounId: String(contractAuction.nounId),
      bidderId: contractAuction.bidder.toLowerCase(),
      amount: String(contractAuction.amount),
      startTimestamp: parseTimestamp(contractAuction.startTime),
      endTimestamp: parseTimestamp(contractAuction.endTime),
    };
  }, [nounId, contractAuction, subgraphAuction]);
};

const useBids = (nounId) => {
  const auction = useAuction({ nounId });
  return auction?.bids ?? [];
};

const AuctionDialog = ({ isOpen }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const nounId = searchParams.get("noun");

  const close = () => {
    setSearchParams((params) => {
      const nextParams = new URLSearchParams(params);
      nextParams.delete("noun");
      nextParams.delete("dialog");
      return nextParams;
    });
  };
  return (
    <Dialog isOpen={isOpen} onRequestClose={close} tray width="124.4rem">
      {({ titleProps }) => (
        <Auction trayDialog nounId={nounId} style={{ flex: 1, minHeight: 0 }}>
          {({ auction, currentAuction }) => (
            <div
              className="hideable"
              css={css({
                display: "flex",
                alignItems: "flex-start",
                padding: "1.6rem",
                "@media (min-width: 996px)": {
                  padding: "3.2rem",
                },
              })}
            >
              <div
                css={(t) =>
                  css({
                    flex: 1,
                    minWidth: 0,
                    h1: {
                      fontSize: t.text.sizes.small,
                      fontWeight: t.text.weights.normal,
                      lineHeight: 1.2,
                      color: t.colors.textMutedAlpha,
                      fontStyle: "italic",
                    },
                  })
                }
              >
                {auction != null && (
                  <h1 {...titleProps}>
                    <NounsSelect
                      selectedNounId={auction.nounId}
                      auctionNounId={currentAuction?.nounId}
                    />
                  </h1>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.8rem" }}>
                <Button
                  component={NextLink}
                  href="/auction"
                  size="small"
                  css={css({ width: "2.8rem", padding: 0 })}
                >
                  <FullscreenIcon
                    style={{
                      width: "1.2rem",
                      height: "auto",
                      margin: "auto",
                      transform: "scaleX(-1)",
                    }}
                  />
                </Button>
                <Button
                  size="small"
                  onClick={close}
                  css={css({ width: "2.8rem", padding: 0 })}
                >
                  <CrossIcon
                    style={{ width: "1.5rem", height: "auto", margin: "auto" }}
                  />
                </Button>
              </div>
            </div>
          )}
        </Auction>
      )}
    </Dialog>
  );
};

export const Auction = ({
  nounId: eagerCustomNounId,
  trayDialog = false,
  showBids = false,
  transparent = false,
  children,
  ...props
}) => {
  const inputRef = React.useRef();

  const [, setSearchParams] = useSearchParams();

  const {
    address: connectedWalletAccountAddress,
    chainId: connectedChainId,
    requestAccess: requestWalletAccess,
    switchToTargetChain: switchWalletToTargetChain,
  } = useWallet();

  const publicClient = usePublicClient();

  const preferredTheme = useThemePreferred();

  const isDesktopLayout = useMatchMedia("(min-width: 600px)");

  const customNounId = React.useDeferredValue(eagerCustomNounId);

  const currentAuction = useAuction({ watch: customNounId == null });
  const customAuction = useAuction({
    nounId: customNounId,
    enabled: customNounId != null,
  });
  const auction = customNounId == null ? currentAuction : customAuction;

  const auctionNounId = React.useDeferredValue(auction?.nounId);
  const nounId = customNounId ?? auctionNounId;

  const reservePrice = useReservePrice();
  const minBidIncrementPercentage = useMinBidIncrementPercentage();

  const currentSeed = useNounSeed(nounId);
  const lastSeedRef = React.useRef(currentSeed);
  React.useEffect(() => {
    if (currentSeed != null) lastSeedRef.current = currentSeed;
  });
  const seed = currentSeed ?? lastSeedRef.current;

  const base64Svg = useGenerateSVGImage(seed);

  const minBidValue = (() => {
    if (auction == null) return null;
    if (auction.amount == 0) return reservePrice;
    if (minBidIncrementPercentage == null || auction.amount == null)
      return null;
    const amount = BigInt(auction.amount);
    return amount + (amount / 100n) * BigInt(minBidIncrementPercentage);
  })();

  const [pendingBidByNounId, setPendingBids] = React.useState(() => {
    if (minBidValue == null) return {};
    return { [nounId]: formatEther(minBidValue) };
  });

  const [hideUI, setHideUI] = React.useState(false);
  const [showBidSimulationErrors, setShowBidSimulationErrors] =
    React.useState(false);

  const pendingBid = pendingBidByNounId[nounId];

  const isBidValid = (() => {
    if (minBidValue == null || pendingBid == null || pendingBid.trim() === "")
      return false;
    try {
      const pendingBidValue = parseEther(pendingBid);
      return BigInt(pendingBidValue) >= minBidValue;
    } catch (e) {
      return false;
    }
  })();

  const hasEnded = auction != null && auction.endTimestamp <= Date.now();

  const {
    call: createBid,
    callStatus: createBidCallStatus,
    callError: createBidCallError,
    simulationStatus: createBidSimulationStatus,
    simulationError: createBidSimulationError,
    receiptStatus: createBidReceiptStatus,
    receiptError: createBidReceiptError,
  } = useCreateBid({
    nounId,
    bidValue: isBidValid ? parseEther(pendingBid) : null,
    enabled:
      connectedWalletAccountAddress != null &&
      auction != null &&
      !hasEnded &&
      isBidValid,
  });

  const hasPendingBidReceipt =
    createBidCallStatus === "success" && createBidReceiptStatus === "pending";

  const createBidError =
    createBidReceiptError ??
    createBidCallError ??
    (showBidSimulationErrors ? createBidSimulationError : null);

  const {
    call: settle,
    callStatus: settleCallStatus,
    callError: settleCallError,
    // simulationStatus: settleSimulationStatus,
    simulationError: settleSimulationError,
    receiptStatus: settleReceiptStatus,
    receiptError: settleReceiptError,
  } = useSettleCurrentAndCreateNewAuction({
    enabled:
      connectedWalletAccountAddress != null && hasEnded && !auction?.settled,
  });

  const hasPendingSettleReceipt =
    settleCallStatus === "success" && settleReceiptStatus === "pending";

  const settleError =
    settleReceiptError ?? settleCallError ?? settleSimulationError;

  React.useEffect(() => {
    if (nounId == null) return;
    if (minBidValue != null && pendingBid == null)
      setPendingBids({ [nounId]: formatEther(minBidValue) });
  }, [nounId, pendingBid, minBidValue]);

  const bids = useBids(nounId);

  const [showBidsDialog, setShowBidsDialog] = React.useState(false);

  const isConnectedToTargetChain = CHAIN_ID === connectedChainId;

  const buttonSize = isDesktopLayout ? "medium" : "large";

  useKeyboardShortcuts({
    ArrowLeft: (e) => {
      if (isEventTargetInputOrTextArea(e.target)) return;
      const prevNounId = parseInt(nounId) - 1;
      if (prevNounId >= 1) {
        setSearchParams((params) => {
          const nextParams = new URLSearchParams(params);
          nextParams.set("noun", prevNounId);
          return nextParams;
        });
        return;
      }
      if (currentAuction == null) return;
      setSearchParams((params) => {
        const nextParams = new URLSearchParams(params);
        nextParams.set("noun", parseInt(currentAuction.nounId));
        return nextParams;
      });
    },
    ArrowRight: (e) => {
      if (currentAuction == null) return;
      if (isEventTargetInputOrTextArea(e.target)) return;
      setSearchParams((params) => {
        const nextParams = new URLSearchParams(params);
        const nextNounId = parseInt(nounId) + 1;
        nextParams.set(
          "noun",
          nextNounId > parseInt(currentAuction.nounId) ? 1 : nextNounId,
        );
        return nextParams;
      });
    },
  });

  const biddingForm = (
    <div className="bidding-form">
      <div
        className="meta-container"
        css={(t) =>
          css({
            color: t.colors.textDimmedAlpha,
            em: {
              fontStyle: "normal",
              fontWeight: t.text.weights.emphasis,
            },
            ".error": {
              color: t.colors.textNegative,
            },
            ".success": {
              color: t.colors.textPositive,
              fontWeight: t.text.weights.emphasis,
            },
          })
        }
      >
        {auction != null && !auction.nounderReward && !hasEnded && (
          <div>
            Auction ends in{" "}
            <em>
              <Now>
                {(nowMillis) => {
                  // TODO: auction end behavior
                  const secondsLeft = Math.max(
                    0,
                    Math.ceil(
                      (auction.endTimestamp.getTime() - nowMillis) / 1000,
                    ),
                  );

                  const hours = Math.floor(secondsLeft / 60 / 60);
                  const minutes = Math.floor(secondsLeft / 60) - hours * 60;
                  const seconds = secondsLeft - hours * 60 * 60 - minutes * 60;

                  return (
                    <>
                      {hours}h {minutes}m{" "}
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>
                        {String(seconds).padStart(2, "0")}
                      </span>
                      s
                    </>
                  );
                }}
              </Now>
            </em>
          </div>
        )}
        <div>
          {(() => {
            if (auction == null) return <>&nbsp;</>;

            if (auction.nounderReward) return "Nounder reward";

            if (auction.amount == 0)
              return hasEnded ? "Auction ended without bids" : "No bids yet";

            if (hasEnded)
              return (
                <>
                  Auction won by{" "}
                  <AccountPreviewPopoverTrigger
                    showAvatar
                    accountAddress={auction.bidderId}
                  />{" "}
                  (Ξ{formatEther(auction.amount)})
                </>
              );

            return (
              <>
                Current bid: <em>Ξ{formatEther(auction.amount)}</em> (by{" "}
                <AccountPreviewPopoverTrigger
                  accountAddress={auction.bidderId}
                  style={{ fontWeight: "400" }}
                />
                )
              </>
            );
          })()}
        </div>

        {hasEnded ? (
          <>
            {settleError != null && (
              <div className="error">
                {settleError.shortMessage || settleError.message}
              </div>
            )}
            {hasPendingSettleReceipt && (
              <div>
                Transaction submitted. Awaiting receipt...
                <Spinner inline style={{ marginLeft: "0.5em" }} />
              </div>
            )}
          </>
        ) : (
          <>
            {createBidError != null && (
              <div className="error">
                {createBidError.shortMessage || createBidError.message}
              </div>
            )}
            {createBidReceiptStatus === "success" ? (
              <div className="success">Bid successfully submitted!</div>
            ) : hasPendingBidReceipt ? (
              <div>
                Bid transaction submitted. Awaiting receipt
                <Spinner inline style={{ marginLeft: "0.5em" }} />
              </div>
            ) : null}
          </>
        )}
      </div>

      {(() => {
        if (auction == null || auction.settled || auction.nounderReward)
          return null;

        if (connectedWalletAccountAddress == null)
          return (
            <Button
              size={buttonSize}
              onClick={() => {
                requestWalletAccess();
              }}
            >
              Connect wallet to bid
            </Button>
          );

        if (!isConnectedToTargetChain)
          return (
            <Button
              size={buttonSize}
              onClick={() => {
                switchWalletToTargetChain();
              }}
            >
              Switch to {CHAIN_ID === 1 ? "Mainnet" : chain.name} to interact
              with auction
            </Button>
          );

        if (hasEnded)
          return (
            <Button
              size={buttonSize}
              disabled={
                settle == null ||
                settleCallStatus === "pending" ||
                hasPendingSettleReceipt
              }
              isLoading={
                settleCallStatus === "pending" || hasPendingSettleReceipt
              }
              onClick={() => {
                settle();
              }}
            >
              Settle and start the next auction
            </Button>
          );

        return (
          <>
            <form
              onSubmit={async (e) => {
                e.preventDefault();

                if (createBid == null) {
                  setShowBidSimulationErrors(true);
                  return;
                }

                const hash = await createBid();
                await publicClient.waitForTransactionReceipt({ hash });
                setShowBidSimulationErrors(false);
                setPendingBids({ [nounId]: "" });
              }}
              css={(t) =>
                css({
                  display: "flex",
                  gap: "0.8rem",
                  ".submit-button": {
                    height: "auto",
                  },
                  fontSize: t.text.sizes.base,
                  "@media (max-width: 600px)": {
                    fontSize: t.text.sizes.large,
                    ".submit-button": { fontSize: "inherit" },
                  },
                })
              }
            >
              <Input
                className="input-container"
                component="div"
                size={isDesktopLayout ? "small" : "medium"}
                onClick={() => {
                  inputRef.current.focus();
                }}
                css={(t) =>
                  css({
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5em",
                    ".input": {
                      flex: 1,
                      minWidth: 0,
                      padding: 0,
                      outline: 0,
                      background: "none",
                      fontSize: "inherit",
                      color: "inherit",
                      border: 0,
                      "::placeholder": {
                        color: t.colors.inputPlaceholder,
                      },
                    },
                    "&:has(:focus-visible)": {
                      boxShadow: t.shadows.focus,
                    },
                    // Prevents iOS zooming in on input fields
                    "@supports (-webkit-touch-callout: none)": {
                      fontSize: "1.6rem",
                    },
                  })
                }
              >
                <input
                  ref={inputRef}
                  className="input"
                  value={pendingBid ?? ""}
                  onChange={(e) => {
                    setShowBidSimulationErrors(false);
                    setPendingBids({ [nounId]: e.target.value.trim() });
                  }}
                  placeholder={
                    minBidValue == null
                      ? "..."
                      : `${formatEther(minBidValue)} or more`
                  }
                />
                <div
                  data-simulating={
                    createBidSimulationStatus === "pending" || undefined
                  }
                  css={(t) =>
                    css({
                      position: "relative",
                      ".spinner-overlay": {
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: t.colors.borderLight,
                        transition: "0.1s opacity ease-out",
                        opacity: 0,
                      },
                      "&[data-simulating] .eth": { opacity: 0 },
                      "&[data-simulating] .spinner-overlay": { opacity: 1 },
                    })
                  }
                >
                  <div className="eth">ETH</div>
                  <div className="spinner-overlay" aria-hidden="true">
                    <Spinner size="1.3rem" />
                  </div>
                </div>
              </Input>
              <Button
                className="submit-button"
                size={buttonSize}
                type="submit"
                disabled={
                  !isBidValid ||
                  // createBid == null ||
                  createBidCallStatus === "pending"
                }
                isLoading={createBidCallStatus === "pending"}
              >
                Place bid
              </Button>
            </form>
            <div
              css={(t) =>
                css({
                  color: t.colors.textDimmed,
                  fontSize: t.text.sizes.small,
                })
              }
            >
              {minBidValue == null ? (
                <>&nbsp;</>
              ) : (
                <>Bid needs to be Ξ{formatEther(minBidValue)} or more</>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );

  return (
    <>
      <EmotionThemeProvider theme={getTheme("light")}>
        <div css={css({ position: "relative" })} {...props}>
          <div
            data-tray-dialog={trayDialog || undefined}
            css={(t) =>
              css({
                transition: "0.2s background ease-out",
                background: t.colors.backgroundSecondary,
                "&[data-tray-dialog]": {
                  "@media(max-width: 600px)": {
                    paddingTop: "6rem",
                  },
                },
                ".image-container": {
                  width: `calc(100vh - ${t.navBarHeight})`, // Needs to mirror tray dialog height
                  maxWidth: "100%",
                  margin: "0 auto",
                  aspectRatio: "1/1",
                  transition: "0.2s opacity ease-out",
                },
                img: {
                  display: "block",
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  objectPosition: "bottom",
                },
              })
            }
            style={{
              background: transparent
                ? "none"
                : seed == null
                  ? undefined
                  : parseInt(seed.background) === 0
                    ? "#d5d7e1"
                    : "#e1d7d5",
            }}
          >
            <div
              className="image-container"
              style={{ opacity: base64Svg == null ? 0 : 1 }}
            >
              {base64Svg != null && (
                <img src={`data:image/svg+xml;base64,${base64Svg}`} />
              )}
            </div>
          </div>
          <div
            data-hide-ui={hideUI || undefined}
            css={(t) =>
              css({
                position: "absolute",
                inset: 0,

                color: t.colors.textNormal,
                colorScheme: "light",

                ".meta-container": {
                  fontSize: t.text.sizes.base,
                  ".error": {
                    width: "30rem",
                    maxWidth: "100%",
                    textAlign: "right",
                  },
                },

                ".hideable, .hover-hideable": {
                  transition: "0.2s opacity ease-out",
                },
                "&[data-hide-ui] .hideable": {
                  opacity: 0,
                  pointerEvents: "none",
                },
                "@media (hover: hover)": {
                  "&[data-hide-ui]:not(:hover) .hover-hideable": {
                    opacity: 0,
                    pointerEvents: "none",
                  },
                },
              })
            }
          >
            {isDesktopLayout && (
              <div
                css={css({
                  position: "absolute",
                  left: 0,
                  bottom: 0,
                  right: 0,
                  display: "flex",
                  alignItems: "flex-end",
                  padding: "1.6rem",
                  "@media (min-width: 996px)": {
                    padding: "3.2rem",
                  },

                  ".bidding-form": {
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "1.6rem",
                    ".meta-container": {
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: "0.8rem",
                    },
                    ".input-container": {
                      maxWidth: "20rem",
                      ".input": { textAlign: "right" },
                    },
                  },
                })}
              >
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "0.8rem",
                  }}
                >
                  {isDesktopLayout && bids.length > 1 && (
                    <button
                      className="hideable"
                      css={(t) =>
                        css({
                          color: t.colors.textDimmed,
                          "@media(hover: hover)": {
                            cursor: "pointer",
                            ":hover .hover-underline": {
                              textDecoration: "underline",
                            },
                          },
                        })
                      }
                      onClick={() => {
                        setShowBidsDialog(true);
                      }}
                    >
                      <span className="hover-underline">View bids</span>{" "}
                      {"\u2197"}
                    </button>
                  )}
                  {auction != null &&
                    !auction.settled &&
                    !auction.nounderReward && (
                      <Switch
                        // size="small"
                        label="Hide UI"
                        align="right"
                        value={hideUI}
                        onChange={setHideUI}
                        className="hover-hideable"
                        css={(t) =>
                          css({
                            ":not([data-selected])": {
                              color: t.colors.textDimmed,
                            },
                          })
                        }
                      />
                    )}
                </div>
                <div className="hideable">{biddingForm}</div>
              </div>
            )}

            {children?.({ auction, currentAuction })}

            {(isDesktopLayout || !showBids) && (
              <Dialog
                isOpen={showBidsDialog}
                onRequestClose={() => {
                  setShowBidsDialog(false);
                }}
                // tray
                width="36rem"
              >
                {({ titleProps }) => (
                  <div css={css({ padding: "1.6rem" })}>
                    <DialogHeader
                      title="All bids"
                      titleProps={titleProps}
                      dismiss={() => {
                        setShowBidsDialog(false);
                      }}
                    />
                    <div
                      css={(t) =>
                        css({
                          '[role="list"]': {
                            // borderTop: "0.1rem solid",
                            // borderColor: t.colors.borderLight,
                            '[role="listitem"]': {
                              "::after, :first-of-type::before": {
                                pointerEvents: "none",
                                display: "block",
                                height: "1px",
                                width: "100%",
                                content: '""',
                                background: `linear-gradient(90deg, transparent 0%, ${t.colors.borderLight} 20%, ${t.colors.borderLight} 80%, transparent 100%)`,
                              },
                              ".container": {
                                display: "flex",
                                gap: "0.8rem",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "1.6rem 0",
                                ".account, .amount": {
                                  fontWeight: t.text.weights.emphasis,
                                  color: t.colors.textDimmed,
                                },
                                ".timestamp": {
                                  fontSize: t.text.sizes.small,
                                  color: t.colors.textDimmed,
                                },
                              },
                            },
                            a: {
                              textDecoration: "none",
                              "@media(hover: hover)": {
                                cursor: "pointer",
                                "&:hover": { textDecoration: "underline" },
                              },
                            },
                          },
                        })
                      }
                    >
                      {bids.length === 0 ? (
                        <>No bids</>
                      ) : (
                        <div role="list">
                          {arrayUtils
                            .sortBy(
                              { value: (b) => b.blockTimestamp, order: "desc" },
                              bids,
                            )
                            .map((bid) => (
                              <div role="listitem" key={bid.id}>
                                <div className="container">
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <AccountPreviewPopoverTrigger
                                      showAvatar
                                      accountAddress={bid.bidderId}
                                      className="account"
                                    />{" "}
                                    bid{" "}
                                    <ChainExporerTransactionLink
                                      transactionHash={bid.transactionHash}
                                      className="amount"
                                    >
                                      Ξ{formatEther(bid.amount)}
                                    </ChainExporerTransactionLink>
                                  </div>
                                  <ChainExporerTransactionLink
                                    transactionHash={bid.transactionHash}
                                    className="timestamp"
                                  >
                                    <FormattedDateWithTooltip
                                      tinyRelative
                                      relativeDayThreshold={7}
                                      month="short"
                                      day="numeric"
                                      year={
                                        getDateYear(bid.blockTimestamp) !==
                                        getDateYear(new Date())
                                          ? "numeric"
                                          : undefined
                                      }
                                      value={bid.blockTimestamp}
                                    />
                                  </ChainExporerTransactionLink>
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Dialog>
            )}
          </div>
        </div>
      </EmotionThemeProvider>
      {!isDesktopLayout && (
        <EmotionThemeProvider theme={preferredTheme}>
          <div
            css={(t) =>
              css({
                position: "relative",
                background: t.colors.dialogBackground,
                // boxShadow: t.shadows.elevationHigh,
                padding: "1.6rem",

                ".meta-container": {
                  fontSize: t.text.sizes.button,
                },

                ".bidding-form": {
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.2rem",
                  ".meta-container": {
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                  },
                  ".input-container": { padding: "0.8rem 1.4rem" },
                },
              })
            }
          >
            {biddingForm}

            {showBids && bids.length > 1 && (
              <div
                css={(t) =>
                  css({
                    padding: "1.6rem 0",
                    h2: {
                      fontSize: t.text.sizes.small,
                      textTransform: "uppercase",
                      fontWeight: t.text.weights.emphasis,
                      color: t.colors.textDimmed,
                      padding: "1.6rem 0",
                    },
                    '[role="list"]': {
                      borderTop: "0.1rem solid",
                      borderColor: t.colors.borderLight,
                      '[role="listitem"]': {
                        display: "flex",
                        gap: "0.8rem",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "1.6rem 0",
                        borderBottom: "0.1rem solid",
                        borderColor: t.colors.borderLight,
                        ".amount": {
                          fontSize: t.text.sizes.small,
                        },
                      },
                    },
                  })
                }
              >
                <h2>All bids</h2>
                <div role="list">
                  {arrayUtils
                    .sortBy(
                      { value: (b) => b.blockTimestamp, order: "desc" },
                      bids,
                    )
                    .map((bid) => (
                      <div role="listitem" key={bid.id}>
                        <div>
                          <AccountPreviewPopoverTrigger
                            showAvatar
                            accountAddress={bid.bidderId}
                            style={{ fontWeight: "400" }}
                          />
                        </div>
                        <div className="amount">Ξ{formatEther(bid.amount)}</div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </EmotionThemeProvider>
      )}
    </>
  );
};

const Now = ({ interval = 1000, children }) => {
  const [now, setNow] = React.useState(() => new Date().getTime());
  useInterval(
    () => {
      setNow(new Date().getTime());
    },
    { delay: interval, requireVisible: true },
  );
  return children(now);
};

const NounsSelect = ({ selectedNounId, auctionNounId, ...props }) => {
  const options =
    auctionNounId == null
      ? []
      : Array.from({ length: parseInt(auctionNounId) })
          .map((_, i) => ({
            label: `Noun ${i + 1}`,
            value: String(i + 1),
          }))
          .toReversed();

  return (
    <NativeSelect
      value={selectedNounId}
      options={options}
      selectProps={{ css: css({ cursor: "pointer" }) }}
      {...props}
    />
  );
};

export default AuctionDialog;
