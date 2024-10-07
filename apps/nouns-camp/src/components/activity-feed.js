import getDateYear from "date-fns/getYear";
import React from "react";
import NextLink from "next/link";
import { css, keyframes } from "@emotion/react";
import { array as arrayUtils } from "@shades/common/utils";
import { useHasBeenOnScreen } from "@shades/common/react";
import Spinner from "@shades/ui-web/spinner";
import Link from "@shades/ui-web/link";
import Avatar from "@shades/ui-web/avatar";
import * as Tooltip from "@shades/ui-web/tooltip";
import { FarcasterGate as FarcasterGateIcon } from "@shades/ui-web/icons";
import { resolveIdentifier as resolveContractIdentifier } from "../contracts.js";
import { isSucceededState as isSucceededProposalState } from "../utils/proposals.js";
import {
  extractSlugFromId as extractSlugFromCandidateId,
  makeUrlId as makeCandidateUrlId,
} from "../utils/candidates.js";
import { useWallet } from "../hooks/wallet.js";
import { useState as useSessionState } from "@/session-provider";
import useAccountDisplayName from "../hooks/account-display-name.js";
import { useDialog } from "../hooks/global-dialogs.js";
import {
  useDelegate,
  useNoun,
  useProposal,
  useProposalCandidate,
} from "../store.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import AccountAvatar from "./account-avatar.js";
import MarkdownRichText from "./markdown-rich-text.js";
import NounPreviewPopoverTrigger from "./noun-preview-popover-trigger.js";
import NounsPreviewPopoverTrigger from "./nouns-preview-popover-trigger.js";
import { useTransferMeta as useNounTransferMeta } from "@/hooks/noun-transfers";
import {
  useAccountsWithVerifiedEthAddress as useFarcasterAccountsWithVerifiedEthAddress,
  useSubmitTransactionLike,
  useSubmitCastLike,
  useTransactionLikes as useFarcasterTransactionLikes,
  useCastLikes as useFarcasterCastLikes,
  useCastConversation as useFarcasterCastConversation,
} from "../hooks/farcaster.js";
import { FormattedEthWithConditionalTooltip } from "./transaction-list.js";
import { buildEtherscanLink } from "../utils/etherscan.js";
import { isTransactionHash } from "../utils/transactions.js";

const BODY_TRUNCATION_HEIGHT_THRESHOLD = 250;

const heartBounceAnimation = keyframes({
  "0%": { transform: "scale(1)" },
  "25%": { transform: "scale(1.2)" },
  "50%": { transform: "scale(0.95)" },
  "100%": { transform: "scale(1)" },
});
// const colorFadeAnimation = keyframes({
//   "0%": { color: "var(--initial-color)" },
//   "50%": { color: "var(--initial-color)" },
//   "100%": { color: "var(--settle-color)" },
// });

const buildTimestampLink = (item) => {
  if (item.type === "farcaster-cast") {
    if (item.authorUsername == null) return null;
    return `https://warpcast.com/${item.authorUsername}/${item.id}`;
  }

  if (
    item.eventType === "propdate-posted" ||
    item.eventType === "propdate-marked-completed"
  ) {
    // the id is what comes after "propdate-"
    const propdateId = item.id.slice(9);
    return `https://www.updates.wtf/update/${propdateId}`;
  }

  if (!isTransactionHash(item.transactionHash)) return null;

  return buildEtherscanLink(`/tx/${item.transactionHash}`);
};

const ActivityFeed = ({
  context, // "proposal" | "candidate" | null
  items = [],
  spacing = "2rem",
  onReply,
  onRepost,
  createReplyHref,
  createRepostHref,
}) => {
  const { address: connectedAccountAddress } = useWallet();
  const { address: loggedInAccountAddress } = useSessionState();
  const userAccountAddress = connectedAccountAddress ?? loggedInAccountAddress;
  const userAccountDelegate = useDelegate(userAccountAddress);
  const submitTransactionLike = useSubmitTransactionLike();
  const submitCastLike = useSubmitCastLike();
  const {
    open: openFarcasterSetupDialog,
    preload: preloadFarcasterSetupDialog,
  } = useDialog("farcaster-setup");
  const {
    open: openAuthenticationDialog,
    preload: preloadAuthenticationDialog,
  } = useDialog("account-authentication");
  const userFarcasterAccount =
    useFarcasterAccountsWithVerifiedEthAddress(userAccountAddress)?.[0];

  const like = React.useCallback(
    async (itemId, action) => {
      const item = items.find((i) => i.id === itemId);
      try {
        if (item.transactionHash != null) {
          await submitTransactionLike({
            transactionHash: item.transactionHash,
            fid: userFarcasterAccount.fid,
            action,
          });
        } else if (item.castHash != null) {
          await submitCastLike({
            targetCastId: { fid: item.authorFid, hash: item.castHash },
            fid: userFarcasterAccount.fid,
            action,
          });
        } else {
          console.error("Invalid like target", item);
          throw new Error();
        }
      } catch (e) {
        console.error(e);
        alert("Ops, looks like something went wrong!");
      }
    },
    [items, userFarcasterAccount?.fid, submitTransactionLike, submitCastLike],
  );

  // Enable the like action if there’s a delegate entry for the user’s
  // account, or if there’s a delegate entry for a verified address on the
  // user’s Farcaster account
  const allowLikeAction =
    userAccountDelegate != null || userFarcasterAccount?.nounerAddress != null;

  const hasFarcasterAccountKey =
    userFarcasterAccount != null && userFarcasterAccount.hasAccountKey;
  const requireAuthentication =
    loggedInAccountAddress == null ||
    // If the user is connected and logged in with different addresses they
    // likely want to like as the connected one
    (connectedAccountAddress != null &&
      connectedAccountAddress !== loggedInAccountAddress);

  const onLike = (() => {
    // Wait for a wallet connection before we rule out likes
    if (connectedAccountAddress != null && !allowLikeAction) return null;
    if (!hasFarcasterAccountKey)
      return () => openFarcasterSetupDialog({ intent: "like" });
    if (requireAuthentication)
      return (...args) => {
        openAuthenticationDialog({
          intent: "like",
          onSuccess: () => like(...args),
        });
      };
    return like;
  })();

  React.useEffect(() => {
    if (!allowLikeAction) return;

    if (!hasFarcasterAccountKey) {
      preloadFarcasterSetupDialog();
      return;
    }
    if (requireAuthentication) {
      preloadAuthenticationDialog();
      return;
    }
  }, [
    allowLikeAction,
    hasFarcasterAccountKey,
    requireAuthentication,
    preloadFarcasterSetupDialog,
    preloadAuthenticationDialog,
  ]);

  return (
    <ul
      css={(t) =>
        css({
          lineHeight: "calc(20/14)", // 20px line height given font size if 14px
          fontSize: t.text.sizes.base,
          '[role="listitem"]': {
            scrollMargin: "calc(3.2rem + 1.6rem) 0",
          },
          '[role="listitem"] + [role="listitem"]': {
            marginTop: "var(--vertical-spacing)",
          },
          '[data-pending="true"]': { opacity: 0.6 },
          "[data-nowrap]": { whiteSpace: "nowrap" },
          "[data-header]": {
            display: "grid",
            gridTemplateColumns: "2rem minmax(0,1fr)",
            gridGap: "0.6rem",
            alignItems: "flex-start",
            a: {
              color: t.colors.textDimmed,
              fontWeight: t.text.weights.emphasis,
              textDecoration: "none",
              "@media(hover: hover)": {
                ":hover": { textDecoration: "underline" },
              },
            },
          },
          "[data-avatar-button]": {
            display: "block",
            outline: "none",
            ":focus-visible [data-avatar]": {
              boxShadow: t.shadows.focus,
              background: t.colors.backgroundModifierHover,
            },
            "@media (hover: hover)": {
              ":not(:disabled)": {
                cursor: "pointer",
                ":hover [data-avatar]": {
                  boxShadow: `0 0 0 0.2rem ${t.colors.backgroundModifierHover}`,
                },
              },
            },
          },
          "[data-timeline-symbol]": {
            position: "relative",
            height: "2rem",
            width: "0.1rem",
            background: t.colors.borderLight,
            zIndex: -1,
            margin: "auto",
            ":after": {
              content: '""',
              position: "absolute",
              width: "0.7rem",
              height: "0.7rem",
              background: t.colors.textMuted,
              top: "50%",
              left: "50%",
              transform: "translateY(-50%) translateX(-50%)",
              borderRadius: "50%",
              border: "0.1rem solid",
              borderColor: t.colors.backgroundPrimary,
            },
          },
        })
      }
      style={{ "--vertical-spacing": spacing }}
    >
      {items.map((item) => (
        <FeedItem
          key={item.id}
          {...item}
          context={context}
          onReply={onReply}
          onRepost={onRepost}
          onLike={onLike}
          createReplyHref={createReplyHref}
          createRepostHref={createRepostHref}
        />
      ))}
    </ul>
  );
};

const FeedItem = React.memo(
  ({
    context,
    onReply,
    onRepost,
    onLike,
    createReplyHref,
    createRepostHref,
    ...item
  }) => {
    const { address: connectedAccount_ } = useWallet();
    const { address: loggedInAccount } = useSessionState();
    const userAccountAddress = connectedAccount_ ?? loggedInAccount;
    const userFarcasterAccount =
      useFarcasterAccountsWithVerifiedEthAddress(userAccountAddress)?.[0];

    const containerRef = React.useRef();
    const isOnScreen = useHasBeenOnScreen(containerRef, {
      rootMargin: "0px 0px 200%",
    });

    const transactionLikes = useFarcasterTransactionLikes(
      item.transactionHash,
      { enabled: isOnScreen },
    );
    const castLikes = useFarcasterCastLikes(item.castHash, {
      enabled: isOnScreen,
    });
    const replyCasts = useFarcasterCastConversation(item.castHash, {
      enabled: isOnScreen,
    });

    const nounTransferMeta = useNounTransferMeta(item.transactionHash, {
      enabled: item.type === "noun-transfer" && isOnScreen,
    });

    const authorReplyCasts = (() => {
      if (replyCasts == null) return null;
      const flatten = (casts) =>
        casts.flatMap((c) => [c, ...flatten(c.replies)]);
      return flatten(replyCasts).filter((c) => c.fid === item.authorFid);
    })();

    const likes = transactionLikes ?? castLikes;

    const isIsolatedContext = ["proposal", "candidate"].includes(context);
    const itemBody = nounTransferMeta?.reason ?? item.body;
    const hasBody = itemBody != null && itemBody.trim() !== "";
    const hasReason = item.reason != null && item.reason.trim() !== "";

    const hasReposts = item.reposts?.length > 0;
    const hasLikes = likes?.length > 0;
    const hasBeenReposted = item.repostingItems?.length > 0;

    const hasLiked = likes?.some(
      (l) =>
        l.nounerAddress === userAccountAddress ||
        l.fid === userFarcasterAccount?.fid,
    );

    const showReplyAction = (() => {
      // Casts simply link to Warpcast for now
      if (item.type === "farcaster-cast") return true;
      if (onReply == null && createReplyHref == null) return false;
      return ["vote", "feedback-post"].includes(item.type) && hasReason;
    })();

    const showRepostAction =
      (onRepost != null || createRepostHref != null) &&
      ["vote", "feedback-post"].includes(item.type) &&
      hasReason;

    const showLikeAction = (() => {
      if (onLike == null) return false;

      // Items always likeable
      if (item.type === "farcaster-cast") return true;

      // Items not likeable
      if (
        ["auction-bid", "noun-transfer", "noun-delegation"].includes(
          item.type,
        ) ||
        ["proposal-queued"].includes(item.eventType)
      )
        return false;

      // Items likeable if body present
      if (
        ["candidate-signature"].includes(item.type) ||
        ["candidate-updated", "proposal-updated"].includes(item.eventType)
      )
        return hasBody;

      // Items likeable if reason present (revotes have reason but no body)
      if (["vote", "feedback-post"].includes(item.type)) return hasReason;

      // The rest can be liked if they have a tx hash
      return item.transactionHash != null;
    })();

    const enableReplyAction = !item.isPending;
    const enableRepostAction = !item.isPending;
    const enableLikeAction = !item.isPending;

    const showActionBar = showReplyAction || showRepostAction || showLikeAction;
    const showMeta =
      hasLikes || hasBeenReposted || item.type === "farcaster-cast";

    const renderTimestamp = (item) => {
      const timestampLink = buildTimestampLink(item);

      const formattedDate = (
        <FormattedDateWithTooltip
          tinyRelative
          relativeDayThreshold={7}
          month="short"
          day="numeric"
          year={
            getDateYear(item.timestamp) !== getDateYear(new Date())
              ? "numeric"
              : undefined
          }
          value={item.timestamp}
        />
      );

      return (
        <span
          data-timestamp
          css={(t) =>
            css({
              fontSize: t.text.sizes.small,
              color: t.colors.textDimmed,
              padding: "0.15rem 0",
              display: "inline-block",
            })
          }
        >
          {timestampLink ? (
            <a
              href={timestampLink}
              target="_blank"
              rel="noopener noreferrer"
              css={css({ fontWeight: "normal !important" })}
            >
              {formattedDate}
            </a>
          ) : (
            formattedDate
          )}
        </span>
      );
    };

    return (
      <div
        ref={containerRef}
        id={item.id}
        role="listitem"
        data-pending={item.isPending}
      >
        <div data-header>
          <div>
            {(() => {
              switch (item.type) {
                case "farcaster-cast":
                  return (
                    <div style={{ position: "relative" }}>
                      {item.authorAccount == null ? (
                        <Avatar url={item.authorAvatarUrl} size="2rem" />
                      ) : (
                        <AccountPreviewPopoverTrigger
                          accountAddress={item.authorAccount}
                        >
                          <button data-avatar-button>
                            <AccountAvatar
                              address={item.authorAccount}
                              fallbackImageUrl={item.authorAvatarUrl}
                              size="2rem"
                            />
                          </button>
                        </AccountPreviewPopoverTrigger>
                      )}
                      <span
                        css={(t) =>
                          css({
                            position: "absolute",
                            top: 0,
                            right: 0,
                            display: "flex",
                            width: "1rem",
                            height: "1rem",
                            borderRadius: "50%",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#855DCD", // Farcaster purple
                            transform: "translateY(-35%) translateX(35%)",
                            boxShadow: `0 0 0 0.15rem ${t.colors.backgroundPrimary}`,
                            svg: {
                              width: "0.6rem",
                              height: "auto",
                              color: "white",
                            },
                          })
                        }
                      >
                        <FarcasterGateIcon />
                      </span>
                    </div>
                  );

                case "noun-transfer": {
                  if (nounTransferMeta == null) return null;

                  const authorAccount = {
                    "fork-join": item.fromAccount,
                    "fork-escrow": item.fromAccount,
                    "fork-escrow-withdrawal": item.toAccount,
                    swap: nounTransferMeta.authorAccount,
                    sale: nounTransferMeta.authorAccount,
                    transfer: nounTransferMeta.authorAccount,
                  }[nounTransferMeta.transferType];

                  if (authorAccount == null)
                    return <div data-timeline-symbol />;

                  return (
                    <AccountPreviewPopoverTrigger
                      accountAddress={authorAccount}
                    >
                      <button data-avatar-button>
                        <AccountAvatar address={authorAccount} size="2rem" />
                      </button>
                    </AccountPreviewPopoverTrigger>
                  );
                }

                case "event":
                  if (item.eventType === "auction-settled")
                    return (
                      <AccountPreviewPopoverTrigger
                        accountAddress={item.bidderAccount}
                      >
                        <button data-avatar-button>
                          <AccountAvatar
                            address={item.bidderAccount}
                            size="2rem"
                          />
                        </button>
                      </AccountPreviewPopoverTrigger>
                    );

                  return <div data-timeline-symbol />;

                default:
                  return item.authorAccount == null ? (
                    <div data-timeline-symbol />
                  ) : (
                    <AccountPreviewPopoverTrigger
                      accountAddress={item.authorAccount}
                    >
                      <button data-avatar-button>
                        <AccountAvatar
                          address={item.authorAccount}
                          size="2rem"
                        />
                      </button>
                    </AccountPreviewPopoverTrigger>
                  );
              }
            })()}
          </div>
          <div>
            <div
              css={css({
                display: "flex",
                alignItems: "flex-start",
                gap: "1rem",
                cursor: "default",
              })}
            >
              <div
                css={(t) =>
                  css({ flex: 1, minWidth: 0, color: t.colors.textDimmed })
                }
              >
                <ItemTitle
                  item={item}
                  context={context}
                  isOnScreen={isOnScreen}
                />
              </div>
              <div>
                {item.isPending ? (
                  <div style={{ padding: "0.5rem 0" }}>
                    <Spinner size="1rem" />
                  </div>
                ) : (
                  item.timestamp != null && renderTimestamp(item)
                )}
              </div>
            </div>
          </div>
        </div>
        <div css={css({ paddingLeft: "2.6rem", userSelect: "text" })}>
          {item.replies?.length > 0 && (
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
                  ".body-container": {
                    padding: "0.4em 0 0 0.2em",
                  },
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
              style={{
                marginTop: "0.8rem",
                marginBottom: hasReposts || hasBody ? "1.6rem" : 0,
              }}
            >
              {item.replies.map(({ body, target }) => (
                <li key={target.id}>
                  <div css={css({ fontSize: "0.875em" })}>
                    <QuotedVoteOrFeedbackPost
                      item={target}
                      href={(() => {
                        if (isIsolatedContext) return `#${target.id}`;
                        if (target.proposalId != null)
                          return `/proposals/${target.proposalId}?tab=activity#${target.id}`;
                        if (target.candidateId != null)
                          return `/candidates/${encodeURIComponent(
                            makeCandidateUrlId(target.candidateId),
                          )}?tab=activity${target.id}`;
                        console.error("Invalid reply target", target);
                        return null;
                      })()}
                    />
                  </div>
                  <div className="reply-area">
                    <div className="reply-line-container">
                      <div className="reply-line" />
                    </div>
                    <div className="body-container">
                      <MarkdownRichText
                        text={body}
                        // displayImages={displayImages}
                        compact
                        css={css({
                          // Make all headings small
                          "h1,h2,h3,h4,h5,h6": { fontSize: "1em" },
                          "*+h1,*+h2,*+h3,*+h4,*+h5,*+h6": {
                            marginTop: "1.5em",
                          },
                          "h1:has(+*),h2:has(+*),h3:has(+*),h4:has(+*),h5:has(+*),h6:has(+*)":
                            {
                              marginBottom: "0.625em",
                            },
                        })}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {item.reposts?.length > 0 && (
            <ul
              css={css({
                listStyle: "none",
                fontSize: "0.875em",
                marginBottom: "0.8rem",
                "li + li": { marginTop: "0.6rem" },
              })}
              // style={{ marginTop: hasMultiParagraphBody ? "0.8rem" : "0.4rem" }}
              style={{ marginTop: "0.8rem" }}
            >
              {item.reposts.map((voteOrFeedbackPost) => (
                <li key={voteOrFeedbackPost.id}>
                  <QuotedVoteOrFeedbackPost
                    item={voteOrFeedbackPost}
                    href={(() => {
                      if (isIsolatedContext) return `#${voteOrFeedbackPost.id}`;
                      if (voteOrFeedbackPost.proposalId != null)
                        return `/proposals/${voteOrFeedbackPost.proposalId}?tab=activity#${voteOrFeedbackPost.id}`;
                      if (voteOrFeedbackPost.candidateId != null)
                        return `/candidates/${encodeURIComponent(
                          makeCandidateUrlId(voteOrFeedbackPost.candidateId),
                        )}?tab=activity${voteOrFeedbackPost.id}`;
                      console.error(
                        "Invalid repost target",
                        voteOrFeedbackPost,
                      );
                      return null;
                    })()}
                  />
                </li>
              ))}
            </ul>
          )}
          {hasBody && (
            <ItemBody
              text={itemBody}
              displayImages={item.type === "event"}
              truncateLines={!isIsolatedContext}
            />
          )}
          {authorReplyCasts?.map((cast) => (
            <ItemBody key={cast.hash} text={cast.text} />
          ))}
          {item.type === "candidate-signature" && (
            <div
              css={(t) =>
                css({
                  fontSize: t.text.sizes.small,
                  color: t.colors.textDimmed,
                })
              }
            >
              {item.isCanceled ? (
                "Signature canceled"
              ) : (
                <>
                  {item.expiresAt < new Date()
                    ? "Signature expired"
                    : "Signature expires"}{" "}
                  <FormattedDateWithTooltip
                    capitalize={false}
                    value={item.expiresAt}
                    month="short"
                    day="numeric"
                  />
                </>
              )}
            </div>
          )}
          {showActionBar && (
            <div
              css={(t) =>
                css({
                  display: "flex",
                  gap: "0.8rem",
                  margin: "0.6rem -0.4rem 0",
                  "& > button, & > a": {
                    padding: "0.4rem",
                    color: t.colors.textDimmed,
                    ":disabled": {
                      color: t.colors.textMuted,
                    },
                    "@media(hover: hover)": {
                      ":not(:disabled)": {
                        cursor: "pointer",
                        ":hover": {
                          color: t.colors.textAccent,
                        },
                      },
                    },
                  },
                })
              }
            >
              {showReplyAction &&
                (() => {
                  const [Component, props] =
                    item.type === "farcaster-cast"
                      ? [
                          "a",
                          {
                            href: `https://warpcast.com/${item.authorUsername}/${item.castHash}`,
                            target: "_blank",
                            rel: "noreferrer",
                          },
                        ]
                      : createReplyHref != null
                        ? [NextLink, { href: createReplyHref(item) }]
                        : ["button", { onClick: () => onReply(item.id) }];

                  return (
                    <Component {...props} disabled={!enableReplyAction}>
                      <svg
                        aria-label="Reply"
                        role="img"
                        viewBox="0 0 18 18"
                        stroke="currentColor"
                        fill="transparent"
                        style={{ width: "1.4rem", height: "auto" }}
                      >
                        <path
                          d="M15.376 13.2177L16.2861 16.7955L12.7106 15.8848C12.6781 15.8848 12.6131 15.8848 12.5806 15.8848C11.3779 16.5678 9.94767 16.8931 8.41995 16.7955C4.94194 16.5353 2.08152 13.7381 1.72397 10.2578C1.2689 5.63919 5.13697 1.76863 9.75264 2.22399C13.2307 2.58177 16.0261 5.41151 16.2861 8.92429C16.4161 10.453 16.0586 11.8841 15.376 13.0876C15.376 13.1526 15.376 13.1852 15.376 13.2177Z"
                          strokeLinejoin="round"
                          strokeWidth="1.25"
                        />
                      </svg>
                    </Component>
                  );
                })()}
              {showRepostAction &&
                (() => {
                  const [Component, props] =
                    createRepostHref != null
                      ? [NextLink, { href: createRepostHref(item) }]
                      : ["button", { onClick: () => onRepost(item.id) }];

                  return (
                    <Component {...props} disabled={!enableRepostAction}>
                      <svg
                        aria-label="Repost"
                        viewBox="0 0 18 18"
                        fill="currentColor"
                        style={{ width: "1.4rem", height: "auto" }}
                      >
                        <path d="M6.41256 1.23531C6.6349 0.971277 7.02918 0.937481 7.29321 1.15982L9.96509 3.40982C10.1022 3.52528 10.1831 3.69404 10.1873 3.87324C10.1915 4.05243 10.1186 4.2248 9.98706 4.34656L7.31518 6.81971C7.06186 7.05419 6.66643 7.03892 6.43196 6.7856C6.19748 6.53228 6.21275 6.13685 6.46607 5.90237L7.9672 4.51289H5.20312C3.68434 4.51289 2.45312 5.74411 2.45312 7.26289V9.51289V11.7629C2.45312 13.2817 3.68434 14.5129 5.20312 14.5129C5.5483 14.5129 5.82812 14.7927 5.82812 15.1379C5.82812 15.4831 5.5483 15.7629 5.20312 15.7629C2.99399 15.7629 1.20312 13.972 1.20312 11.7629V9.51289V7.26289C1.20312 5.05375 2.99399 3.26289 5.20312 3.26289H7.85002L6.48804 2.11596C6.22401 1.89362 6.19021 1.49934 6.41256 1.23531Z" />
                        <path d="M11.5874 17.7904C11.3651 18.0545 10.9708 18.0883 10.7068 17.8659L8.03491 15.6159C7.89781 15.5005 7.81687 15.3317 7.81267 15.1525C7.80847 14.9733 7.8814 14.801 8.01294 14.6792L10.6848 12.206C10.9381 11.9716 11.3336 11.9868 11.568 12.2402C11.8025 12.4935 11.7872 12.8889 11.5339 13.1234L10.0328 14.5129H12.7969C14.3157 14.5129 15.5469 13.2816 15.5469 11.7629V9.51286V7.26286C15.5469 5.74408 14.3157 4.51286 12.7969 4.51286C12.4517 4.51286 12.1719 4.23304 12.1719 3.88786C12.1719 3.54269 12.4517 3.26286 12.7969 3.26286C15.006 3.26286 16.7969 5.05373 16.7969 7.26286V9.51286V11.7629C16.7969 13.972 15.006 15.7629 12.7969 15.7629H10.15L11.512 16.9098C11.776 17.1321 11.8098 17.5264 11.5874 17.7904Z" />
                      </svg>
                    </Component>
                  );
                })()}
              {showLikeAction && (
                <button
                  data-liked={hasLiked}
                  onClick={(e) => {
                    onLike(item.id, hasLiked ? "remove" : "add");
                    e.currentTarget.dataset.clicked = "true";
                  }}
                  disabled={!enableLikeAction}
                  css={(t) =>
                    css({
                      '&[data-liked="true"]': {
                        color: t.colors.red,
                        "@media(hover: hover)": {
                          ":not(:disabled):hover": {
                            color: t.colors.red,
                          },
                        },
                        '&[data-clicked="true"]': {
                          animationName: heartBounceAnimation,
                          animationDuration: "0.45s",
                          animationTimingFunction: "ease-in-out",
                        },
                      },
                    })
                  }
                >
                  <svg
                    aria-label="Like"
                    role="img"
                    viewBox="0 0 18 18"
                    fill={hasLiked ? "currentColor" : "transparent"}
                    stroke="currentColor"
                    style={{ width: "1.4rem", height: "auto" }}
                  >
                    <path
                      d="M1.34375 7.53125L1.34375 7.54043C1.34374 8.04211 1.34372 8.76295 1.6611 9.65585C1.9795 10.5516 2.60026 11.5779 3.77681 12.7544C5.59273 14.5704 7.58105 16.0215 8.33387 16.5497C8.73525 16.8313 9.26573 16.8313 9.66705 16.5496C10.4197 16.0213 12.4074 14.5703 14.2232 12.7544C15.3997 11.5779 16.0205 10.5516 16.3389 9.65585C16.6563 8.76296 16.6563 8.04211 16.6562 7.54043V7.53125C16.6562 5.23466 15.0849 3.25 12.6562 3.25C11.5214 3.25 10.6433 3.78244 9.99228 4.45476C9.59009 4.87012 9.26356 5.3491 9 5.81533C8.73645 5.3491 8.40991 4.87012 8.00772 4.45476C7.35672 3.78244 6.47861 3.25 5.34375 3.25C2.9151 3.25 1.34375 5.23466 1.34375 7.53125Z"
                      strokeWidth="1.25"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}
          {showMeta && (
            <div
              css={(t) =>
                css({
                  marginTop: "0.6rem",
                  color: t.colors.textDimmed,
                  fontSize: t.text.sizes.small,
                  a: {
                    color: "inherit",
                    textDecoration: "none",
                    "@media(hover: hover)": {
                      "&:hover": { textDecoration: "underline" },
                    },
                  },
                })
              }
            >
              {!isOnScreen ? (
                <>&nbsp;</>
              ) : (
                [
                  item.repostingItems?.length > 0 && {
                    key: "reposts",
                    element: (
                      <Tooltip.Root>
                        <Tooltip.Trigger>
                          {item.repostingItems.length}{" "}
                          {item.repostingItems.length === 1
                            ? "repost"
                            : "reposts"}
                        </Tooltip.Trigger>
                        <Tooltip.Content sideOffset={4}>
                          {item.repostingItems.map((item, i) => (
                            <React.Fragment key={item.id}>
                              {i > 0 && <br />}
                              <AccountDisplayName
                                address={item.authorAccount}
                              />
                            </React.Fragment>
                          ))}
                        </Tooltip.Content>
                      </Tooltip.Root>
                    ),
                  },
                  likes?.length > 0 && {
                    key: "likes",
                    element: (
                      <Tooltip.Root>
                        <Tooltip.Trigger>
                          {likes.length} {likes.length === 1 ? "like" : "likes"}
                        </Tooltip.Trigger>
                        <Tooltip.Content sideOffset={4}>
                          {arrayUtils
                            .sortBy(
                              {
                                value: (a) =>
                                  a.votingPower == null
                                    ? Infinity
                                    : a.votingPower,
                                order: "desc",
                              },
                              likes,
                            )
                            .map((farcasterAccount, i) => (
                              <React.Fragment key={farcasterAccount.fid}>
                                <span
                                  data-voting-power={
                                    farcasterAccount.votingPower
                                  }
                                  css={(t) =>
                                    css({
                                      '&[data-voting-power="0"]': {
                                        color: t.colors.textDimmed,
                                      },
                                    })
                                  }
                                >
                                  {i > 0 && <br />}
                                  <AccountDisplayName
                                    address={farcasterAccount.nounerAddress}
                                  />
                                  {farcasterAccount.votingPower != null && (
                                    <> ({farcasterAccount.votingPower})</>
                                  )}
                                </span>
                              </React.Fragment>
                            ))}
                        </Tooltip.Content>
                      </Tooltip.Root>
                    ),
                  },
                ]
                  .filter(Boolean)
                  .map(({ key, element }, index) => (
                    <React.Fragment key={key}>
                      {index > 0 && <> &middot; </>}
                      {element}
                    </React.Fragment>
                  ))
              )}
            </div>
          )}
        </div>
      </div>
    );
  },
);

const ItemBody = React.memo(
  ({ text, displayImages, truncateLines: enableLineTruncation }) => {
    const containerRef = React.useRef();

    const [isCollapsed_, setCollapsed] = React.useState(enableLineTruncation);
    const [exceedsTruncationThreshold, setExceedsTruncationThreshold] =
      React.useState(null);

    const isEnabled = enableLineTruncation && exceedsTruncationThreshold;
    const isCollapsed = isEnabled && isCollapsed_;

    React.useEffect(() => {
      const observer = new ResizeObserver(() => {
        if (containerRef.current == null) return;
        setExceedsTruncationThreshold(
          containerRef.current.scrollHeight >
            BODY_TRUNCATION_HEIGHT_THRESHOLD + 100,
        );
      });

      observer.observe(containerRef.current);

      return () => {
        observer.disconnect();
      };
    }, []);

    return (
      <div css={css({ margin: "0.5rem 0" })}>
        <div
          ref={containerRef}
          css={css({ overflow: "hidden" })}
          style={{
            maxHeight: isCollapsed
              ? `${BODY_TRUNCATION_HEIGHT_THRESHOLD}px`
              : undefined,
            maskImage: isCollapsed
              ? "linear-gradient(180deg, black calc(100% - 2.8em), transparent 100%)"
              : undefined,
          }}
        >
          <MarkdownRichText
            text={text}
            displayImages={displayImages}
            compact
            css={css({
              // Make all headings small
              "h1,h2,h3,h4,h5,h6": { fontSize: "1em" },
              "*+h1,*+h2,*+h3,*+h4,*+h5,*+h6": { marginTop: "1.5em" },
              "h1:has(+*),h2:has(+*),h3:has(+*),h4:has(+*),h5:has(+*),h6:has(+*)":
                {
                  marginBottom: "0.625em",
                },
            })}
          />
        </div>

        {isEnabled && (
          <div css={css({ margin: "0.8em 0" })}>
            <Link
              component="button"
              onClick={() => setCollapsed((c) => !c)}
              size="small"
              color={(t) => t.colors.textDimmed}
            >
              {isCollapsed ? "Expand..." : "Collapse"}
            </Link>
          </div>
        )}
      </div>
    );
  },
);

const ItemTitle = ({ item, context, isOnScreen }) => {
  const isIsolatedContext = ["proposal", "candidate"].includes(context);

  const proposal = useProposal(item.proposalId ?? item.targetProposalId);
  const candidate = useProposalCandidate(item.candidateId);

  const ContextLink = ({ proposalId, candidateId, short, children }) => {
    if (proposalId != null) {
      const title =
        proposal?.title == null || proposal.title.length > 130
          ? `Proposal ${proposalId}`
          : `${short ? proposalId : `Proposal ${proposalId}`}: ${
              proposal.title
            } `;

      return (
        <NextLink
          prefetch
          href={
            ["vote", "feedback-post"].includes(item.type)
              ? `/proposals/${proposalId}?tab=activity#${item.id}`
              : `/proposals/${proposalId}`
          }
        >
          {children ?? title}
        </NextLink>
      );
    }

    if (candidateId != null) {
      const title =
        candidate?.latestVersion?.content.title ??
        extractSlugFromCandidateId(candidateId);
      const candidateUrl = `/candidates/${encodeURIComponent(
        makeCandidateUrlId(candidateId),
      )}`;
      return (
        <NextLink
          prefetch
          href={
            ["vote", "feedback-post"].includes(item.type)
              ? `${candidateUrl}?tab=activity#${item.id}`
              : candidateUrl
          }
        >
          {children ?? title}
        </NextLink>
      );
    }

    throw new Error();
  };

  const author = (
    <span css={(t) => css({ color: t.colors.textNormal })}>
      <AccountPreviewPopoverTrigger
        accountAddress={item.authorAccount}
        fallbackDisplayName={item.authorDisplayName}
      />
    </span>
  );

  switch (item.type) {
    case "event": {
      switch (item.eventType) {
        case "auction-started":
          return (
            <>
              Auction for <NounPreviewPopoverTrigger nounId={item.nounId} />{" "}
              started
            </>
          );
        case "auction-ended":
          return (
            <>
              Auction for <NounPreviewPopoverTrigger nounId={item.nounId} /> won
              by{" "}
              <AccountPreviewPopoverTrigger
                accountAddress={item.bidderAccount}
              />{" "}
              for <FormattedEthWithConditionalTooltip value={item.bidAmount} />
            </>
          );
        case "auction-settled":
          return <AuctionSettledItem item={item} />;

        case "proposal-created":
        case "proposal-updated":
          return (
            <>
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              {item.eventType === "proposal-created" ? "created" : "updated"}
              {item.authorAccount != null && (
                <>
                  {" "}
                  by{" "}
                  <AccountPreviewPopoverTrigger
                    showAvatar
                    accountAddress={item.authorAccount}
                  />
                </>
              )}
            </>
          );

        case "candidate-created":
        case "candidate-updated": {
          const label =
            context === "candidate" ? (
              "Candidate"
            ) : context === "proposal" ? (
              <ContextLink {...item}>
                {item.targetProposalId != null
                  ? "Update candidate"
                  : "Candidate"}
              </ContextLink>
            ) : item.targetProposalId != null ? (
              <>
                <ContextLink {...item}>Update candidate</ContextLink> for{" "}
                <ContextLink proposalId={item.targetProposalId} truncate />
              </>
            ) : (
              <>
                Candidate <ContextLink {...item} />
              </>
            );

          return (
            <>
              {label}{" "}
              {item.eventType === "candidate-created" ? "created" : "updated"}
              {item.authorAccount != null && (
                <>
                  {" "}
                  by{" "}
                  <AccountPreviewPopoverTrigger
                    showAvatar
                    accountAddress={item.authorAccount}
                  />
                </>
              )}
            </>
          );
        }

        case "candidate-canceled":
          return (
            <>
              {context === "proposal" ? (
                <ContextLink {...item}>
                  {item.targetProposalId == null
                    ? "Candidate"
                    : "Update candidate"}
                </ContextLink>
              ) : context === "candidate" ? (
                "Candidate"
              ) : (
                <ContextLink {...item} />
              )}{" "}
              was canceled
            </>
          );

        case "proposal-started":
          return (
            <>
              Voting{" "}
              {context !== "proposal" && (
                <>
                  for <ContextLink {...item} />
                </>
              )}{" "}
              started{" "}
            </>
          );

        case "proposal-ended":
          return (
            <>
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              {isSucceededProposalState(proposal.state) ? (
                <span
                  css={(t) =>
                    css({
                      color: t.colors.textPositive,
                      fontWeight: t.text.weights.emphasis,
                    })
                  }
                >
                  succeeded
                </span>
              ) : (
                <>
                  was{" "}
                  <span
                    css={(t) =>
                      css({
                        color: t.colors.textNegative,
                        fontWeight: t.text.weights.emphasis,
                      })
                    }
                  >
                    defeated
                  </span>
                </>
              )}
            </>
          );

        case "proposal-objection-period-started":
          return (
            <>
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              entered objection period
            </>
          );

        case "proposal-queued":
          return (
            <>
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              was queued for execution
            </>
          );

        case "proposal-executed":
          return (
            <>
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              was{" "}
              <span
                css={(t) =>
                  css({
                    color: t.colors.textPositive,
                    fontWeight: t.text.weights.emphasis,
                  })
                }
              >
                executed
              </span>
            </>
          );

        case "proposal-canceled":
          return (
            <>
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              was{" "}
              <span
                css={(t) =>
                  css({
                    color: t.colors.textNegative,
                    fontWeight: t.text.weights.emphasis,
                  })
                }
              >
                canceled
              </span>
            </>
          );

        case "propdate-posted":
          return (
            <>
              Propdate posted
              {context !== "proposal" && (
                <>
                  {" "}
                  for <ContextLink {...item} />
                </>
              )}
            </>
          );

        case "propdate-marked-completed":
          return (
            <>
              {context === "proposal" ? "Proposal" : <ContextLink {...item} />}{" "}
              marked as completed via Propdate
            </>
          );

        default:
          throw new Error(`Unknown event "${item.eventType}"`);
      }
    }

    case "vote":
    case "feedback-post": {
      const signalWord = (() => {
        const isRepost =
          item.reposts?.length > 0 &&
          item.reposts.every((post) => post.support === item.support);

        if (isRepost) return item.type === "vote" ? "revoted" : "reposted";

        switch (item.type) {
          case "vote":
            return "voted";
          case "feedback-post": {
            if (item.support !== 2) return "signaled";

            const isReplyWithoutAdditionalComment =
              item.replies?.length > 0 &&
              (item.body == null || item.body.trim() === "");

            return isReplyWithoutAdditionalComment ? "replied" : "commented";
          }
          default:
            throw new Error();
        }
      })();
      return (
        <>
          {author}{" "}
          {(() => {
            switch (item.support) {
              case 0:
                return (
                  <Signal negative>
                    {signalWord} against
                    {item.voteCount != null && <> ({item.voteCount})</>}
                  </Signal>
                );
              case 1:
                return (
                  <Signal positive>
                    {signalWord} for
                    {item.voteCount != null && <> ({item.voteCount})</>}
                  </Signal>
                );
              case 2:
                return item.type === "vote" ? (
                  <Signal>
                    abstained
                    {item.voteCount != null && <> ({item.voteCount})</>}
                  </Signal>
                ) : isIsolatedContext ? (
                  signalWord
                ) : (
                  <>{signalWord} on</>
                );
            }
          })()}
          {!isIsolatedContext && (
            <>
              {" "}
              <ContextLink short {...item} />
            </>
          )}
        </>
      );
    }

    case "farcaster-cast": {
      if (item.authorAccount == null)
        return (
          <>
            <span
              css={(t) =>
                css({
                  color: t.colors.textNormal,
                  fontWeight: t.text.weights.emphasis,
                })
              }
            >
              {item.authorDisplayName}
            </span>{" "}
            commented
            {!isIsolatedContext && (
              <>
                {" "}
                on <ContextLink short {...item} />
              </>
            )}
          </>
        );

      return (
        <>
          {author} commented{" "}
          {!isIsolatedContext && (
            <>
              {" "}
              on <ContextLink short {...item} />
            </>
          )}
        </>
      );
    }

    case "candidate-signature":
      return (
        <>
          {author} <Signal positive>sponsored candidate</Signal>
          {!isIsolatedContext && (
            <>
              {" "}
              <ContextLink short {...item} />
            </>
          )}
        </>
      );

    case "noun-transfer":
      return <NounTransferItem item={item} isOnScreen={isOnScreen} />;

    case "noun-delegation":
      return (
        <>
          {author}{" "}
          {item.toAccount === item.authorAccount ? (
            <>
              stopped delegating to{" "}
              <AccountPreviewPopoverTrigger
                showAvatar
                accountAddress={item.fromAccount}
              />
            </>
          ) : (
            <>
              delegated <NounsPreviewPopoverTrigger nounIds={item.nouns} /> to{" "}
              <AccountPreviewPopoverTrigger
                showAvatar
                accountAddress={item.toAccount}
              />
            </>
          )}
        </>
      );

    case "auction-bid":
      return (
        <>
          {author} placed a bid of{" "}
          <FormattedEthWithConditionalTooltip value={item.amount} /> for{" "}
          <NounPreviewPopoverTrigger nounId={item.nounId} /> at the{" "}
          <a
            href={`https://nouns.wtf/noun/${item.nounId}`}
            rel="noreferrer"
            target="_blank"
          >
            Auction House
          </a>
        </>
      );

    default:
      console.log(item);
      throw new Error(`Unknown event type "${item.type}"`);
  }
};

const NounTransferItem = ({ item, isOnScreen }) => {
  const transferMeta = useNounTransferMeta(item.transactionHash, {
    enabled: isOnScreen,
  });

  const { address: treasuryAddress } = resolveContractIdentifier("executor");
  const { address: auctionHouseAddress } =
    resolveContractIdentifier("auction-house");

  if (transferMeta == null) return <>&nbsp;</>; // Loading

  const {
    transferType,
    authorAccount,
    targetAccount,
    nounIds,
    transfers: nounTransfers = [],
  } = transferMeta;

  const transfers = nounTransfers.filter((t) => {
    const isTreasuryToAuctionHouseTransfer =
      t.from === treasuryAddress && t.to === auctionHouseAddress;
    return !isTreasuryToAuctionHouseTransfer && t.from !== auctionHouseAddress;
  });

  const nouns = arrayUtils.unique(nounIds ?? transfers.map((t) => t.nounId));
  const nounsElement = <NounsPreviewPopoverTrigger nounIds={nouns} />;

  const senders = arrayUtils.unique(transfers.map((t) => t.from));
  const receivers = arrayUtils.unique(transfers.map((t) => t.to));

  const renderAuthor = (address) => (
    <span css={(t) => css({ color: t.colors.textNormal })}>
      <AccountPreviewPopoverTrigger accountAddress={address} />
    </span>
  );
  const renderAccounts = (accounts) =>
    accounts.map((a, i, as) => (
      <React.Fragment key={a}>
        {i > 0 && (
          <>
            {as.length === 2 ? " and" : i === as.length - 1 ? ", and" : ", "}{" "}
          </>
        )}
        <AccountPreviewPopoverTrigger showAvatar accountAddress={a} />
      </React.Fragment>
    ));

  switch (transferType) {
    case "bundled-transfer":
    case "bundled-sale": {
      // Show sales as tranfers when bundled since we don’t know enough about
      // the state change

      if (transfers.length === 1)
        // Since we filter out certain events upstream bundles can sometimes
        // hold just a single transfer. E.g. nounder rewards.
        return (
          <>
            {nounsElement} {nouns.length === 1 ? "was" : "were"} transferred
            from{" "}
            <AccountPreviewPopoverTrigger
              showAvatar
              accountAddress={transfers[0].from}
            />{" "}
            to{" "}
            <AccountPreviewPopoverTrigger
              showAvatar
              accountAddress={transfers[0].to}
            />
          </>
        );

      const accounts = arrayUtils.unique([...senders, ...receivers]);

      return (
        <>
          {nounsElement} were transferred between {renderAccounts(accounts)}
        </>
      );
    }

    case "transfer": {
      if (authorAccount != null) {
        const isIncoming = receivers.includes(authorAccount);
        return (
          <>
            {renderAuthor(authorAccount)}{" "}
            {isIncoming ? (
              <>
                withdrew {nounsElement} from {renderAccounts(senders)}
              </>
            ) : (
              <>
                transferred {nounsElement} to {renderAccounts(receivers)}
              </>
            )}
          </>
        );
      }

      const isIncoming = receivers.includes(targetAccount);

      if (item.contextAccount != null && item.contextAccount === targetAccount)
        return (
          <>
            {nounsElement} {nouns.length === 1 ? "was" : "were"}{" "}
            {isIncoming ? (
              <>transferred from {renderAccounts(senders)}</>
            ) : (
              <>transferred to {renderAccounts(receivers)}</>
            )}
          </>
        );

      return (
        <>
          {nounsElement} {nouns.length === 1 ? "was" : "were"}{" "}
          {isIncoming ? (
            <>
              transferred to{" "}
              <AccountPreviewPopoverTrigger
                showAvatar
                accountAddress={targetAccount}
              />{" "}
              from {renderAccounts(senders)}
            </>
          ) : (
            <>
              transferred from{" "}
              <AccountPreviewPopoverTrigger
                showAvatar
                accountAddress={targetAccount}
              />{" "}
              to {renderAccounts(receivers)}
            </>
          )}
        </>
      );
    }

    // Secondary sale
    case "sale": {
      if (authorAccount != null) {
        const isIncoming = receivers.includes(authorAccount);
        return (
          <>
            {renderAuthor(authorAccount)}{" "}
            {isIncoming ? (
              <>
                bought {nounsElement} from {renderAccounts(senders)}
              </>
            ) : (
              <>
                sold {nounsElement} to {renderAccounts(receivers)}
              </>
            )}
            {transferMeta.amount != null && (
              <>
                {" "}
                for{" "}
                <FormattedEthWithConditionalTooltip
                  decimals={2}
                  truncationDots={false}
                  value={transferMeta.amount}
                />
              </>
            )}
          </>
        );
      }

      const isIncoming = receivers.includes(targetAccount);

      if (item.contextAccount != null && item.contextAccount === targetAccount)
        return (
          <>
            {nounsElement}{" "}
            {isIncoming ? (
              <>bought from {renderAccounts(senders)}</>
            ) : (
              <>sold to {renderAccounts(receivers)}</>
            )}
          </>
        );

      return (
        <>
          {nounsElement} {nouns.length === 1 ? "was" : "were"} sold from{" "}
          {renderAccounts(senders)} to {renderAccounts(receivers)}
        </>
      );
    }

    // Swaps can include other funds, like ETH, but we ignore that here to
    // keep things simple
    case "swap": {
      const accounts = arrayUtils.unique(
        transfers.flatMap((t) => [t.from, t.to]),
      );

      const firstAccount = authorAccount ?? accounts[0];
      const otherAccount = accounts.find((a) => a !== firstAccount);

      const outgoingNouns = transfers
        .filter((t) => t.from === firstAccount)
        .map((t) => t.nounId);
      const incomingNouns = transfers
        .filter((t) => t.to === firstAccount)
        .map((t) => t.nounId);
      return (
        <>
          {authorAccount != null ? (
            renderAuthor(firstAccount)
          ) : (
            <AccountPreviewPopoverTrigger
              showAvatar
              accountAddress={firstAccount}
            />
          )}{" "}
          swapped <NounsPreviewPopoverTrigger nounIds={outgoingNouns} /> with{" "}
          <NounsPreviewPopoverTrigger nounIds={incomingNouns} /> from{" "}
          <AccountPreviewPopoverTrigger
            showAvatar
            accountAddress={otherAccount}
          />
        </>
      );
    }

    // Account joined fork
    case "fork-join":
      return (
        <>
          {renderAuthor(item.fromAccount)} joined fork{" "}
          <a
            href={`https://nouns.wtf/fork/${transferMeta.forkId}`}
            target="_blank"
            rel="noreferrer"
          >
            #{transferMeta.forkId}
          </a>{" "}
          with {nounsElement}
        </>
      );

    // Account escrowed nouns to fork
    case "fork-escrow":
      return (
        <>
          {renderAuthor(item.fromAccount)} escrowed {nounsElement} to fork{" "}
          <a
            href={`https://nouns.wtf/fork/${transferMeta.forkId}`}
            target="_blank"
            rel="noreferrer"
          >
            #{transferMeta.forkId}
          </a>
        </>
      );

    // Nouns withdrawn from fork escrow
    case "fork-escrow-withdrawal":
      return (
        <>
          {renderAuthor(item.toAccount)} withdrew {nounsElement} from fork{" "}
          <a
            href={`https://nouns.wtf/fork/${transferMeta.forkId}`}
            target="_blank"
            rel="noreferrer"
          >
            #{transferMeta.forkId}
          </a>
        </>
      );

    default:
      throw new Error();
  }
};

const AuctionSettledItem = ({ item }) => {
  const noun = useNoun(item.nounId);
  return (
    <>
      <span css={(t) => css({ color: t.colors.textNormal })}>
        <AccountPreviewPopoverTrigger accountAddress={item.bidderAccount} />
      </span>{" "}
      bought <NounPreviewPopoverTrigger nounId={item.nounId} /> on auction
      {noun.auction?.amount != null && (
        <>
          {" "}
          for{" "}
          <FormattedEthWithConditionalTooltip
            decimals={2}
            truncationDots={false}
            value={noun.auction.amount}
          />
        </>
      )}
    </>
  );
};

const Signal = ({ positive, negative, ...props }) => (
  <span
    css={(t) =>
      css({
        "--positive-text": t.colors.textPositive,
        "--negative-text": t.colors.textNegative,
        "--neutral-text": t.colors.textDimmed,
        color: "var(--color)",
        fontWeight: t.text.weights.emphasis,
      })
    }
    style={{
      "--color": positive
        ? "var(--positive-text)"
        : negative
          ? "var(--negative-text)"
          : "var(--neutral-text)",
    }}
    {...props}
  />
);

const QuotedVoteOrFeedbackPost = ({ href, item }) => (
  <div
    css={(t) =>
      css({
        position: "relative",
        border: "0.1rem solid",
        borderRadius: "0.5rem",
        borderColor: t.colors.borderLighter,
        padding: "0.4rem 0.6rem",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      })
    }
  >
    {href != null && (
      <NextLink
        href={href}
        style={{ display: "block", position: "absolute", inset: 0 }}
      />
    )}
    <AccountPreviewPopoverTrigger
      showAvatar
      accountAddress={item.voterId}
      style={{ position: "relative" }}
    />
    <span
      css={(t) =>
        css({
          fontWeight: t.text.weights.emphasis,
          "[data-for]": { color: t.colors.textPositive },
          "[data-against]": { color: t.colors.textNegative },
          "[data-abstain]": { color: t.colors.textDimmed },
        })
      }
    >
      {" "}
      {(() => {
        if (item.type === "feedback-post") {
          switch (item.support) {
            case 0:
              return <Signal negative>(against signal)</Signal>;
            case 1:
              return <Signal positive>(for signal)</Signal>;
            case 2:
              return <Signal>(comment)</Signal>;
          }
        }

        switch (item.support) {
          case 0:
            return <Signal negative>(against)</Signal>;
          case 1:
            return <Signal positive>(for)</Signal>;
          case 2:
            return <Signal>(abstained)</Signal>;
        }
      })()}
    </span>
    :{" "}
    <MarkdownRichText
      text={item.reason}
      displayImages={false}
      inline
      css={css({
        // Make all headings small
        "h1,h2,h3,h4,h5,h6": { fontSize: "1em" },
        "*+h1,*+h2,*+h3,*+h4,*+h5,*+h6": { marginTop: "1.5em" },
        "h1:has(+*),h2:has(+*),h3:has(+*),h4:has(+*),h5:has(+*),h6:has(+*)": {
          marginBottom: "0.625em",
        },
      })}
    />
  </div>
);

const AccountDisplayName = ({ address }) => {
  return useAccountDisplayName(address);
};

export default ActivityFeed;
