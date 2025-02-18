"use client";

import React from "react";
import { notFound as nextNotFound } from "next/navigation";
import { css } from "@emotion/react";
import { array as arrayUtils, reloadPageOnce } from "@shades/common/utils";
import { ErrorBoundary, useMatchMedia } from "@shades/common/react";
import Spinner from "@shades/ui-web/spinner";
import Button from "@shades/ui-web/button";
import Select from "@shades/ui-web/select";
import {
  Share as ShareIcon,
  CaretDown as CaretDownIcon,
} from "@shades/ui-web/icons";
import * as Tooltip from "@shades/ui-web/tooltip";
import * as DropdownMenu from "@shades/ui-web/dropdown-menu";
import {
  normalizeId,
  extractSlugFromId as extractSlugFromCandidateId,
} from "../utils/candidates.js";
import { formatReply, formatRepost } from "../utils/votes-and-feedbacks.js";
import {
  useProposalCandidate,
  useProposalCandidateFetch,
  useProposalFetch,
  useActiveProposalsFetch,
  useCandidateFeedItems,
} from "../store.js";
import useScrollToElement from "@/hooks/scroll-to-element";
import {
  useSearchParamToggleState,
  useSearchParams,
} from "../hooks/navigation.js";
import {
  useSendProposalCandidateFeedback,
  useCancelProposalCandidate,
} from "../hooks/data-contract.js";
import { useWallet } from "../hooks/wallet.js";
import useMatchDesktopLayout from "../hooks/match-desktop-layout.js";
import {
  useSubmitCandidateCast,
  useSubmitCastReply,
} from "../hooks/farcaster.js";
import { ProposalHeader, ProposalBody } from "./proposal-screen.js";
import ProposalActionForm from "./proposal-action-form.js";
import Layout, { MainContentContainer } from "./layout.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import Tag from "./tag.js";
// import FloatingNavBar from "./floating-nav-bar.js";

const ActivityFeed = React.lazy(() => import("./activity-feed.js"));

const CandidateEditDialog = React.lazy(
  () => import("./candidate-edit-dialog.js"), // TODO
);

const ScreenContext = React.createContext();
const useScreenContext = () => React.useContext(ScreenContext);

const TopicScreenContent = ({ candidateId }) => {
  const proposerId = candidateId.split("-")[0];
  const slug = extractSlugFromCandidateId(candidateId);
  const [searchParams] = useSearchParams();
  const isDesktopLayout = useMatchDesktopLayout();

  const actionFormInputRef = React.useRef();

  const candidate = useProposalCandidate(candidateId);

  const feedItems = useCandidateFeedItems(candidateId).filter(
    (item) => item.eventType !== "candidate-created",
  );

  const { isProposer, isCanceled } = useScreenContext();

  const [formAction, setFormAction] = React.useState("onchain-comment");
  const availableFormActions = ["onchain-comment", "farcaster-comment"];

  const [pendingComment, setPendingComment] = React.useState("");
  const [pendingSupport, setPendingSupport] = React.useState(2);

  const [sortStrategy, setSortStrategy] = React.useState("chronological");

  const submitCandidateCast = useSubmitCandidateCast(candidateId);
  const submitCastReply = useSubmitCastReply();

  const [pendingRepostTargetFeedItemIds, setPendingRepostTargetFeedItemIds] =
    React.useState(() => {
      const initialRepostTargetId = searchParams.get("repost-target");
      if (initialRepostTargetId == null) return [];
      return [initialRepostTargetId];
    });

  const [
    { activeReplyTargetItemId, pendingRepliesByTargetItemId },
    setPendingReplyState,
  ] = React.useState(() => {
    const initialReplyTargetId = searchParams.get("reply-target");
    return {
      activeReplyTargetItemId: initialReplyTargetId ?? null,
      pendingRepliesByTargetItemId: {},
    };
  });

  const countCastReplies = (cast) =>
    cast.replies.reduce(
      (sum, replyCast) => sum + 1 + countCastReplies(replyCast),
      0,
    );

  const { comments: commentCount, replies: replyCount } = feedItems.reduce(
    ({ comments, replies }, item) => {
      const isComment = item.body != null && item.body.trim() !== "";
      const onchainReplyCount = item.replyingItems?.length ?? 0;
      const castReplyCount =
        item.replyingCasts?.reduce(
          (sum, cast) => sum + 1 + countCastReplies(cast),
          0,
        ) ?? 0;
      return {
        comments: isComment ? comments + 1 : comments,
        replies: replies + onchainReplyCount + castReplyCount,
      };
    },
    { comments: 0, replies: 0 },
  );

  const replyTargetFeedItems = React.useMemo(() => {
    if (activeReplyTargetItemId == null) return [];
    // if (formAction === "farcaster-comment") return [];
    const replyTargetItem = feedItems.find(
      (i) => i.id === activeReplyTargetItemId,
    );
    if (replyTargetItem == null) return [];
    return [replyTargetItem];
  }, [activeReplyTargetItemId, feedItems]);

  const repostTargetFeedItems = React.useMemo(() => {
    if (formAction === "farcaster-comment") return [];
    return pendingRepostTargetFeedItemIds
      .map((id) => feedItems.find((i) => i.id === id))
      .filter(Boolean);
  }, [formAction, feedItems, pendingRepostTargetFeedItemIds]);

  const reasonWithRepostsAndReplies = React.useMemo(() => {
    const replyMarkedQuotesAndReplyText = replyTargetFeedItems
      // Farcaster replies are handled differently
      .filter((i) => i.type !== "farcaster-cast")
      .map((item) => {
        const replyText = pendingRepliesByTargetItemId[item.id];
        return formatReply({
          body: replyText,
          target: {
            voterId: item.authorAccount,
            reason: item.reason,
          },
        });
      });
    const repostMarkedQuotes = repostTargetFeedItems.map((item) =>
      formatRepost(item.reason),
    );
    return [
      replyMarkedQuotesAndReplyText.join("\n\n"),
      pendingComment.trim(),
      repostMarkedQuotes.join("\n\n"),
    ]
      .filter((section) => section !== "")
      .join("\n\n");
  }, [
    pendingComment,
    repostTargetFeedItems,
    replyTargetFeedItems,
    pendingRepliesByTargetItemId,
  ]);

  const participantAccountIds = feedItems.reduce(
    (acc, item) => {
      const collectParticipants = (feedItem) => {
        const authorId = feedItem.authorAccount?.toLowerCase();
        if (authorId != null && !acc.includes(authorId)) {
          acc.push(authorId);
        } // Collect from onchain replies
        feedItem.replyingItems?.forEach(collectParticipants);
        // Collect from farcaster replies recursively
        const collectCastParticipants = (cast) => {
          const castAuthorId = cast.account?.nounerAddress?.toLowerCase();
          if (castAuthorId != null && !acc.includes(castAuthorId)) {
            acc.push(castAuthorId);
          }
          // Recursively collect from all nested replies
          cast.replies?.forEach(collectCastParticipants);
        };
        feedItem.replyingCasts?.forEach(collectCastParticipants);
      };
      collectParticipants(item);
      return acc;
    },
    [candidate.proposerId],
  );

  const lastActivityTimestamp =
    arrayUtils.sortBy((p) => p.timestamp, feedItems).slice(-1)[0]?.timestamp ??
    candidate.createdTimestamp;

  const idleTimeMillis = new Date().getTime() - lastActivityTimestamp.getTime();

  const showAdminActions = isProposer && !isCanceled;

  const submitCommentTransaction = useSendProposalCandidateFeedback(
    proposerId,
    slug,
    {
      support: pendingSupport,
      reason: reasonWithRepostsAndReplies,
    },
  );

  useProposalCandidateFetch(candidateId);
  useProposalFetch(candidate.latestVersion.targetProposalId);

  const focusedFeedItemId = searchParams.get("item");

  useScrollToElement({
    id: focusedFeedItemId,
    enabled: focusedFeedItemId != null,
  });

  const onRepost = React.useCallback(
    (postId) => {
      setPendingRepostTargetFeedItemIds((ids) =>
        ids.includes(postId) ? ids : [...ids, postId],
      );

      const targetPost = feedItems.find((i) => i.id === postId);

      if (targetPost != null)
        setPendingSupport((support) => {
          if (support != null) return support;
          return targetPost.support;
        });

      const input = actionFormInputRef.current;
      input.scrollIntoView({ behavior: "smooth", block: "nearest" });
      input.focus();
      setTimeout(() => {
        input.selectionStart = 0;
        input.selectionEnd = 0;
      }, 0);
    },
    [feedItems],
  );

  const cancelRepost = React.useCallback((id) => {
    setPendingRepostTargetFeedItemIds((ids) => ids.filter((id_) => id_ !== id));
    actionFormInputRef.current.focus();
  }, []);

  if (candidate?.latestVersion.content.description == null) return null;

  const handleFormSubmit = async (data) => {
    switch (formAction) {
      case "onchain-comment":
        // A contract simulation takes a second to do its thing after every
        // argument change, so this might be null. This seems like a nicer
        // behavior compared to disabling the submit button on every keystroke
        if (submitCommentTransaction == null) return;
        await submitCommentTransaction();
        break;

      case "farcaster-comment":
        await submitCandidateCast({ fid: data.fid, text: pendingComment });
        break;

      default:
        throw new Error();
    }

    setPendingComment("");
    setPendingSupport(null);

    setPendingComment("");
    setPendingSupport(null);
    setPendingRepostTargetFeedItemIds([]);
  };

  const actionFormProps = {
    inputRef: actionFormInputRef,
    mode: formAction,
    setMode: setFormAction,
    availableModes: availableFormActions,
    reason: pendingComment,
    setReason: (reason) => {
      setPendingReplyState((s) => ({ ...s, activeReplyTargetItemId: null }));
      setPendingComment(reason);
    },
    support: pendingSupport,
    // setSupport: (support) => {
    //   setPendingReplyState((s) => ({ ...s, activeReplyTargetItemId: null }));
    //   setPendingSupport(support);
    // },
    onSubmit: handleFormSubmit,
    cancelRepost,
    repostTargetFeedItems,
  };

  const activityFeedProps = {
    context: "candidate",
    pendingRepliesByTargetItemId,
    items:
      sortStrategy === "chronological" ? feedItems.toReversed() : feedItems,
    onRepost: formAction === "farcaster-comment" ? null : onRepost,
    submitInlineReply: async (targetItemId, data) => {
      const targetItem = feedItems.find((i) => i.id === targetItemId);

      if (targetItem == null) throw new Error();

      // Edge case for when a submit is triggered from a target which is not the
      // "active" one. Should be very uncommon.
      if (activeReplyTargetItemId !== targetItemId) {
        setPendingReplyState((s) => ({
          ...s,
          activeReplyTargetItemId: targetItemId,
        }));
        throw new Error();
      }

      if (targetItem.type === "farcaster-cast") {
        await submitCastReply({
          fid: data.fid,
          text: pendingRepliesByTargetItemId[targetItemId],
          targetCastId: {
            fid: targetItem.authorFid,
            hash: targetItem.castHash,
          },
        });
        console.log("cast reply submit successful");
      } else {
        await submitCommentTransaction();
      }

      setPendingReplyState((s) => ({
        activeReplyTargetItemId: null,
        pendingRepliesByTargetItemId: {
          ...s.pendingRepliesByTargetItemId,
          [targetItemId]: "",
        },
      }));
    },
    onInlineReplyChange: (targetItemId, replyText) => {
      setPendingReplyState((s) => ({
        activeReplyTargetItemId: targetItemId,
        pendingRepliesByTargetItemId: {
          ...s.pendingRepliesByTargetItemId,
          [targetItemId]: replyText,
        },
      }));
    },
    variant: "boxed",
  };

  return (
    <div css={css({ padding: "0 1.6rem" })}>
      <MainContentContainer>
        <div
          css={css({
            display: "flex",
            flexDirection: "column-reverse",
            gap: "2.4rem",
            padding: "0.8rem 0 0",
            button: { textAlign: "left" },
            ".header": { marginBottom: "1.6rem" },
            "@media (min-width: 600px)": {
              flexDirection: "row",
              padding: "6rem 0 0",
              ".header": {
                flex: 1,
                minWidth: 0,
                marginBottom: "2.4rem",
              },
              button: { textAlign: "center" },
            },
          })}
        >
          <ProposalHeader
            type="topic"
            title={candidate.latestVersion.content.title}
            proposerId={candidate.proposerId}
            createdAt={candidate.createdTimestamp}
            updatedAt={candidate.lastUpdatedTimestamp}
            className="header"
          />

          {showAdminActions && <AdminDropdown candidateId={candidateId} />}
        </div>
      </MainContentContainer>
      <MainContentContainer
        sidebarWidth="28rem"
        sidebarGap="6rem"
        sidebar={
          !isDesktopLayout ? null : (
            <div
              css={(t) =>
                css({
                  padding: "0 0 6rem",
                  "@media (min-width: 600px)": {
                    padding: "0",
                  },
                  ".participants": {
                    color: t.colors.textDimmed,
                    ".account-preview-trigger": { color: t.colors.textNormal },
                  },
                  dl: { lineHeight: "calc(24/14)" },
                  dt: {
                    fontSize: t.text.sizes.small,
                    color: t.colors.textDimmed,
                    lineHeight: "calc(24/12)",
                  },
                  "dd + dt": {
                    marginTop: "1.6rem",
                    paddingTop: "1.6rem",
                    borderTop: "0.1rem solid",
                    borderColor: t.colors.borderLight,
                  },
                })
              }
            >
              <dl>
                {lastActivityTimestamp != null && (
                  <>
                    <dt>Last activity</dt>
                    <dd>
                      <FormattedDateWithTooltip
                        value={lastActivityTimestamp}
                        day="numeric"
                        month="long"
                        year="numeric"
                      />
                    </dd>
                  </>
                )}

                <dt>Status</dt>
                <dd>
                  {isCanceled ? (
                    <Tag size="large" variant="error">
                      Closed
                    </Tag>
                  ) : idleTimeMillis < 1000 * 60 * 60 * 24 * 30 ? (
                    <Tag size="large" variant="active">
                      Active
                    </Tag>
                  ) : (
                    <Tooltip.Root>
                      <Tooltip.Trigger>
                        <Tag size="large">Stale</Tag>
                      </Tooltip.Trigger>
                      <Tooltip.Content>
                        No activity within the last 30 days
                      </Tooltip.Content>
                    </Tooltip.Root>
                  )}
                </dd>

                <dt>Participants</dt>
                <dd className="participants">
                  {participantAccountIds.map((accountId, i, all) => (
                    <React.Fragment key={accountId}>
                      <AccountPreviewPopoverTrigger
                        showAvatar
                        accountAddress={accountId}
                      />
                      {i !== all.length - 1 && <>, </>}
                    </React.Fragment>
                  ))}
                </dd>
              </dl>
            </div>
          )
        }
      >
        <div
          css={css({
            padding: "0 0 3.2rem",
            "@media (min-width: 600px)": {
              padding: "0 0 12rem",
            },
          })}
        >
          <div
            css={(t) =>
              css({
                border: "0.1rem solid",
                borderColor: t.colors.borderLight,
                borderRadius: "0.6rem",
                padding: "1.6rem",
              })
            }
          >
            <ProposalBody markdownText={candidate.latestVersion.content.body} />
          </div>

          {feedItems.length > 0 && (
            <div
              css={(t) =>
                css({
                  display: "flex",
                  alignItems: "center",
                  gap: "0.8rem",
                  fontSize: t.text.sizes.base,
                  color: t.colors.textDimmed,
                  margin: "3.2rem 0",
                })
              }
            >
              <div style={{ flex: 1, minWidth: "auto", whiteSpace: "nowrap" }}>
                {commentCount} {commentCount === 1 ? "comment" : "comments"}
                {replyCount > 0 && (
                  <>
                    {" "}
                    &middot; {replyCount}{" "}
                    {replyCount === 1 ? "reply" : "replies"}
                  </>
                )}
              </div>
              <Select
                size="small"
                aria-label="Feed sorting"
                value={sortStrategy}
                options={[
                  { value: "chronological", label: "Chronological" },
                  {
                    value: "reverse-chronological",
                    label: "Reverse chronological",
                  },
                ]}
                onChange={(value) => {
                  setSortStrategy(value);
                }}
                fullWidth={false}
                width="max-content"
                renderTriggerContent={(value, options) => (
                  <>
                    Order:{" "}
                    <em
                      css={(t) =>
                        css({
                          fontStyle: "normal",
                          fontWeight: t.text.weights.emphasis,
                        })
                      }
                    >
                      {options.find((o) => o.value === value)?.label}
                    </em>
                  </>
                )}
              />
            </div>
          )}

          {feedItems.length > 0 && <ActivityFeed {...activityFeedProps} />}

          <div css={css({ marginTop: "4rem" })}>
            <ProposalActionForm
              size="large"
              variant="boxed"
              {...actionFormProps}
            />
          </div>
        </div>
      </MainContentContainer>
    </div>
  );
};

const TopicScreen = ({ candidateId: rawId }) => {
  const candidateId = normalizeId(decodeURIComponent(rawId));

  const scrollContainerRef = React.useRef();

  const isTouchScreen = useMatchMedia("(pointer: coarse)");

  const [notFound, setNotFound] = React.useState(false);
  const [fetchError, setFetchError] = React.useState(null);

  const { address: connectedWalletAccountAddress } = useWallet();

  const candidate = useProposalCandidate(candidateId);

  const isProposer =
    connectedWalletAccountAddress != null &&
    connectedWalletAccountAddress === candidate?.proposerId.toLowerCase();

  useProposalCandidateFetch(candidateId, {
    onError: (e) => {
      if (e.message === "not-found") {
        setNotFound(true);
        return;
      }

      console.error(e);
      setFetchError(e);
    },
  });

  useActiveProposalsFetch();

  const [isEditDialogOpen, toggleEditDialog] = useSearchParamToggleState(
    "edit",
    { replace: true },
  );

  const isCanceled = candidate?.canceledTimestamp != null;

  const screenContextValue = React.useMemo(
    () => ({
      isProposer,
      isCanceled,
      toggleEditDialog,
    }),
    [isProposer, isCanceled, toggleEditDialog],
  );

  const getPageActions = () => {
    if (candidate == null) return [];
    const actions = [];
    if (isTouchScreen && navigator?.share != null) {
      actions.push({
        title: <ShareIcon css={css({ width: "1.7rem" })} />,
        onSelect: () => {
          const urlToShare = `/topics/${encodeURIComponent(candidate.number ?? candidateId)}`;
          navigator
            .share({ url: urlToShare })
            .catch((error) => console.error("Error sharing", error));
        },
      });
    }
    return actions.length === 0 ? undefined : actions;
  };

  if (notFound) nextNotFound();

  return (
    <ScreenContext.Provider value={screenContextValue}>
      <Layout
        scrollContainerRef={scrollContainerRef}
        navigationStack={[
          { to: "/topics", label: "Topics", desktopOnly: true },
          {
            to: `/topics/${encodeURIComponent(candidateId)}`,
            label: <>{candidate?.latestVersion.content.title ?? "..."}</>,
          },
        ]}
        actions={getPageActions()}
      >
        {candidate == null ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              paddingBottom: "10vh",
            }}
          >
            {fetchError != null ? (
              "Something went wrong"
            ) : (
              <Spinner size="2rem" />
            )}
          </div>
        ) : (
          <TopicScreenContent
            candidateId={candidateId}
            scrollContainerRef={scrollContainerRef}
          />
        )}
      </Layout>

      {isEditDialogOpen && isProposer && candidate != null && (
        <ErrorBoundary
          onError={() => {
            reloadPageOnce();
          }}
        >
          <React.Suspense fallback={null}>
            <CandidateEditDialog
              candidateId={candidateId}
              isOpen
              close={toggleEditDialog}
            />
          </React.Suspense>
        </ErrorBoundary>
      )}
    </ScreenContext.Provider>
  );
};

const AdminDropdown = React.memo(({ candidateId }) => {
  const slug = extractSlugFromCandidateId(candidateId);

  const { toggleEditDialog } = useScreenContext();

  const [hasPendingCancel, setPendingCancel] = React.useState(false);

  const cancelCandidate = useCancelProposalCandidate(slug);

  return (
    <DropdownMenu.Root placement="bottom end">
      <DropdownMenu.Trigger asChild>
        <Button
          size="medium"
          iconRight={
            <CaretDownIcon style={{ width: "1.1rem", height: "auto" }} />
          }
          isLoading={hasPendingCancel}
        >
          Manage topic
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content
        widthFollowTrigger
        disabledKeys={
          cancelCandidate == null || hasPendingCancel ? ["cancel"] : []
        }
        onAction={(key) => {
          switch (key) {
            case "edit":
              toggleEditDialog();
              break;

            case "cancel":
              if (!confirm("Are you sure you wish to close this topic?"))
                return;

              setPendingCancel(true);

              cancelCandidate().finally(() => {
                setPendingCancel(false);
              });
              break;

            default:
              throw new Error();
          }
        }}
      >
        <DropdownMenu.Item key="edit">Edit topic</DropdownMenu.Item>
        <DropdownMenu.Item danger key="cancel">
          Close topic
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
});

export default TopicScreen;
