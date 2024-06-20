import React from "react";
import { css } from "@emotion/react";
import NextLink from "next/link";
import { array as arrayUtils } from "@shades/common/utils";
import Select from "@shades/ui-web/select";
import Switch from "@shades/ui-web/switch";
import * as Tooltip from "@shades/ui-web/tooltip";
import Dialog from "@shades/ui-web/dialog";
import DialogHeader from "@shades/ui-web/dialog-header";
import { useProposal, useProposalCandidate } from "../store.js";
import { useSearchParams } from "../hooks/navigation.js";
import { createRepostExtractor } from "../utils/votes-and-feedbacks.js";
import {
  useProposalDynamicQuorum,
  useDynamicQuorumParamsAt,
} from "../hooks/dao-contract.js";
import useScrollToHash from "../hooks/scroll-to-hash.js";
import useMatchDesktopLayout from "../hooks/match-desktop-layout.js";
import MarkdownRichText from "./markdown-rich-text.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import * as Tabs from "./tabs.js";
import VotingBar from "./voting-bar.js";

const ProposalVotesDialog = ({ proposalId, isOpen, close }) => (
  <Dialog
    isOpen={isOpen}
    onRequestClose={() => {
      close();
    }}
    tray
    width="126.4rem"
  >
    {(props) => <Content dismiss={close} proposalId={proposalId} {...props} />}
  </Dialog>
);

const Content = ({ proposalId, titleProps, dismiss }) => {
  const isDesktopLayout = useMatchDesktopLayout();

  const proposal = useProposal(proposalId);
  const candidate = useProposalCandidate(proposal?.candidateId);

  const [showReason, setShowReason] = React.useState(false);
  const [sortStrategy, setSortStrategy] = React.useState("voting-power");

  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTab = searchParams.get("votes-dialog-tab") ?? "for";

  const quorum = useProposalDynamicQuorum(proposalId);
  const quorumParams = useDynamicQuorumParamsAt(proposal?.createdBlock);

  const ascendingPosts = React.useMemo(() => {
    if (proposal == null) return [];

    const votes = (proposal.votes ?? []).map((v) => ({ ...v, type: "vote" }));

    const feedbackPosts = [
      ...(proposal.feedbackPosts_ ?? []),
      ...(candidate?.feedbackPosts_ ?? []),
    ].map((p) => ({
      ...p,
      type: "feedback-post",
    }));

    return arrayUtils.sortBy("createdBlock", [...votes, ...feedbackPosts]);
  }, [proposal, candidate]);

  useScrollToHash({ behavior: "smooth" });

  if (proposal == null) return null;

  const [forVotes, abstainVotes, againstVotes] = proposal.votes?.reduce(
    ([for_, abstain, against], v) => {
      switch (v.support) {
        case 0:
          return [for_, abstain, [...against, v]];
        case 1:
          return [[...for_, v], abstain, against];
        case 2:
          return [for_, [...abstain, v], against];
        default:
          throw new Error();
      }
    },
    [[], [], []],
  ) ?? [[], [], []];

  const sortVotes = (votes) => {
    switch (sortStrategy) {
      case "voting-power":
        return arrayUtils.sortBy(
          { value: (v) => v.votes, order: "desc" },
          (v) => v.reason != null && v.reason.trim() !== "",
          votes,
        );
      case "chronological":
        return arrayUtils.sortBy("createdBlock", votes);

      default:
        throw new Error();
    }
  };

  const renderVoteList = (votes) => {
    if (votes.length === 0)
      return (
        <div css={css({ padding: "2.4rem 0", fontStyle: "italic" })}>
          No votes
        </div>
      );

    return (
      <ul
        className="votes-container"
        data-show-reason={showReason}
        css={(t) => {
          return css({
            listStyle: "none",
            ".vote-item + .vote-item": { marginTop: "1.6rem" },
            '[data-show-reason="true"] .vote-item + .vote-item': {
              marginTop: "3.2rem",
            },
            ".vote-body": {
              margin: "0.625em 0 0",
              userSelect: "text",
            },
            "ul.reposts-container": {
              margin: "1.2rem 0",
              listStyle: "none",
              fontSize: "0.875em",
              marginBottom: "0.8rem",
              li: {
                position: "relative",
                border: "0.1rem solid",
                borderRadius: "0.5rem",
                borderColor: t.colors.borderLighter,
                padding: "0.4rem 0.6rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                ".repost-link": {
                  display: "block",
                  position: "absolute",
                  inset: 0,
                },
              },
              "li + li": { marginTop: "0.6rem" },
            },
          });
        }}
      >
        {sortVotes(votes).map((v) => {
          const voteIndex = ascendingPosts.indexOf(v);
          const extractReposts = createRepostExtractor(
            ascendingPosts.slice(0, voteIndex),
          );
          const [reposts, strippedReason] = extractReposts(v.reason);
          const hasReason =
            strippedReason != null && strippedReason.trim() !== "";
          const isRevote =
            reposts.length > 0 &&
            reposts.every((p) => p.support === 2 || p.support === v.support);

          return (
            <li key={v.id} id={v.id} className="vote-item">
              <div className="vote-header">
                <AccountPreviewPopoverTrigger
                  showAvatar
                  avatarFallback
                  accountAddress={v.voterId}
                />{" "}
                ({v.votes})
                {showReason ? (
                  isRevote && <> revoted</>
                ) : hasReason ? (
                  <>
                    {" "}
                    <Tooltip.Root>
                      <Tooltip.Trigger>...</Tooltip.Trigger>
                      <Tooltip.Content
                        style={{
                          maxWidth: "min(36rem, calc(100vw - 2rem))",
                        }}
                      >
                        <PostReasonRichText text={strippedReason} compact />
                      </Tooltip.Content>
                    </Tooltip.Root>
                  </>
                ) : null}
              </div>

              {showReason && (
                <>
                  {reposts.length > 0 && (
                    <ul className="reposts-container">
                      {reposts.map((p) => {
                        const supportWord = {
                          0: "against",
                          1: "for",
                          2: "abstain",
                        }[p.support];

                        const search = new URLSearchParams(searchParams);
                        search.set("votes-dialog-tab", supportWord);

                        return (
                          <li key={p.id}>
                            {p.type === "vote" && (
                              <NextLink
                                className="repost-link"
                                href={`?${search}#${p.id}`}
                              />
                            )}
                            <AccountPreviewPopoverTrigger
                              showAvatar
                              accountAddress={p.voterId}
                              // relative to make it appear on top of the overlay link
                              style={{ position: "relative" }}
                            />
                            {(() => {
                              if (isRevote) return null;

                              return (
                                <>
                                  {" "}
                                  <span data-support={p.support}>
                                    ({supportWord})
                                  </span>
                                </>
                              );
                            })()}
                            :{" "}
                            <PostReasonRichText
                              text={p.reason}
                              compact={p.type !== "vote"}
                              inline={p.type === "vote"}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {hasReason && (
                    <div className="vote-body">
                      <PostReasonRichText text={strippedReason} compact />
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div
      css={(t) =>
        css({
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          "[data-support]": { fontWeight: t.text.weights.emphasis },
          '[data-support="1"]': { color: t.colors.textPositive },
          '[data-support="0"]': { color: t.colors.textNegative },
          '[data-support="2"]': { color: t.colors.textDimmed },
          h2: {
            fontSize: t.text.sizes.base,
            fontWeight: t.text.weights.normal,
            borderBottom: "0.1rem solid",
            borderColor: t.colors.borderLight,
            paddingBottom: "0.6rem",
            "[data-support]": { fontWeight: t.text.weights.emphasis },
          },
        })
      }
    >
      <DialogHeader
        title="Vote overview"
        titleProps={titleProps}
        subtitle={(() => {
          const maxQuorumVotes = Math.floor(
            (proposal.adjustedTotalSupply * quorumParams.maxQuorumVotesBPS) /
              10000,
          );
          return (
            <>
              {proposal.forVotes +
                proposal.againstVotes +
                proposal.abstainVotes}{" "}
              nouns &middot; {proposal.votes.length} voters &middot; Quorum{" "}
              {quorum}{" "}
              <span css={(t) => css({ color: t.colors.textDimmed })}>
                {maxQuorumVotes > quorum ? (
                  <>(max {maxQuorumVotes})</>
                ) : (
                  "(max)"
                )}
              </span>
            </>
          );
        })()}
        dismiss={dismiss}
        css={css({
          margin: "0",
          padding: "1.6rem",
          "@media (min-width: 600px)": {
            margin: "0",
          },
          "@media (min-width: 996px)": {
            padding: "3.2rem 3.2rem 2.4rem",
          },
        })}
      />
      <div
        css={css({
          padding: "0 1.6rem 1.6rem",
          ".filters-container": {
            marginTop: "1.6rem",
            display: "flex",
            alignItems: "center",
            gap: "1.6rem",
          },
          "@media (min-width: 996px)": {
            padding: "0 3.2rem 3.2rem",
            ".filters-container": {
              marginTop: "2.4rem",
              display: "flex",
              alignItems: "center",
              gap: "2.4rem",
            },
          },
        })}
      >
        <VotingBar
          height={isDesktopLayout ? "1.2rem" : "0.8rem"}
          votes={proposal.votes}
          quorumVotes={quorum}
        />
        <div className="filters-container">
          <Select
            size="small"
            aria-label="Vote sorting"
            value={sortStrategy}
            options={[
              { value: "voting-power", label: "By voting power" },
              {
                value: "chronological",
                label: "Chronological",
              },
            ]}
            onChange={setSortStrategy}
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
          <Switch
            value={showReason}
            onChange={setShowReason}
            label="Show reason"
          />
        </div>
      </div>
      {isDesktopLayout ? (
        <>
          <main
            css={css({
              flex: 1,
              minHeight: 0,
              padding: "0 3.2rem",
              ".grid": {
                height: "100%",
                display: "grid",
                gap: "3.2rem",
                gridTemplateColumns: "repeat(3, minmax(0,1fr))",
                ".votes-column": {
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                },
                ".votes-container": {
                  flex: 1,
                  minHeight: 0,
                  overflow: "auto",
                  margin: "0 -1.6rem",
                  padding: "2.4rem 1.6rem 3.2rem",
                  maskImage:
                    "linear-gradient(180deg, transparent 0%, black 3.2rem, black calc(100% - 3.2rem), transparent 100%)",
                },
              },
            })}
          >
            <div className="grid">
              {[
                {
                  support: 1,
                  votingPower: proposal.forVotes,
                  votes: forVotes,
                },
                {
                  support: 2,
                  votingPower: proposal.abstainVotes,
                  votes: abstainVotes,
                },
                {
                  support: 0,
                  votingPower: proposal.againstVotes,
                  votes: againstVotes,
                },
              ].map(({ support, votingPower, votes = [] }, i) => {
                const title = { 0: "AGAINST", 1: "FOR", 2: "ABSTAIN" }[support];
                return (
                  <div key={i} className="votes-column">
                    <h2>
                      <span data-support={support}>{title}</span>
                      {votingPower > 0 && (
                        <>
                          {" "}
                          {"\u00B7"} {votingPower}{" "}
                          {votingPower === 1 ? "noun" : "nouns"}, {votes.length}{" "}
                          {votes.length === 1 ? "voter" : "voters"}
                        </>
                      )}
                    </h2>
                    {renderVoteList(votes)}
                  </div>
                );
              })}
            </div>
          </main>
        </>
      ) : (
        <main
          css={(t) =>
            css({
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              "[role=tab]": { fontSize: t.text.sizes.base },
              "[role=tablist]": { padding: "0 1.6rem" },
              "[role=tabpanel]": {
                flex: 1,
                minHeight: 0,
                overflow: "auto",
                padding: "3.2rem 1.6rem 6.4rem",
              },
            })
          }
        >
          <Tabs.Root
            aria-label="Votes"
            selectedKey={selectedTab}
            onSelectionChange={(key) => {
              setSearchParams(
                (p) => {
                  const newParams = new URLSearchParams(p);
                  newParams.set("votes-dialog-tab", key);
                  return newParams;
                },
                { replace: true },
              );
            }}
          >
            {[
              {
                support: 1,
                votingPower: proposal.forVotes,
                votes: forVotes,
              },
              {
                support: 0,
                votingPower: proposal.againstVotes,
                votes: againstVotes,
              },
              {
                support: 2,
                votingPower: proposal.abstainVotes,
                votes: abstainVotes,
              },
            ].map(({ support, votingPower, votes = [] }) => {
              const title = { 0: "Against", 1: "For", 2: "Abstain" }[support];
              return (
                <Tabs.Item
                  key={title.toLowerCase()}
                  title={`${title} (${votingPower})`}
                >
                  {renderVoteList(votes)}
                </Tabs.Item>
              );
            })}
          </Tabs.Root>
        </main>
      )}
    </div>
  );
};

const PostReasonRichText = (props) => (
  <MarkdownRichText
    css={css({
      // Make all headings small
      "h1,h2,h3,h4,h5,h6": { fontSize: "1em" },
      "*+h1,*+h2,*+h3,*+h4,*+h5,*+h6": {
        marginTop: "1.5em",
      },
      "h1:has(+*),h2:has(+*),h3:has(+*),h4:has(+*),h5:has(+*),h6:has(+*)": {
        marginBottom: "0.625em",
      },
    })}
    {...props}
  />
);

export default ProposalVotesDialog;
