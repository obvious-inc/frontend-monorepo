import React from "react";
import {
  Link as RouterLink,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { css, useTheme } from "@emotion/react";
import { useBlockNumber } from "wagmi";
import { useFetch } from "@shades/common/react";
import { useAccountDisplayName } from "@shades/common/app";
import {
  array as arrayUtils,
  message as messageUtils,
} from "@shades/common/utils";
import { Noggles as NogglesIcon } from "@shades/ui-web/icons";
import Avatar from "@shades/ui-web/avatar";
import Input from "@shades/ui-web/input";
import Button from "@shades/ui-web/button";
import {
  useProposal,
  useProposals,
  isFinalProposalState,
  isVotableProposalState,
  useProposalThreshold,
} from "../hooks/dao.js";
import { useWallet } from "../hooks/wallet.js";
import {
  useActions as usePrechainActions,
  useProposalCandidates,
  useProposalCandidate,
  useProposalCandidateVotingPower,
} from "../hooks/prechain.js";
import useApproximateBlockTimestampCalculator from "../hooks/approximate-block-timestamp-calculator.js";
import {
  useCollection as useDrafts,
  useSingleItem as useDraft,
} from "../hooks/channel-drafts.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import {
  Layout,
  MainContentContainer,
  ActivityFeed,
  buildProposalFeed,
} from "./proposal-screen.js";
import { buildCandidateFeed } from "./proposal-candidate-screen.js";

const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
const APPROXIMATE_SECONDS_PER_BLOCK = 12;
const APPROXIMATE_BLOCKS_PER_DAY =
  ONE_DAY_IN_SECONDS / APPROXIMATE_SECONDS_PER_BLOCK;

const searchProposals = (items, rawQuery) => {
  const query = rawQuery.trim().toLowerCase();

  const filteredItems = items
    .map((i) => {
      const title = i.title ?? i.latestVersion?.content.title ?? i.name;
      return {
        ...i,
        index: title == null ? -1 : title.toLowerCase().indexOf(query),
      };
    })
    .filter((i) => i.index !== -1);

  return arrayUtils.sortBy(
    { value: (i) => i.index, type: "index" },
    filteredItems
  );
};

const useFeedItems = () => {
  const { data: latestBlockNumber } = useBlockNumber();
  const proposals = useProposals();
  const candidates = useProposalCandidates();

  // const calculateBlockTimestamp = useApproximateBlockTimestampCalculator();

  return React.useMemo(() => {
    const proposalItems = proposals.flatMap((p) =>
      buildProposalFeed(p, {
        latestBlockNumber,
        // calculateBlockTimestamp,
      })
    );

    const candidateItems = candidates.flatMap((c) =>
      buildCandidateFeed(c, { skipSignatures: true })
    );

    return arrayUtils.sortBy({ value: (i) => i.blockNumber, order: "desc" }, [
      ...proposalItems,
      ...candidateItems,
    ]);
  }, [
    proposals,
    candidates,
    // calculateBlockTimestamp,
    latestBlockNumber,
  ]);
};

const PROPOSALS_PAGE_ITEM_COUNT = 20;

const BrowseScreen = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const deferredQuery = React.useDeferredValue(query.trim());

  const { address: connectedWalletAccountAddress } = useWallet();

  const proposals = useProposals();
  const proposalCandidates = useProposalCandidates();
  const { items: proposalDrafts } = useDrafts();

  const [page, setPage] = React.useState(1);

  const filteredItems = React.useMemo(() => {
    const filteredProposalDrafts = proposalDrafts
      .filter(
        (d) =>
          d.name.trim() !== "" || !messageUtils.isEmpty(d.body, { trim: true })
      )
      .map((d) => ({ ...d, type: "draft" }));

    const filteredProposalCandidates = proposalCandidates.filter(
      (c) => c.latestVersion != null
    );

    const items = [
      ...filteredProposalDrafts,
      ...filteredProposalCandidates,
      ...proposals,
    ];

    return deferredQuery === "" ? items : searchProposals(items, deferredQuery);
  }, [deferredQuery, proposals, proposalCandidates, proposalDrafts]);

  const groupedItemsByName = arrayUtils.groupBy((i) => {
    if (i.type === "draft") return "drafts";
    // Candidates
    if (i.slug != null) return "ongoing";

    if (isFinalProposalState(i.state)) return "past";

    if (
      connectedWalletAccountAddress != null &&
      isVotableProposalState(i.state) &&
      i.votes != null &&
      i.votes.every(
        (v) =>
          v.voter.id.toLowerCase() !==
          connectedWalletAccountAddress.toLowerCase()
      )
    )
      return "awaiting-vote";

    return "ongoing";
  }, filteredItems);

  const { fetchBrowseScreenData } = usePrechainActions();

  useFetch(
    () =>
      fetchBrowseScreenData({ first: 15 }).then(() => {
        fetchBrowseScreenData({ skip: 15, first: 15 }).then(() => {
          fetchBrowseScreenData({ skip: 30, first: 1000 });
        });
      }),
    [fetchBrowseScreenData]
  );

  return (
    <Layout>
      <div css={css({ padding: "0 1.6rem" })}>
        <MainContentContainer sidebar={<FeedSidebar />}>
          <div
            css={css({
              padding: "1rem 0 3.2rem",
              "@media (min-width: 600px)": {
                padding: "6rem 0 8rem",
              },
            })}
          >
            <div
              css={(t) =>
                css({
                  background: t.colors.backgroundPrimary,
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "1.6rem",
                  paddingTop: "0.3rem", // To offset the focus box shadow
                  marginBottom: "1.6rem",
                  "@media (min-width: 600px)": {
                    marginBottom: "3.2rem",
                  },
                })
              }
            >
              <Input
                placeholder="Search..."
                value={query}
                onChange={(e) => {
                  // Clear search from path if query is empty
                  if (e.target.value.trim() === "") {
                    setSearchParams({});
                    setPage(2);
                    return;
                  }

                  setSearchParams({ q: e.target.value });
                }}
                css={css({
                  flex: 1,
                  minWidth: 0,
                  padding: "0.9rem 1.2rem",
                })}
              />

              {searchParams.get("beta") != null && (
                <Button
                  onClick={() => {
                    navigate("/new");
                  }}
                >
                  New proposal
                </Button>
              )}
            </div>

            <ul
              role={filteredItems.length === 0 ? "presentation" : undefined}
              css={(t) => {
                const hoverColor = t.colors.backgroundTertiary;
                return css({
                  listStyle: "none",
                  containerType: "inline-size",
                  "li + li": { marginTop: "2.4rem" },
                  ul: { listStyle: "none" },
                  "[data-group] li + li": { marginTop: "1rem" },
                  "[data-group-title]": {
                    position: "sticky",
                    top: "4.35rem",
                    padding: "0.5rem 0",
                    background: t.colors.backgroundPrimary,
                    textTransform: "uppercase",
                    fontSize: t.text.sizes.small,
                    fontWeight: t.text.weights.emphasis,
                    color: t.colors.textMuted,
                  },

                  "[data-placeholder]": {
                    background: hoverColor,
                    borderRadius: "0.3rem",
                  },
                  "[data-group-title][data-placeholder]": {
                    height: "2rem",
                    width: "12rem",
                    marginBottom: "1rem",
                  },
                  "[data-group] li[data-placeholder]": {
                    height: "6.2rem",
                  },
                  "[data-group] li + li[data-placeholder]": {
                    marginTop: "1rem",
                  },
                  a: {
                    display: "block",
                    textDecoration: "none",
                    padding: "0.8rem 0",
                    color: t.colors.textNormal,
                    borderRadius: "0.5rem",
                  },
                  "[data-title]": {
                    fontSize: t.text.sizes.large,
                    fontWeight: t.text.weights.emphasis,
                    lineHeight: 1.25,
                    // whiteSpace: "nowrap",
                    // overflow: "hidden",
                    // textOverflow: "ellipsis",
                  },
                  "[data-small]": {
                    color: t.colors.textDimmed,
                    fontSize: t.text.sizes.small,
                    lineHeight: 1.4,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  },
                  '[data-dimmed="true"]': {
                    color: t.colors.textMuted,
                    "[data-small]": {
                      color: t.colors.textMuted,
                    },
                  },
                  // Mobile-only
                  "@container(max-width: 600px)": {
                    "[data-desktop-only]": {
                      display: "none",
                    },
                  },
                  // Desktop-only
                  "@container(min-width: 600px)": {
                    "[data-mobile-only]": {
                      display: "none",
                    },
                    "[data-group] li + li": { marginTop: "0.4rem" },
                    a: {
                      display: "grid",
                      alignItems: "center",
                      gridTemplateColumns: "auto minmax(0,1fr)",
                      gridGap: "1rem",
                    },
                    // "[data-title]": {
                    //   whiteSpace: "normal",
                    // },
                  },
                  // Hover enhancement
                  "@media(hover: hover)": {
                    "a:hover": {
                      background: `linear-gradient(90deg, transparent 0%, ${hoverColor} 20%, ${hoverColor} 80%, transparent 100%)`,
                    },
                  },
                });
              }}
            >
              {filteredItems.length === 0 ? (
                <li data-group key="placeholder">
                  <div data-group-title data-placeholder />
                  <ul>
                    {Array.from({ length: 15 }).map((_, i) => (
                      <li key={i} data-placeholder />
                    ))}
                  </ul>
                </li>
              ) : (
                ["drafts", "awaiting-vote", "ongoing", "past"]
                  .map((groupName) => ({
                    name: groupName,
                    items: groupedItemsByName[groupName],
                  }))
                  .filter(({ items }) => items != null && items.length !== 0)
                  .map(({ name: groupName, items }) => {
                    const getSortedItems = () => {
                      // Keep order from search result
                      if (deferredQuery !== "") return items;

                      switch (groupName) {
                        case "drafts":
                          return arrayUtils.sortBy(
                            { value: (i) => Number(i.id), order: "desc" },
                            items
                          );

                        case "past": {
                          const sortedItems = arrayUtils.sortBy(
                            {
                              value: (i) => Number(i.startBlock),
                              order: "desc",
                            },
                            items
                          );
                          return sortedItems.slice(
                            0,
                            PROPOSALS_PAGE_ITEM_COUNT * page
                          );
                        }

                        case "ongoing":
                        case "awaiting-vote":
                          return arrayUtils.sortBy(
                            // First the active ones
                            (i) =>
                              ["active", "objection-period"].includes(i.state)
                                ? Number(
                                    i.objectionPeriodEndBlock ?? i.endBlock
                                  )
                                : Infinity,
                            // The the ones that hasn’t started yet
                            (i) =>
                              ["updatable", "pending"].includes(i.state)
                                ? Number(i.startBlock)
                                : Infinity,
                            // Then the succeeded but not yet executed
                            {
                              value: (i) =>
                                i.slug != null
                                  ? 0
                                  : Number(
                                      i.objectionPeriodEndBlock ?? i.endBlock
                                    ),
                              order: "desc",
                            },
                            // And last the candidates
                            {
                              value: (i) => i.lastUpdatedTimestamp,
                              order: "desc",
                            },
                            items
                          );
                      }
                    };
                    const title =
                      groupName === "ongoing"
                        ? "Current"
                        : groupName === "awaiting-vote"
                        ? "Not yet voted"
                        : groupName;
                    return (
                      <li data-group key={groupName}>
                        <div data-group-title>{title}</div>
                        <ul>
                          {getSortedItems().map((i) => (
                            <li key={i.id}>
                              {i.type === "draft" ? (
                                <ProposalDraftItem draftId={i.id} />
                              ) : i.slug != null ? (
                                <ProposalCandidateItem candidateId={i.id} />
                              ) : (
                                <ProposalItem proposalId={i.id} />
                              )}
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  })
              )}
            </ul>
            {groupedItemsByName.past != null &&
              groupedItemsByName.past.length >
                PROPOSALS_PAGE_ITEM_COUNT * page && (
                <div css={{ textAlign: "center", padding: "3.2rem 0" }}>
                  <Button
                    size="small"
                    onClick={() => {
                      setPage((p) => p + 1);
                    }}
                  >
                    Show more
                  </Button>
                </div>
              )}
          </div>
        </MainContentContainer>
      </div>
    </Layout>
  );
};

const FEED_PAGE_ITEM_COUNT = 30;

const FeedSidebar = React.memo(() => {
  const { data: latestBlockNumber } = useBlockNumber({
    watch: true,
    cache: 20_000,
  });

  const { fetchNounsActivity } = usePrechainActions();

  const [page, setPage] = React.useState(2);
  const feedItems = useFeedItems();
  const visibleItems = feedItems.slice(0, FEED_PAGE_ITEM_COUNT * page);

  // Fetch feed items
  useFetch(
    latestBlockNumber == null
      ? null
      : () =>
          fetchNounsActivity({
            startBlock:
              latestBlockNumber - BigInt(APPROXIMATE_BLOCKS_PER_DAY * 30),
            endBlock: latestBlockNumber,
          }),
    [latestBlockNumber, fetchNounsActivity]
  );

  if (visibleItems.length === 0) return null;

  return (
    <div
      css={css({
        padding: "1rem 0 3.2rem",
        "@media (min-width: 600px)": {
          padding: "6rem 0 8rem",
        },
      })}
    >
      <ActivityFeed items={visibleItems} />
      {feedItems.length > visibleItems.length && (
        <div css={{ textAlign: "center", padding: "3.2rem 0" }}>
          <Button
            size="small"
            onClick={() => {
              setPage((p) => p + 1);
            }}
          >
            Show more
          </Button>
        </div>
      )}
    </div>
  );
});

const ProposalItem = React.memo(({ proposalId }) => {
  const theme = useTheme();
  const proposal = useProposal(proposalId);
  const { displayName: authorAccountDisplayName } = useAccountDisplayName(
    proposal.proposer?.id
  );

  const isDimmed =
    proposal.state != null && ["canceled", "expired"].includes(proposal.state);

  const tagWithStatusText = <PropTagWithStatusText proposalId={proposalId} />;

  return (
    <RouterLink to={`/proposals/${proposalId}`} data-dimmed={isDimmed}>
      <Avatar
        signature={proposalId}
        signatureLength={3}
        size="3.2rem"
        background={isDimmed ? theme.colors.backgroundModifierHover : undefined}
        data-desktop-only
      />
      <div
        css={css({
          display: "grid",
          gridTemplateColumns: "minmax(0,auto) minmax(min-content,1fr)",
          gridGap: "1.6rem",
          alignItems: "center",
        })}
      >
        <div>
          <div data-small>
            Prop {proposalId} by{" "}
            <em
              css={(t) =>
                css({
                  fontWeight: t.text.weights.emphasis,
                  fontStyle: "normal",
                })
              }
            >
              {authorAccountDisplayName ?? "..."}
            </em>
          </div>
          <div data-title>{proposal.title}</div>
          <div data-small data-mobile-only css={css({ marginTop: "0.2rem" })}>
            <PropStatusText proposalId={proposalId} />
          </div>
        </div>
        <div data-small>{tagWithStatusText}</div>
      </div>
    </RouterLink>
  );
});

const PropStatusText = ({ proposalId }) => {
  const proposal = useProposal(proposalId);

  const calculateBlockTimestamp = useApproximateBlockTimestampCalculator();

  const startDate = calculateBlockTimestamp(proposal.startBlock);
  const endDate = calculateBlockTimestamp(proposal.endBlock);
  const objectionPeriodEndDate = calculateBlockTimestamp(
    proposal.objectionPeriodEndBlock
  );

  switch (proposal.state) {
    case "updatable":
    case "pending":
      return (
        <>
          Starts{" "}
          <FormattedDateWithTooltip
            relativeDayThreshold={5}
            capitalize={false}
            value={startDate}
            day="numeric"
            month="long"
          />
        </>
      );

    case "active":
      return (
        <>
          <div
            css={(t) =>
              css({
                display: "inline-flex",
                '[role="separator"]:before': {
                  content: '",\u{00a0}"',
                },
                "@media(min-width: 800px)": {
                  flexDirection: "row-reverse",
                  '[role="separator"]:before': {
                    content: '"|"',
                    color: t.colors.borderLight,
                    margin: "0 1rem",
                  },
                  "[data-description]::first-letter": {
                    textTransform: "uppercase",
                  },
                },
              })
            }
          >
            <span data-votes>
              {proposal.forVotes} For {"-"} {proposal.againstVotes} Against
            </span>
            <span role="separator" aria-orientation="vertical" />
            <span data-description>
              voting ends{" "}
              <FormattedDateWithTooltip
                relativeDayThreshold={5}
                capitalize={false}
                value={endDate}
                day="numeric"
                month="long"
              />
            </span>
          </div>
        </>
      );

    case "objection-period":
      return (
        <>
          Objection period ends{" "}
          <FormattedDateWithTooltip
            relativeDayThreshold={5}
            capitalize={false}
            value={objectionPeriodEndDate}
            day="numeric"
            month="long"
          />
        </>
      );

    case "queued":
      return "Queued for execution";

    case "canceled":
    case "expired":
    case "defeated":
    case "vetoed":
    case "succeeded":
    case "executed":
      return null;

    default:
      return null;
  }
};

const PropTagWithStatusText = ({ proposalId }) => {
  const statusText = <PropStatusText proposalId={proposalId} />;

  return (
    <div
      css={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "1.6rem",
        textAlign: "right",
      })}
    >
      {statusText != null && <div data-desktop-only>{statusText}</div>}
      <PropStatusTag proposalId={proposalId} />
    </div>
  );
};

const PropStatusTag = ({ proposalId }) => {
  const proposal = useProposal(proposalId);

  switch (proposal.state) {
    case "updatable":
    case "pending":
      return <Tag size="large">Pending</Tag>;

    case "active":
      return (
        <Tag variant="active" size="large">
          Ongoing
        </Tag>
      );

    case "objection-period":
      return (
        <Tag variant="warning" size="large">
          Objection period
        </Tag>
      );

    case "canceled":
    case "expired":
      return <Tag size="large">{proposal.state}</Tag>;

    case "defeated":
    case "vetoed":
      return (
        <Tag variant="error" size="large">
          {proposal.state}
        </Tag>
      );

    case "succeeded":
    case "executed":
      return (
        <Tag variant="success" size="large">
          {proposal.state}
        </Tag>
      );

    case "queued":
      return (
        <Tag variant="success" size="large">
          Succeeded
        </Tag>
      );

    default:
      return null;
  }
};

const ProposalCandidateItem = React.memo(({ candidateId }) => {
  const candidate = useProposalCandidate(candidateId);
  const { displayName: authorAccountDisplayName } = useAccountDisplayName(
    candidate.proposer
  );
  const votingPower = useProposalCandidateVotingPower(candidateId);
  const proposalThreshold = useProposalThreshold();
  const isCanceled = candidate.canceledTimestamp != null;

  const statusText =
    votingPower > proposalThreshold ? (
      <>Sponsor threshold met</>
    ) : (
      <>
        {votingPower} / {proposalThreshold + 1}
        <NogglesIcon
          style={{
            display: "inline-flex",
            width: "1.7rem",
            height: "auto",
            position: "relative",
            top: "-0.1rem",
            marginLeft: "0.5rem",
          }}
        />
      </>
    );

  return (
    <RouterLink to={`/candidates/${encodeURIComponent(candidateId)}`}>
      <Avatar
        signature={candidate.slug}
        signatureLength={2}
        size="3.2rem"
        data-desktop-only
      />
      <div
        css={css({
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto",
          gridGap: "1.6rem",
          alignItems: "center",
        })}
      >
        <div>
          <div data-small>
            Candidate by{" "}
            <em
              css={(t) =>
                css({
                  fontWeight: t.text.weights.emphasis,
                  fontStyle: "normal",
                })
              }
            >
              {authorAccountDisplayName ?? "..."}
            </em>
          </div>
          <div data-title>{candidate.latestVersion.content.title}</div>
          <div data-mobile-only data-small css={css({ marginTop: "0.2rem" })}>
            {statusText}
          </div>
        </div>
        <div
          data-small
          css={css({ display: "flex", gap: "1.6rem", alignItems: "center" })}
        >
          <div data-desktop-only>{statusText}</div>
          <Tag variant={isCanceled ? "error" : "special"} size="large">
            {isCanceled
              ? "Canceled candidate"
              : candidate.latestVersion.targetProposalId != null
              ? "Update candidate"
              : "Candidate"}
          </Tag>
        </div>
      </div>
    </RouterLink>
  );
});

const ProposalDraftItem = ({ draftId }) => {
  const [draft] = useDraft(draftId);
  const { address: connectedAccountAddress } = useWallet();
  const { displayName: authorAccountDisplayName } = useAccountDisplayName(
    connectedAccountAddress
  );

  return (
    <RouterLink to={`/new/${draftId}`}>
      <Avatar
        signature={draft.name || "Untitled draft"}
        signatureLength={2}
        size="3.2rem"
        data-desktop-only
      />
      <div
        css={css({
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto",
          gridGap: "1.6rem",
          alignItems: "center",
        })}
      >
        <div>
          <div data-small>
            By{" "}
            <em
              css={(t) =>
                css({
                  fontWeight: t.text.weights.emphasis,
                  fontStyle: "normal",
                })
              }
            >
              {authorAccountDisplayName ?? "..."}
            </em>
          </div>
          <div data-title>{draft.name || "Untitled draft"}</div>
        </div>
        <Tag size="large">Draft</Tag>
      </div>
    </RouterLink>
  );
};

export const Tag = ({ variant, size = "normal", ...props }) => (
  <span
    data-variant={variant}
    data-size={size}
    css={(t) =>
      css({
        display: "inline-flex",
        background: t.colors.backgroundModifierHover,
        color: t.colors.textDimmed,
        fontSize: t.text.sizes.tiny,
        fontWeight: "400",
        textTransform: "uppercase",
        padding: "0.1rem 0.3rem",
        borderRadius: "0.2rem",
        lineHeight: 1.2,
        '&[data-size="large"]': { padding: "0.3rem 0.5rem" },
        '&[data-variant="active"]': {
          color: t.colors.textPrimary,
          background: "#deedfd",
        },
        '&[data-variant="success"]': {
          color: "#097045",
          background: "#e0f1e1",
        },
        '&[data-variant="error"]': {
          color: t.colors.textNegative,
          background: "#fbe9e9",
        },
        '&[data-variant="special"]': {
          color: "#8d519d",
          background: "#f2dff7",
        },
      })
    }
    {...props}
  />
);

export default BrowseScreen;
