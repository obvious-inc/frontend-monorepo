"use client";

import { formatEther, parseEther } from "viem";
import React from "react";
import { css, ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import NextLink from "next/link";
import { useInterval, useMatchMedia } from "@shades/common/react";
import {
  Cross as CrossIcon,
  Fullscreen as FullscreenIcon,
} from "@shades/ui-web/icons";
import Dialog from "@shades/ui-web/dialog";
import Switch from "@shades/ui-web/switch";
import Spinner from "@shades/ui-web/spinner";
import Button from "@shades/ui-web/button";
import Input from "@shades/ui-web/input";
import { CHAIN_ID } from "@/constants/env";
import { getTheme } from "@/theme";
import { getChain as getSupportedChain } from "@/utils/chains";
import {
  useAuction,
  useReservePrice,
  useMinBidIncrementPercentage,
  useCreateBid,
  useSettleCurrentAndCreateNewAuction,
} from "@/hooks/auction-house-contract";
import useThemePreferred from "@/hooks/preferred-theme";
import { useWallet } from "@/hooks/wallet";
import { useNounSeed } from "@/hooks/token-contract";
import { useGenerateSVGImage } from "@/hooks/nouns-token-descriptor-contract";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger";

const chain = getSupportedChain(CHAIN_ID);

const AuctionDialog = ({ isOpen, close }) => {
  return (
    <Dialog
      isOpen={isOpen}
      onRequestClose={() => {
        close();
      }}
      tray
      width="124.4rem"
    >
      {({ titleProps }) => (
        <Auction style={{ flex: 1, minHeight: 0 }}>
          {({ auction }) => (
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
                  <h1 {...titleProps}>Noun {parseInt(auction.nounId)}</h1>
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
                  onClick={() => {
                    close();
                  }}
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

export const Auction = ({ children, ...props }) => {
  const inputRef = React.useRef();

  const {
    address: connectedWalletAccountAddress,
    chainId: connectedChainId,
    requestAccess: requestWalletAccess,
    switchToTargetChain: switchWalletToTargetChain,
  } = useWallet();

  const preferredTheme = useThemePreferred();

  const isDesktopLayout = useMatchMedia("(min-width: 600px)");

  const auction = useAuction({ watch: true });
  const reservePrice = useReservePrice();
  const minBidIncrementPercentage = useMinBidIncrementPercentage();

  const seed = useNounSeed(auction?.nounId);
  const base64Svg = useGenerateSVGImage(seed);

  const minBidValue = (() => {
    if (auction == null) return null;
    if (auction.amount == 0) return reservePrice;
    if (minBidIncrementPercentage == null) return null;
    return (
      auction.amount +
      (auction.amount / 100n) * BigInt(minBidIncrementPercentage)
    );
  })();

  const [pendingBidByNounId, setPendingBids] = React.useState(() => {
    if (minBidValue == null) return {};
    return { [auction.nounId]: formatEther(minBidValue) };
  });

  const [hideUI, setHideUI] = React.useState(false);

  const pendingBid = pendingBidByNounId[auction?.nounId];

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

  const hasEnded =
    auction != null && auction.endTime <= Math.ceil(Date.now() / 1000);

  const {
    call: createBid,
    callStatus: createBidCallStatus,
    callError: createBidCallError,
    simulationStatus: createBidSimulationStatus,
    simulationError: createBidSimulationError,
    receiptStatus: createBidReceiptStatus,
    receiptError: createBidReceiptError,
  } = useCreateBid({
    nounId: auction?.nounId,
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
    createBidReceiptError ?? createBidCallError ?? createBidSimulationError;

  const {
    call: settle,
    callStatus: settleCallStatus,
    callError: settleCallError,
    // simulationStatus: settleSimulationStatus,
    simulationError: settleSimulationError,
    receiptStatus: settleReceiptStatus,
    receiptError: settleReceiptError,
  } = useSettleCurrentAndCreateNewAuction({
    enabled: connectedWalletAccountAddress != null && hasEnded,
  });

  const hasPendingSettleReceipt =
    settleCallStatus === "success" && settleReceiptStatus === "pending";

  const settleError =
    settleReceiptError ?? settleCallError ?? settleSimulationError;

  React.useEffect(() => {
    if (auction == null) return;
    if (minBidValue != null && pendingBid == null)
      setPendingBids({ [auction.nounId]: formatEther(minBidValue) });
  }, [auction, pendingBid, minBidValue]);

  const isConnectedToTargetChain = CHAIN_ID === connectedChainId;

  const biddingForm = (
    <div className="bidding-form">
      <div
        className="meta-container"
        css={(t) =>
          css({
            color: t.colors.textDimmedAlpha,
            fontSize: t.text.sizes.base,
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
            "@media (min-width: 600px)": {
              fontSize: t.text.sizes.small,
              ".error": {
                width: "30rem",
                maxWidth: "100%",
                textAlign: "right",
              },
            },
          })
        }
      >
        {auction != null && !hasEnded && (
          <div>
            Auction ends in{" "}
            <em>
              <Now>
                {(nowMillis) => {
                  // TODO: auction end behavior
                  const secondsLeft = Math.max(
                    0,
                    auction.endTime - Math.ceil(nowMillis / 1000),
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

            if (auction.amount == 0)
              return hasEnded ? "Auction ended without bids" : "No bids yet";

            if (hasEnded)
              return (
                <>
                  Auction won by{" "}
                  <AccountPreviewPopoverTrigger
                    showAvatar
                    accountAddress={auction.bidder}
                  />{" "}
                  (Ξ{formatEther(auction.amount)})
                </>
              );

            return (
              <>
                Current bid: <em>Ξ{formatEther(auction.amount)}</em> (by{" "}
                <AccountPreviewPopoverTrigger
                  accountAddress={auction.bidder}
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
                Transaction submitted. Awaiting receipt
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

      {connectedWalletAccountAddress == null ? (
        <Button
          onClick={() => {
            requestWalletAccess();
          }}
        >
          Connect wallet to participate
        </Button>
      ) : !isConnectedToTargetChain ? (
        <Button
          onClick={() => {
            switchWalletToTargetChain();
          }}
        >
          Switch to {CHAIN_ID === 1 ? "Mainnet" : chain.name} to interact with
          auction
        </Button>
      ) : hasEnded ? (
        <Button
          size="default"
          disabled={
            settle == null ||
            settleCallStatus === "pending" ||
            hasPendingSettleReceipt
          }
          isLoading={settleCallStatus === "pending" || hasPendingSettleReceipt}
          onClick={() => {
            settle();
          }}
        >
          Settle and start the next auction
        </Button>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await createBid();
            setPendingBids({ [auction.nounId]: "" });
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
                setPendingBids({ [auction.nounId]: e.target.value.trim() });
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
                <Spinner size="1.25rem" />
              </div>
            </div>
          </Input>
          <Button
            className="submit-button"
            size="default"
            type="submit"
            disabled={
              !isBidValid ||
              createBid == null ||
              createBidCallStatus === "pending"
            }
            isLoading={createBidCallStatus === "pending"}
          >
            Place bid
          </Button>
        </form>
      )}
    </div>
  );

  return (
    <>
      <EmotionThemeProvider theme={getTheme("light")}>
        <div css={css({ position: "relative" })} {...props}>
          <div
            css={(t) =>
              css({
                transition: "0.2s background ease-out",
                background: t.colors.backgroundSecondary,
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
              background:
                seed == null
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
                      maxWidth: "16rem",
                      ".input": { textAlign: "right" },
                    },
                  },
                })}
              >
                <div
                  className="hover-hideable"
                  style={{ flex: 1, minWidth: 0 }}
                >
                  <Switch
                    size="small"
                    label="Hide UI"
                    value={hideUI}
                    onChange={setHideUI}
                    css={(t) =>
                      css({
                        ":not([data-selected])": { color: t.colors.textDimmed },
                      })
                    }
                  />
                </div>
                <div className="hideable">{biddingForm}</div>
              </div>
            )}

            {children?.({ auction })}
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

                ".text": {
                  color: t.colors.textDimmedAlpha,
                  fontSize: t.text.sizes.small,
                  em: {
                    fontStyle: "normal",
                    fontWeight: t.text.weights.emphasis,
                  },
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
                },
              })
            }
          >
            {biddingForm}
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

export default AuctionDialog;
