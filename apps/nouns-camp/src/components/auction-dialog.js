"use client";

import getDateYear from "date-fns/getYear";
import { formatEther, parseEther } from "viem";
import React from "react";
import { css, ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import NextLink from "next/link";
import { useQuery } from "@tanstack/react-query";
import { array as arrayUtils } from "@shades/common/utils";
import { buildDataUriFromSeed as buildNounDataUriFromSeed } from "@shades/common/nouns";
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
import { useActions, useNoun } from "@/store";
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
  isEventTargetTextInputOrTextArea,
} from "@/hooks/keyboard-shortcuts";
import { useWallet } from "@/hooks/wallet";
import { useNounSeed } from "@/hooks/token-contract";
import { useGenerateSVGImage } from "@/hooks/nouns-token-descriptor-contract";
import AccountPreviewPopoverTrigger from "@/components/account-preview-popover-trigger";
import FormattedDateWithTooltip from "@/components/formatted-date-with-tooltip";
import ChainExporerTransactionLink from "@/components/chain-explorer-transaction-link";
import NativeSelect from "@/components/native-select";
import NounPreviewPopoverTrigger from "./noun-preview-popover-trigger";
import { FormattedEthWithConditionalTooltip as FormattedEth } from "./transaction-list";
import { useDialog } from "@/hooks/global-dialogs";
import { useSearchParams } from "@/hooks/navigation";

const chain = getSupportedChain(CHAIN_ID);

export const useAuctionData = ({
  nounId: customNounId,
  watch = false,
  enabled = true,
} = {}) => {
  const contractAuction = useContractAuction({
    watch,
    enabled: enabled && customNounId == null,
  });

  const { subgraphFetch } = useActions();

  const nounId = (() => {
    if (customNounId != null) return customNounId;
    if (contractAuction == null) return null;
    return String(contractAuction.nounId);
  })();

  const { data: isNounderReward } = useQuery({
    queryKey: ["auction", nounId],
    queryFn: async () => {
      const { noun, auction } = await subgraphFetch({
        query: `{
          noun(id: ${nounId}) {
            id
            seed {
              head
              glasses
              body
              background
              accessory
            }
            owner {
              id
              delegate { id }
            }
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

      const isNounderReward = noun != null && auction == null;

      return isNounderReward;
    },
    enabled: enabled && nounId != null,
  });

  const noun = useNoun(nounId);

  return React.useMemo(() => {
    if (nounId != null)
      return {
        noun,
        auction: noun?.auction,
        isNounderReward,
      };

    if (contractAuction == null) return {};

    const parseTimestamp = (unixSeconds) =>
      new Date(parseInt(unixSeconds) * 1000);

    return {
      noun,
      auction: {
        ...noun?.auction,
        ...contractAuction,
        nounId: parseInt(contractAuction.nounId),
        bidderId: contractAuction.bidder.toLowerCase(),
        amount: String(contractAuction.amount),
        startTimestamp: parseTimestamp(contractAuction.startTime),
        endTimestamp: parseTimestamp(contractAuction.endTime),
      },
      isNounderReward,
    };
  }, [nounId, noun, contractAuction, isNounderReward]);
};

export const useLazySeed = (nounId) => {
  const noun = useNoun(nounId);
  const currentContractSeed = useNounSeed(nounId, {
    enabled: noun?.seed == null,
  });
  const currentSeed = noun?.seed ?? currentContractSeed;
  const lastSeedRef = React.useRef(currentSeed);
  React.useEffect(() => {
    if (currentSeed != null) lastSeedRef.current = currentSeed;
  });
  return currentSeed ?? lastSeedRef.current;
};

const buildDataUriWithNounsSDK = (seed, { transparent = false } = {}) => {
  if (seed == null) return null;

  try {
    return buildNounDataUriFromSeed(seed, { transparent });
  } catch (e) {
    // This will throw if the nouns sdk package isn’t up-to-date with the
    // specified seed
    return null;
  }
};

export const useNounImageDataUri = (seed, { transparent = false } = {}) => {
  const nounsSDKDataUri = buildDataUriWithNounsSDK(seed, { transparent });

  const base64Svg = useGenerateSVGImage(seed, {
    // Fall back to onchain generation if local fails
    enabled: nounsSDKDataUri == null,
  });

  if (nounsSDKDataUri != null) return nounsSDKDataUri;
  return base64Svg == null ? null : `data:image/svg+xml;base64,${base64Svg}`;
};

const AuctionDialog = ({ isOpen, close }) => {
  const isDesktopLayout = useMatchMedia("(min-width: 600px)");
  const closeAndClearSearchState = () => {
    close({
      onSetSearchParams: (params) => {
        params.delete("ui");
        return params;
      },
    });
  };

  const { data, open } = useDialog("auction");

  const specifiedNounId = (() => {
    const customNounPrefix = "noun-";
    if (!data.startsWith(customNounPrefix)) return null; // Current auction
    const nounId = parseInt(data.slice(customNounPrefix.length));
    if (isNaN(nounId) || nounId < 0) return null;
    return nounId;
  })();

  const { auction: currentAuction } = useAuctionData();

  const nounId = specifiedNounId ?? currentAuction?.nounId;

  useKeyboardShortcuts(
    {
      ArrowLeft: (e) => {
        if (isEventTargetTextInputOrTextArea(e.target)) return;
        if (nounId === 0) {
          open("current");
          return;
        }
        if (nounId == null) return;
        open(`noun-${nounId - 1}`);
      },
      ArrowRight: (e) => {
        if (isEventTargetTextInputOrTextArea(e.target)) return;
        if (specifiedNounId == null) {
          open("noun-0");
          return;
        }
        if (nounId == null || currentAuction == null) return;
        const nextNounId = nounId + 1;
        open(
          nextNounId === currentAuction.nounId
            ? "current"
            : `noun-${nextNounId}`,
        );
      },
    },
    { enabled: isOpen },
  );

  return (
    <Dialog
      isOpen={isOpen}
      onRequestClose={closeAndClearSearchState}
      tray
      width="124.4rem"
      height="auto"
    >
      {({ titleProps }) => (
        <Auction
          nounId={specifiedNounId}
          nounContainerStyle={{
            flex: 1,
            minHeight: 0,
            paddingTop: isDesktopLayout ? 0 : "6rem",
          }}
        >
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
                  h1: { fontSize: t.text.sizes.base },
                })
              }
            >
              <div style={{ display: "flex", gap: "1px" }}>
                <Button
                  size="small"
                  variant="transparent"
                  css={css({ width: "2.8rem", padding: 0 })}
                  disabled={(() => {
                    const prevNounId = nounId - 1;
                    return prevNounId < 0 && currentAuction == null;
                  })()}
                  onClick={() => {
                    const prevNounId = nounId - 1;
                    if (prevNounId >= 0) {
                      open(`noun-${prevNounId}`);
                      return;
                    }
                    if (currentAuction == null) return;
                    open(`noun-${currentAuction.nounId}`);
                  }}
                >
                  &larr;
                </Button>
                <h1 {...titleProps}>
                  <NounsSelect
                    selectedNounId={nounId}
                    auctionNounId={currentAuction?.nounId}
                    onChange={(e) => {
                      const nounId = parseInt(e.target.value);
                      open(
                        nounId === currentAuction?.nounId
                          ? "current"
                          : `noun-${nounId}`,
                      );
                    }}
                    renderSelectedOption={(option) => (
                      <Button
                        size="small"
                        variant="transparent"
                        component="div"
                        className="trigger"
                        isLoading={nounId == null && option == null}
                      >
                        Noun {nounId ?? option?.value}
                      </Button>
                    )}
                    css={(t) =>
                      css({
                        display: "block",
                        "@media(hover: hover)": {
                          ":hover .trigger": {
                            background: t.colors.backgroundModifierNormal,
                          },
                        },
                      })
                    }
                  />
                </h1>
                <Button
                  size="small"
                  variant="transparent"
                  css={css({ width: "2.8rem", padding: 0 })}
                  disabled={currentAuction == null}
                  onClick={() => {
                    const nextNounId = nounId + 1;
                    open(
                      nextNounId === currentAuction.nounId
                        ? "current"
                        : `noun-${
                            nextNounId > currentAuction.nounId ? 0 : nextNounId
                          }`,
                    );
                  }}
                >
                  &rarr;
                </Button>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.8rem" }}>
              <Button
                component={NextLink}
                href={
                  specifiedNounId == null
                    ? "/auction"
                    : `/nouns/${specifiedNounId}`
                }
                prefetch
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
                onClick={closeAndClearSearchState}
                css={css({ width: "2.8rem", padding: 0 })}
              >
                <CrossIcon
                  style={{ width: "1.5rem", height: "auto", margin: "auto" }}
                />
              </Button>
            </div>
          </div>
        </Auction>
      )}
    </Dialog>
  );
};

export const Auction = ({
  nounId: eagerSpecifiedNounId,
  showBids = true,
  transparent = false,
  nounContainerStyle,
  children,
}) => {
  const inputRef = React.useRef();

  const {
    address: connectedWalletAccountAddress,
    chainId: connectedChainId,
    requestAccess: requestWalletAccess,
    switchToTargetChain: switchWalletToTargetChain,
  } = useWallet();

  const publicClient = usePublicClient();

  const [searchParams, setSearchParams] = useSearchParams();
  const preferredTheme = useThemePreferred();

  const isDesktopLayout = useMatchMedia("(min-width: 600px)");

  const specifiedNounId = React.useDeferredValue(eagerSpecifiedNounId);

  const {
    auction: customAuction,
    noun: customNoun,
    isNounderReward,
  } = useAuctionData({
    nounId: specifiedNounId,
    enabled: specifiedNounId != null,
  });
  const { auction: currentAuction, noun: currentNoun } = useAuctionData({
    watch: customAuction == null || !customAuction.settled,
  });
  const isCurrentAuction =
    specifiedNounId == null || specifiedNounId === currentAuction?.nounId;

  const auction = isCurrentAuction ? currentAuction : customAuction;
  const noun = isCurrentAuction ? currentNoun : customNoun;

  const bids = auction?.bids ?? [];

  const deferredAuctionNounId = React.useDeferredValue(auction?.nounId);

  // Defer noun id to prevent downstream performance issues
  const nounId = specifiedNounId ?? deferredAuctionNounId;

  const reservePrice = useReservePrice();
  const minBidIncrementPercentage = useMinBidIncrementPercentage();

  const seed = useLazySeed(nounId);

  const nounImageDataUri = useNounImageDataUri(seed, { transparent: true });

  const minBidValue = (() => {
    if (auction == null) return null;
    if (auction.amount == 0) return reservePrice;
    if (minBidIncrementPercentage == null || auction.amount == null)
      return null;
    const amount = BigInt(auction.amount);
    return amount + (amount / 100n) * BigInt(minBidIncrementPercentage);
  })();

  // Refence by noun id to prevent issues when switching between nouns
  // (speficifically when starting a new auction)
  const [pendingBidByNounId, setPendingBids] = React.useState(() => {
    if (minBidValue == null) return {};
    return { [nounId]: formatEther(minBidValue) };
  });
  const pendingBid = pendingBidByNounId[nounId];

  const hideUI = searchParams.get("ui") === "0";
  const setHideUI = (hide) =>
    setSearchParams(
      (params) => {
        const nextParams = new URLSearchParams(params);
        if (hide) {
          nextParams.set("ui", "0");
          return nextParams;
        }
        nextParams.delete("ui");
        return nextParams;
      },
      { replace: true },
    );

  // We hide simulation errors before the user first press submit to prevent
  // users not interested in bidding getting "insufficient funds" errors
  const [showBidSimulationErrors, setShowBidSimulationErrors] =
    React.useState(false);

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
      isCurrentAuction &&
      connectedWalletAccountAddress != null &&
      hasEnded &&
      !auction?.settled,
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

  const [showBidsDialog, setShowBidsDialog] = React.useState(false);
  const [showCountdown, setShowCountdown] = React.useState(true);

  const isConnectedToTargetChain = CHAIN_ID === connectedChainId;

  const buttonSize = isDesktopLayout ? "medium" : "large";

  const biddingForm = (
    <div className="bidding-form">
      <div
        className="meta-container"
        css={(t) =>
          css({
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
        {auction != null && !hasEnded && (
          <button
            onClick={() => {
              setShowCountdown((s) => !s);
            }}
            style={{ display: "block" }}
          >
            {showCountdown ? (
              <>
                Auction ends in{" "}
                <em>
                  <Now>
                    {(nowMillis) => {
                      if (auction.endTimestamp == null) return "...";

                      const secondsLeft = Math.max(
                        0,
                        Math.ceil(
                          (auction.endTimestamp.getTime() - nowMillis) / 1000,
                        ),
                      );

                      const hours = Math.floor(secondsLeft / 60 / 60);
                      const minutes = Math.floor(secondsLeft / 60) - hours * 60;
                      const seconds =
                        secondsLeft - hours * 60 * 60 - minutes * 60;

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
              </>
            ) : (
              <>
                Auction ends on{" "}
                <em>
                  <FormattedDateWithTooltip
                    disableRelative
                    month="short"
                    day="numeric"
                    hour="numeric"
                    minute="numeric"
                    second="numeric"
                    value={auction.endTimestamp}
                  />
                </em>
              </>
            )}
          </button>
        )}
        {(() => {
          const renderNounRepresentation = () => {
            const { delegateId, ownerId } = noun;
            const isDelegating =
              delegateId != null && ownerId != null && ownerId !== delegateId;
            return (
              <div>
                {isDelegating ? (
                  <>
                    Represented by{" "}
                    <AccountPreviewPopoverTrigger
                      showAvatar
                      accountAddress={delegateId}
                    />
                    , delegated from{" "}
                    <AccountPreviewPopoverTrigger
                      showAvatar
                      accountAddress={ownerId}
                    />
                  </>
                ) : (
                  <>
                    Represented and owned by{" "}
                    <AccountPreviewPopoverTrigger
                      showAvatar
                      accountAddress={ownerId}
                    />
                  </>
                )}
              </div>
            );
          };

          if (isNounderReward) {
            return (
              <>
                <div>
                  <NounPreviewPopoverTrigger
                    showAvatar={false}
                    nounId={nounId}
                  />{" "}
                  rewarded to Nounders
                </div>
                {renderNounRepresentation()}
              </>
            );
          }

          if (auction == null) return <div>&nbsp;</div>;

          if (auction.amount == 0)
            return (
              <div>
                {hasEnded ? "Auction ended without bids" : "No bids yet"}
              </div>
            );

          if (hasEnded)
            return (
              <>
                <div>
                  Auction{" "}
                  {!isDesktopLayout && (
                    <>
                      for <NounPreviewPopoverTrigger nounId={nounId} />{" "}
                    </>
                  )}
                  won by{" "}
                  <AccountPreviewPopoverTrigger
                    showAvatar
                    accountAddress={auction.bidderId}
                  />{" "}
                  (Ξ
                  <FormattedEth value={auction.amount} tokenSymbol={null} />) on{" "}
                  <FormattedDateWithTooltip
                    disableRelative
                    disableTooltip
                    month="short"
                    day="numeric"
                    year="numeric"
                    value={auction.endTimestamp}
                  />
                </div>
                {renderNounRepresentation()}
              </>
            );

          return (
            <div>
              Current bid:{" "}
              <em>
                Ξ<FormattedEth value={auction.amount} tokenSymbol={null} />
              </em>{" "}
              (by{" "}
              <AccountPreviewPopoverTrigger
                accountAddress={auction.bidderId}
                style={{ fontWeight: "400" }}
              />
              )
            </div>
          );
        })()}

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
        if (auction?.settled == null || auction.settled || isNounderReward)
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
        <div
          css={(t) =>
            css({
              transition: "0.2s background ease-out",
              background: t.colors.backgroundSecondary,
            })
          }
          style={{
            position: "sticky",
            top: 0,
            background: transparent
              ? "none"
              : seed == null
                ? undefined
                : parseInt(seed.background) === 0
                  ? "#d5d7e1"
                  : "#e1d7d5",
            ...nounContainerStyle,
          }}
        >
          <div
            css={(t) =>
              css({
                width: `calc(100vh - ${t.navBarHeight})`, // Needs to mirror tray dialog height
                maxWidth: "100%",
                margin: "0 auto",
                aspectRatio: "1/1",
                transition: "0.2s opacity ease-out",
                img: {
                  display: "block",
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  objectPosition: "bottom",
                },
              })
            }
            style={{ opacity: nounImageDataUri == null ? 0 : 1 }}
          >
            {nounImageDataUri != null && <img src={nounImageDataUri} />}
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
                  color: t.colors.textNormal,
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
                css={(t) =>
                  css({
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
                        color: t.colors.textDimmedAlpha,
                      },
                      ".input-container": {
                        maxWidth: "20rem",
                        ".input": { textAlign: "right" },
                      },
                    },
                  })
                }
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
                  {isDesktopLayout && bids.length > 0 && (
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
                  <Switch
                    label="Hide UI"
                    align="right"
                    isSelected={hideUI}
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
                </div>
                <div className="hideable">{biddingForm}</div>
              </div>
            )}

            {children}

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
                    <div>
                      {bids.length === 0 ? (
                        <>No bids</>
                      ) : (
                        <BidListing bids={bids} />
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

                ".bidding-form": {
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.2rem",
                  ".meta-container": {
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.8rem",
                    fontSize: t.text.sizes.button,
                    "em, .account-preview-trigger, .noun-preview-trigger": {
                      color: t.colors.textDimmed,
                      fontWeight: t.text.weights.emphasis,
                    },
                  },
                  ".input-container": { padding: "0.8rem 1.4rem" },
                },
              })
            }
          >
            {biddingForm}

            {showBids && bids.length > 0 && (
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
                  })
                }
              >
                <h2>All bids</h2>
                <BidListing bids={bids} />
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
      : Array.from({ length: auctionNounId + 1 })
          .map((_, i) => ({ label: `Noun ${i}`, value: String(i) }))
          .toReversed();

  return <NativeSelect value={selectedNounId} options={options} {...props} />;
};

const BidListing = ({ bids }) => (
  <div
    role="list"
    css={(t) =>
      css({
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
      })
    }
  >
    {arrayUtils
      .sortBy({ value: (b) => b.blockTimestamp, order: "desc" }, bids)
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
                Ξ<FormattedEth value={bid.amount} tokenSymbol={null} />
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
                  getDateYear(bid.blockTimestamp) !== getDateYear(new Date())
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
);

export default AuctionDialog;
