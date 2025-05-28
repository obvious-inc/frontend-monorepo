"use client";

import React from "react";
import { notFound as nextNotFound } from "next/navigation";
import { css } from "@emotion/react";
import { array as arrayUtils, reloadPageOnce } from "@shades/common/utils";
import { ErrorBoundary, useMatchMedia } from "@shades/common/react";
import Dialog from "@shades/ui-web/dialog";
import DialogHeader from "@shades/ui-web/dialog-header";
import Spinner from "@shades/ui-web/spinner";
import Button from "@shades/ui-web/button";
import Select from "@shades/ui-web/select";
import {
  Share as ShareIcon,
  CaretDown as CaretDownIcon,
} from "@shades/ui-web/icons";
import * as DropdownMenu from "@shades/ui-web/dropdown-menu";
import {
  normalizeId,
  extractSlugFromId as extractSlugFromCandidateId,
} from "@/utils/candidates";
import { formatReply, formatRepost } from "@/utils/votes-and-feedbacks";
import { extractAmounts as extractAmountsFromTransactions } from "@/utils/transactions";
import {
  useProposalCandidate,
  useProposalCandidateFetch,
  useProposalFetch,
  useActiveProposalsFetch,
  useCandidateFeedItems,
} from "@/store";
import useScrollToElement from "@/hooks/scroll-to-element";
import { useSearchParamToggleState, useSearchParams } from "@/hooks/navigation";
import {
  useSendProposalCandidateFeedback,
  useCancelProposalCandidate,
  useSignProposalCandidate,
  useAddSignatureToProposalCandidate,
} from "@/hooks/data-contract";
import { useWallet } from "@/hooks/wallet";
import useMatchDesktopLayout from "@/hooks/match-desktop-layout";
import { useSubmitCandidateCast, useSubmitCastReply } from "@/hooks/farcaster";
import {
  ProposalHeader,
  ProposalBody,
  RequestedAmounts,
} from "@/components/proposal-screen";
import ProposalActionForm from "@/components/proposal-action-form";
import Layout, { MainContentContainer } from "@/components/layout";
import Tag from "@/components/tag";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip";
import Callout from "./callout";

const ActivityFeed = React.lazy(() => import("@/components/activity-feed"));

const CandidateEditDialog = React.lazy(
  () => import("@/components/candidate-edit-dialog"),
);

const ScreenContext = React.createContext();
const useScreenContext = () => React.useContext(ScreenContext);

const AskAmounts = ({ candidateId }) => {
  const candidate = useProposalCandidate(candidateId);
  const requestedAmounts = extractAmountsFromTransactions(
    candidate.latestVersion.content.transactions ?? [],
  );

  return <RequestedAmounts amounts={requestedAmounts} />;
};

const ApplicationScreenContent = ({ candidateId }) => {
  const proposerId = candidateId.split("-")[0];
  const slug = extractSlugFromCandidateId(candidateId);
  const [searchParams] = useSearchParams();
  const isDesktopLayout = useMatchDesktopLayout();

  const actionFormInputRef = React.useRef();

  const candidate = useProposalCandidate(candidateId);

  const feedItems = useCandidateFeedItems(candidateId).filter(
    (item) => item.eventType !== "candidate-created",
  );

  const { isProposer, isCanceled, toggleSponsorDialog } = useScreenContext();

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
        // Skip empty replies
        if (!replyText || replyText.trim() === "") return null;
        return formatReply({
          body: replyText,
          target: {
            voterId: item.authorAccount,
            reason: item.reason,
          },
        });
      })
      .filter(Boolean);
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

  const lastActivityTimestamp =
    arrayUtils.sortBy((p) => p.timestamp, feedItems).slice(-1)[0]?.timestamp ??
    candidate.createdTimestamp;

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
      <MainContentContainer
        sidebarWidth="28rem"
        sidebarGap="6rem"
        sidebar={<div />}
      >
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
            type="application"
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
                  dl: { lineHeight: "calc(20/14)" },
                  "dl[data-inline]": {
                    display: "grid",
                    gridTemplateColumns: "auto minmax(0,1fr)",
                    gap: "0.8rem",
                    dt: { fontSize: t.text.sizes.base },
                    dd: { textAlign: "right" },
                  },
                  dt: {
                    fontSize: t.text.sizes.small,
                    color: t.colors.textDimmed,
                    lineHeight: "calc(24/12)",

                    // marginTop: "1.6rem",
                    // paddingTop: "1.6rem",
                    // borderTop: "0.1rem solid",
                    // borderColor: t.colors.borderLight,
                  },
                  "dl:not([data-inline]) dd + dt": {
                    marginTop: "1.6rem",
                    paddingTop: "1.6rem",
                    borderTop: "0.1rem solid",
                    borderColor: t.colors.borderLight,
                  },
                  hr: {
                    marginBlock: "1.6rem",
                    border: 0,
                    borderTop: "0.1rem solid",
                    borderColor: t.colors.borderLight,
                  },
                })
              }
            >
              <div>
                <div
                  css={(t) =>
                    css({
                      borderRadius: "0.4rem",
                      overflow: "hidden",
                      background: t.colors.backgroundModifierStrong,
                      ".progress-indicator": {
                        background: t.colors.textPositive,
                        height: "0.8rem",
                      },
                    })
                  }
                >
                  <div
                    className="progress-indicator"
                    style={{ width: "30%" }}
                  />
                </div>
                <div
                  css={(t) =>
                    css({
                      fontSize: t.text.sizes.small,
                      color: t.colors.textDimmed,
                      margin: "0.8rem 0 2.8rem",
                    })
                  }
                >
                  This application has 1 sponsoring noun, <em>2 more</em> are
                  required to move application to vote.
                </div>

                <Button
                  variant="primary"
                  size="large"
                  fullWidth
                  onClick={() => toggleSponsorDialog()}
                >
                  Approve for vote
                </Button>
                <div
                  css={(t) =>
                    css({
                      fontSize: t.text.sizes.small,
                      color: t.colors.textDimmed,
                      lineHeight: "1.5",
                      marginTop: "1.6rem",
                      "p + p": { marginTop: "1em" },
                    })
                  }
                >
                  <p>
                    As a voter, you can sponsor an application to help it
                    proceed to an on-chain vote.
                  </p>
                  <p>
                    A total of 3 sponsoring Nouns are required, which can come
                    from multiple sponsors.
                  </p>
                </div>
              </div>
              {/*
              <hr />

              <dl data-inline>
                <dt>Ask</dt>
                <dd css={css({ em: { fontStyle: "normal" } })}>
                  <Tag
                    variant="success"
                    css={(t) =>
                      css({
                        fontSize: t.text.sizes.small,
                        // fontWeight: t.text.weights.normal,
                        padding: "0.2em 0.35em",
                        borderRadius: "0.4rem",
                      })
                    }
                  >
                    <AskAmounts candidateId={candidateId} />
                  </Tag>
                </dd>

                <dt>Applicant</dt>
                <dd>
                  <AccountPreviewPopoverTrigger
                    accountAddress={proposerId}
                    css={css({ fontWeight: "400" })}
                  />
                </dd>

                <dt>Submitted</dt>
                <dd>
                  <FormattedDateWithTooltip
                    value={candidate.createdTimestamp}
                    day="numeric"
                    month="long"
                    year="numeric"
                  />
                </dd>

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

                {isCanceled && (
                  <>
                    <dt>Status</dt>
                    <dd>
                      <Tag size="large" variant="error">
                        Canceled
                      </Tag>
                    </dd>
                  </>
                )}
              </dl> */}
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
          {/* <Callout
            css={(t) =>
              css({
                // border: "0.1rem solid",
                // borderColor: t.colors.borderLight,
                // borderRadius: "0.6rem",
                // padding: "1.6rem",
                marginBottom: "1.6rem",
                em: {
                  fontStyle: "normal",
                  fontWeight: t.text.weights.emphasis,
                },
              })
            }
          >
            Requesting <AskAmounts candidateId={candidateId} />
          </Callout> */}
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

const ApplicationScreen = ({ candidateId: rawId }) => {
  const candidateId = normalizeId(decodeURIComponent(rawId));

  const scrollContainerRef = React.useRef();

  const isTouchScreen = useMatchMedia("(pointer: coarse)");

  const [notFound, setNotFound] = React.useState(false);
  const [fetchError, setFetchError] = React.useState(null);
  const [isSponsorDialogOpen, toggleSponsorDialog] = useSearchParamToggleState(
    "sponsor",
    { replace: true },
  );

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
      toggleSponsorDialog,
    }),
    [isProposer, isCanceled, toggleEditDialog, toggleSponsorDialog],
  );

  const getPageActions = () => {
    if (candidate == null) return [];
    const actions = [];
    if (isTouchScreen && navigator?.share != null) {
      actions.push({
        title: <ShareIcon css={css({ width: "1.7rem" })} />,
        onSelect: () => {
          const urlToShare = `/applications/${encodeURIComponent(candidate.number ?? candidateId)}`;
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
          { to: "/applications", label: "Applications", desktopOnly: true },
          {
            to: `/applications/${encodeURIComponent(candidateId)}`,
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
          <ApplicationScreenContent
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

      {isSponsorDialogOpen && candidate != null && (
        <ErrorBoundary
          onError={() => {
            reloadPageOnce();
          }}
        >
          <React.Suspense fallback={null}>
            <SponsorDialog
              candidateId={candidateId}
              isOpen
              close={toggleSponsorDialog}
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
          Manage application
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
              if (!confirm("Are you sure you wish to close this application?"))
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
        <DropdownMenu.Item key="edit">Edit application</DropdownMenu.Item>
        <DropdownMenu.Item danger key="cancel">
          Close application
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
});

// SponsorDialog component similar to the one in candidate-screen.jsx
const SponsorDialog = React.memo(
  ({ candidateId, isOpen, close: closeDialog }) => {
    const proposerId = candidateId.split("-")[0];
    const slug = extractSlugFromCandidateId(candidateId);
    const candidate = useProposalCandidate(candidateId);

    const [expirationDate, setExpirationDate] = React.useState(() => {
      const date = new Date();
      date.setDate(date.getDate() + 14); // Defeault to 2 weeks to applications
      return date;
    });
    const [reason, setReason] = React.useState("");
    const [isSubmitting, setSubmitting] = React.useState(false);

    const signCandidate = useSignProposalCandidate(proposerId, slug);
    const addSignatureToCandidate = useAddSignatureToProposalCandidate(
      proposerId,
      slug,
      candidate.latestVersion,
    );

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (isSubmitting) return;

      setSubmitting(true);

      try {
        const expirationTimestamp = Math.floor(expirationDate.getTime() / 1000);

        const signature = await signCandidate({
          expiry: expirationTimestamp,
        });

        await addSignatureToCandidate({
          expiry: expirationTimestamp,
          signature,
          reason: reason.trim() !== "" ? reason : undefined,
        });

        closeDialog();
      } catch (err) {
        console.error(err);
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <Dialog isOpen={isOpen} onRequestClose={closeDialog}>
        {({ titleProps }) => (
          <div
            css={css({
              padding: "1.6rem",
              "@media (min-width: 600px)": { padding: "2rem" },
            })}
          >
            <DialogHeader
              title="Put application to vote"
              titleProps={titleProps}
            />
            <form onSubmit={handleSubmit}>
              <div
                css={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.6rem",
                })}
              >
                <div>
                  <p
                    css={(t) =>
                      css({
                        fontSize: t.text.sizes.base,
                        marginBottom: "0.8rem",
                      })
                    }
                  >
                    By putting this application to vote, you are sponsoring it
                    and allowing it to proceed to an on-chain vote.
                  </p>
                </div>

                <div>
                  <label
                    css={(t) =>
                      css({
                        display: "block",
                        fontSize: t.text.sizes.small,
                        fontWeight: t.text.weights.emphasis,
                        marginBottom: "0.4rem",
                      })
                    }
                  >
                    Signature expiration
                  </label>
                  <input
                    type="date"
                    value={expirationDate.toISOString().slice(0, 10)}
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      setExpirationDate(date);
                    }}
                    css={(t) =>
                      css({
                        width: "100%",
                        padding: "0.8rem 1.2rem",
                        border: "0.1rem solid",
                        borderColor: t.colors.borderMedium,
                        borderRadius: "0.6rem",
                        fontSize: t.text.sizes.base,
                      })
                    }
                    required
                  />
                </div>

                <div>
                  <label
                    css={(t) =>
                      css({
                        display: "block",
                        fontSize: t.text.sizes.small,
                        fontWeight: t.text.weights.emphasis,
                        marginBottom: "0.4rem",
                      })
                    }
                  >
                    Optional message
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Add a comment about why you're sponsoring this application"
                    css={(t) =>
                      css({
                        width: "100%",
                        minHeight: "8rem",
                        padding: "0.8rem 1.2rem",
                        border: "0.1rem solid",
                        borderColor: t.colors.borderMedium,
                        borderRadius: "0.6rem",
                        fontSize: t.text.sizes.base,
                        resize: "vertical",
                      })
                    }
                  />
                </div>

                <div
                  css={css({
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "0.8rem",
                    marginTop: "0.8rem",
                  })}
                >
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={closeDialog}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isSubmitting}
                  >
                    Sign & Sponsor
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}
      </Dialog>
    );
  },
);

export default ApplicationScreen;
