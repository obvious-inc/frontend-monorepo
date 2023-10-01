import datesDifferenceInDays from "date-fns/differenceInCalendarDays";
import dateSubtractDays from "date-fns/subDays";
import dateStartOfDay from "date-fns/startOfDay";
import React from "react";
import {
  Link as RouterLink,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { css } from "@emotion/react";
import { useBlockNumber } from "wagmi";
import { useFetch, useMatchMedia } from "@shades/common/react";
import { useAccountDisplayName, useCachedState } from "@shades/common/app";
import {
  array as arrayUtils,
  object as objectUtils,
  message as messageUtils,
} from "@shades/common/utils";
import Input from "@shades/ui-web/input";
import Button from "@shades/ui-web/button";
import Select from "@shades/ui-web/select";
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
import * as Tabs from "./tabs.js";
import Layout, { MainContentContainer } from "./layout.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import {
  ActivityFeed as ActivityList,
  buildProposalFeed,
} from "./proposal-screen.js";
import { buildCandidateFeed } from "./proposal-candidate-screen.js";

const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
const APPROXIMATE_SECONDS_PER_BLOCK = 12;
const APPROXIMATE_BLOCKS_PER_DAY =
  ONE_DAY_IN_SECONDS / APPROXIMATE_SECONDS_PER_BLOCK;

const CANDIDATE_ACTIVE_THRESHOLD_IN_DAYS = 5;

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

const useFeedItems = ({ filter }) => {
  const { data: eagerLatestBlockNumber } = useBlockNumber({
    watch: true,
    cacheTime: 10_000,
  });
  const latestBlockNumber = React.useDeferredValue(eagerLatestBlockNumber);

  const proposals = useProposals({ state: true });
  const candidates = useProposalCandidates();

  return React.useMemo(() => {
    const proposalItems =
      filter === "candidates"
        ? []
        : proposals.flatMap((p) => buildProposalFeed(p, { latestBlockNumber }));

    const candidateItems =
      filter === "proposals"
        ? []
        : candidates.flatMap((c) =>
            buildCandidateFeed(c, { skipSignatures: true })
          );

    return arrayUtils.sortBy({ value: (i) => i.blockNumber, order: "desc" }, [
      ...proposalItems,
      ...candidateItems,
    ]);
  }, [proposals, candidates, filter, latestBlockNumber]);
};

const BROWSE_LIST_PAGE_ITEM_COUNT = 20;

const BrowseScreen = () => {
  const scrollContainerRef = React.useRef();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isDesktopLayout = useMatchMedia("(min-width: 952px)");

  const query = searchParams.get("q") ?? "";
  const deferredQuery = React.useDeferredValue(query.trim());

  const { address: connectedWalletAccountAddress } = useWallet();

  const proposals = useProposals({ state: true });
  const candidates = useProposalCandidates();
  const { items: proposalDrafts } = useDrafts();

  const [page, setPage] = React.useState(1);
  const [candidateSortStrategy_, setCandidateSortStrategy] = useCachedState(
    "candidate-sorting-strategy",
    "activity"
  );

  const candidateSortStrategy =
    connectedWalletAccountAddress == null ? "activity" : candidateSortStrategy_;

  const filteredProposals = React.useMemo(
    () => proposals.filter((p) => p.startBlock != null),
    [proposals]
  );
  const filteredCandidates = React.useMemo(
    () => candidates.filter((c) => c.latestVersion != null),
    [candidates]
  );

  const filteredItems = React.useMemo(() => {
    const filteredProposalDrafts = proposalDrafts
      .filter(
        (d) =>
          d.name.trim() !== "" || !messageUtils.isEmpty(d.body, { trim: true })
      )
      .map((d) => ({ ...d, type: "draft" }));

    const items = [
      ...filteredProposalDrafts,
      ...filteredCandidates,
      ...filteredProposals,
    ];

    return deferredQuery === "" ? items : searchProposals(items, deferredQuery);
  }, [deferredQuery, filteredProposals, filteredCandidates, proposalDrafts]);

  const groupProposal = (p) => {
    const connectedAccount = connectedWalletAccountAddress?.toLowerCase();

    if (["pending", "updatable"].includes(p.state)) return "proposals:new";
    if (isFinalProposalState(p.state)) return "proposals:past";

    if (connectedAccount == null) return "proposals:ongoing";

    if (
      p.proposerId.toLowerCase() === connectedAccount ||
      p.signers.some((s) => s.id.toLowerCase() === connectedAccount)
    )
      return "proposals:authored";

    if (
      isVotableProposalState(p.state) &&
      p.votes != null &&
      !p.votes.some((v) => v.voter.id.toLowerCase() === connectedAccount)
    )
      return "proposals:awaiting-vote";

    return "proposals:ongoing";
  };

  const candidateActiveThreshold = dateStartOfDay(
    dateSubtractDays(new Date(), CANDIDATE_ACTIVE_THRESHOLD_IN_DAYS)
  );

  const groupCandidate = (c) => {
    const connectedAccount = connectedWalletAccountAddress?.toLowerCase();
    const { content } = c.latestVersion;

    if (candidateSortStrategy === "feedback") {
      const isActive =
        c.createdTimestamp > candidateActiveThreshold ||
        c.lastUpdatedTimestamp > candidateActiveThreshold ||
        (c.feedbackPosts != null &&
          c.feedbackPosts.some(
            (p) => p.createdTimestamp > candidateActiveThreshold
          ));

      if (!isActive) return "candidates:inactive";

      const hasFeedback =
        c.feedbackPosts != null &&
        c.feedbackPosts.some(
          (p) => p.voter.id.toLowerCase() === connectedAccount
        );

      if (
        // Include authored candidates here for now
        c.proposerId.toLowerCase() === connectedAccount ||
        hasFeedback
      )
        return "candidates:feedback-given";

      return "candidates:feedback-missing";
    }

    if (c.proposerId.toLowerCase() === connectedAccount)
      return "candidates:authored";

    if (
      content.contentSignatures.some(
        (s) => !s.canceled && s.signer.id.toLowerCase() === connectedAccount
      )
    )
      return "candidates:sponsored";

    if (datesDifferenceInDays(new Date(), c.createdTimestamp) <= 3)
      return "candidates:new";

    if (datesDifferenceInDays(new Date(), c.lastUpdatedTimestamp) <= 5)
      return "candidates:recently-updated";

    return "candidates:inactive";
  };

  const sectionsByName = objectUtils.mapValues(
    // Sort and slice sections
    (items, groupName) => {
      const isSearch = deferredQuery !== "";

      switch (groupName) {
        case "drafts":
          return {
            title: "Drafts",
            items: isSearch
              ? items
              : arrayUtils.sortBy(
                  { value: (i) => Number(i.id), order: "desc" },
                  items
                ),
          };

        case "proposals:past": {
          const sortedItems = isSearch
            ? items
            : arrayUtils.sortBy(
                {
                  value: (i) => Number(i.startBlock),
                  order: "desc",
                },
                items
              );
          return {
            title: "Past",
            count: sortedItems.length,
            items: sortedItems.slice(0, BROWSE_LIST_PAGE_ITEM_COUNT * page),
          };
        }

        // Pending and updatable proposals
        case "proposals:new":
          return {
            title: "New",
            items: isSearch
              ? items
              : arrayUtils.sortBy(
                  {
                    value: (i) => Number(i.createdBlock),
                    order: "desc",
                  },
                  items
                ),
          };

        case "proposals:ongoing":
        case "proposals:awaiting-vote":
        case "proposals:authored": {
          const title = {
            "proposals:ongoing": "Ongoing",
            "proposals:awaiting-vote": "Not yet voted",
            "proposals:authored": "Authored",
          }[groupName];

          return {
            title,
            items: isSearch
              ? items
              : arrayUtils.sortBy(
                  // First the active ones
                  (i) =>
                    ["active", "objection-period"].includes(i.state)
                      ? Number(i.objectionPeriodEndBlock ?? i.endBlock)
                      : Infinity,
                  // Then the succeeded but not yet executed
                  {
                    value: (i) =>
                      Number(i.objectionPeriodEndBlock ?? i.endBlock),
                    order: "desc",
                  },
                  items
                ),
          };
        }

        case "candidates:authored":
        case "candidates:sponsored":
        case "candidates:new":
        case "candidates:recently-updated":
        case "candidates:feedback-given":
        case "candidates:feedback-missing": {
          const sortedItems = isSearch
            ? items
            : arrayUtils.sortBy(
                {
                  value: (i) => i.lastUpdatedTimestamp,
                  order: "desc",
                },
                items
              );

          const title = {
            "candidates:authored": "Authored",
            "candidates:sponsored": "Sponsored",
            "candidates:new": "New",
            "candidates:recently-updated": "Recently updated",
            "candidates:feedback-given": "Feedback given",
            "candidates:feedback-missing": "Missing feedback",
          }[groupName];

          const description = {
            "candidates:new": "Candidates created within the last 3 days",
            "candidates:feedback-missing":
              "Candidates that hasn’t received feedback from you",
          }[groupName];

          return {
            title,
            description,
            count: sortedItems.length,
            items: sortedItems,
          };
        }

        case "candidates:inactive": {
          const sortedItems = isSearch
            ? items
            : arrayUtils.sortBy(
                {
                  value: (i) => i.lastUpdatedTimestamp,
                  order: "desc",
                },
                items
              );
          return {
            title: "Stale",
            description: "No activity within the last 5 days",
            count: sortedItems.length,
            items: sortedItems.slice(0, BROWSE_LIST_PAGE_ITEM_COUNT * page),
          };
        }

        case "hidden":
          return null;

        default:
          throw new Error(`Unknown section "${groupName}"`);
      }
    },
    // Group items
    arrayUtils.groupBy((i) => {
      if (i.type === "draft") return "drafts";
      if (i.slug != null) return groupCandidate(i);
      return groupProposal(i);
    }, filteredItems)
  );

  const { fetchBrowseScreenData } = usePrechainActions();

  useFetch(
    () =>
      Promise.all([
        fetchBrowseScreenData({ first: 40 }),
        fetchBrowseScreenData({ skip: 40, first: 1000 }),
      ]),
    [fetchBrowseScreenData]
  );

  return (
    <Layout scrollContainerRef={scrollContainerRef}>
      <div css={css({ padding: "0 1.6rem" })}>
        <MainContentContainer
          sidebar={
            isDesktopLayout ? (
              <FeedSidebar
                align="right"
                visible={filteredProposals.length > 0}
              />
            ) : null
          }
        >
          <div
            css={css({
              padding: "0 0 3.2rem",
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
                  zIndex: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: "1.6rem",
                  margin: "-0.3rem -1.6rem 0",
                  padding: "0.3rem 1.6rem 0", // Top padding to offset the focus box shadow
                  "@media (min-width: 600px)": {
                    marginBottom: "2.8rem",
                  },
                })
              }
            >
              <Input
                placeholder="Search..."
                value={query}
                onChange={(e) => {
                  setPage(1);

                  // Clear search from path if query is empty
                  if (e.target.value.trim() === "") {
                    setSearchParams((p) => {
                      const newParams = new URLSearchParams(p);
                      newParams.delete("q");
                      return newParams;
                    });
                    return;
                  }

                  setSearchParams((p) => {
                    const newParams = new URLSearchParams(p);
                    newParams.set("q", e.target.value);
                    return newParams;
                  });
                }}
                css={(t) =>
                  css({
                    flex: 1,
                    minWidth: 0,
                    padding: "0.9rem 1.2rem",
                    "@media (max-width: 600px)": {
                      fontSize: t.text.sizes.base,
                    },
                  })
                }
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

            {deferredQuery !== "" ? (
              <>
                <SectionedList
                  sections={[
                    {
                      items: filteredItems.slice(
                        0,
                        BROWSE_LIST_PAGE_ITEM_COUNT * page
                      ),
                    },
                  ]}
                />
                {filteredItems.length > BROWSE_LIST_PAGE_ITEM_COUNT * page && (
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
              </>
            ) : (
              <Tabs.Root
                aria-label="Proposals and candidates"
                defaultSelectedKey="proposals"
                selectedKey={searchParams.get("tab") ?? "proposals"}
                onSelectionChange={(key) => {
                  setSearchParams((p) => {
                    const newParams = new URLSearchParams(p);
                    newParams.set("tab", key);
                    return newParams;
                  });
                  setPage(1);

                  const scrollAdjustmentThreshold = 100; // Scroll back up if the page is scolled beyond this threshold

                  if (
                    scrollContainerRef.current.scrollTop >
                    scrollAdjustmentThreshold
                  )
                    scrollContainerRef.current.scrollTo({
                      top: scrollAdjustmentThreshold,
                    });
                }}
                css={(t) =>
                  css({
                    position: "sticky",
                    top: "4.2rem",
                    zIndex: 1,
                    paddingTop: "1rem",
                    background: t.colors.backgroundPrimary,
                    "[role=tab]": { fontSize: t.text.sizes.base },
                  })
                }
              >
                {!isDesktopLayout && (
                  <Tabs.Item key="activity" title="Activity">
                    <FeedTabContent />
                  </Tabs.Item>
                )}
                <Tabs.Item key="proposals" title="Proposals">
                  <div
                    css={css({
                      paddingTop: "2rem",
                      "@media (min-width: 600px)": {
                        paddingTop: "2.8rem",
                      },
                    })}
                  >
                    <SectionedList
                      showPlaceholder={filteredProposals.length === 0}
                      sections={[
                        "drafts",
                        "proposals:authored",
                        "proposals:awaiting-vote",
                        "proposals:new",
                        "proposals:ongoing",
                        "proposals:past",
                      ]
                        .map((sectionName) => sectionsByName[sectionName] ?? {})
                        .filter(
                          ({ items }) => items != null && items.length !== 0
                        )}
                    />
                    {sectionsByName["proposals:past"] != null &&
                      sectionsByName["proposals:past"].count >
                        BROWSE_LIST_PAGE_ITEM_COUNT * page && (
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
                </Tabs.Item>
                <Tabs.Item key="candidates" title="Candidates">
                  <div
                    css={css({
                      paddingTop: "2rem",
                      "@media (min-width: 600px)": {
                        paddingTop: "2.8rem",
                      },
                    })}
                  >
                    {connectedWalletAccountAddress != null && (
                      <div
                        css={css({
                          margin: "0 0 1.4rem",
                          "@media (min-width: 600px)": {
                            margin: "-0.8rem 0 2.4rem",
                          },
                        })}
                      >
                        <Select
                          size="small"
                          aria-label="Candidate sorting"
                          value={candidateSortStrategy}
                          options={[
                            { value: "activity", label: "Activity" },
                            { value: "feedback", label: "Feedback" },
                          ]}
                          onChange={(value) => {
                            setCandidateSortStrategy(value);
                          }}
                          fullWidth={false}
                          width="max-content"
                          renderTriggerContent={(value) => (
                            <>
                              Sort by:{" "}
                              <em
                                css={(t) =>
                                  css({
                                    fontStyle: "normal",
                                    fontWeight: t.text.weights.emphasis,
                                  })
                                }
                              >
                                {value === "activity" ? "Activity" : "Feedback"}
                              </em>
                            </>
                          )}
                        />
                      </div>
                    )}

                    <SectionedList
                      showPlaceholder={filteredCandidates.length === 0}
                      sections={[
                        "candidates:authored",
                        "candidates:sponsored",
                        "candidates:feedback-missing",
                        "candidates:feedback-given",
                        "candidates:new",
                        "candidates:recently-updated",
                        "candidates:inactive",
                      ]
                        .map((sectionName) => sectionsByName[sectionName] ?? {})
                        .filter(
                          ({ items }) => items != null && items.length !== 0
                        )}
                    />
                    {sectionsByName["candidates:inactive"] != null &&
                      sectionsByName["candidates:inactive"].count >
                        BROWSE_LIST_PAGE_ITEM_COUNT * page && (
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
                </Tabs.Item>
              </Tabs.Root>
            )}
          </div>
        </MainContentContainer>
      </div>
    </Layout>
  );
};

const SectionedList = ({ sections, showPlaceholder = false }) => {
  return (
    <ul
      role={showPlaceholder ? "presentation" : undefined}
      css={(t) => {
        const hoverColor = t.colors.backgroundTertiary;
        return css({
          listStyle: "none",
          containerType: "inline-size",
          "li + li": {
            marginTop: "1.6rem",
            "@media(min-width: 600px)": {
              marginTop: "2.8rem",
            },
          },
          ul: { listStyle: "none" },
          "[data-group] li + li": {
            marginTop: "0.4rem",
            "@media(min-width: 600px)": {
              marginTop: "1rem",
            },
          },
          "[data-group-title]": {
            // position: "sticky",
            // top: "8.4rem",
            padding: "0.8rem 0",
            background: t.colors.backgroundPrimary,
            textTransform: "uppercase",
            fontSize: t.text.sizes.small,
            fontWeight: t.text.weights.emphasis,
            color: t.colors.textMuted,
            "@media(min-width: 600px)": {
              padding: "1.1rem 0",
            },
          },
          "[data-group-description]": {
            textTransform: "none",
            fontSize: t.text.sizes.small,
            fontWeight: t.text.weights.normal,
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
            "@media(max-width: 600px)": {
              fontSize: t.text.sizes.base,
            },
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
            "a[data-avatar-layout]": {
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
      {showPlaceholder ? (
        <li data-group key="placeholder">
          <div data-group-title data-placeholder />
          <ul>
            {Array.from({ length: 15 }).map((_, i) => (
              <li key={i} data-placeholder />
            ))}
          </ul>
        </li>
      ) : (
        sections.map(({ title, description, items }, i) => {
          return (
            <li data-group key={title ?? i}>
              {title != null && (
                <div data-group-title>
                  {title}
                  {description != null && (
                    <span data-group-description> — {description}</span>
                  )}
                </div>
              )}
              <ul>
                {items.map((i) => (
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
  );
};

const FEED_PAGE_ITEM_COUNT = 30;

const ActivityFeed = React.memo(({ filter = "all" }) => {
  const { data: latestBlockNumber } = useBlockNumber({
    watch: true,
    cache: 20_000,
  });

  const { fetchNounsActivity } = usePrechainActions();

  const [page, setPage] = React.useState(2);

  const feedItems = useFeedItems({ filter });
  const visibleItems = feedItems.slice(0, FEED_PAGE_ITEM_COUNT * page);

  // Fetch feed items
  useFetch(
    latestBlockNumber == null
      ? null
      : () =>
          fetchNounsActivity({
            startBlock:
              latestBlockNumber - BigInt(APPROXIMATE_BLOCKS_PER_DAY * 3),
            endBlock: latestBlockNumber,
          }).then(() =>
            fetchNounsActivity({
              startBlock:
                latestBlockNumber - BigInt(APPROXIMATE_BLOCKS_PER_DAY * 30),
              endBlock:
                latestBlockNumber - BigInt(APPROXIMATE_BLOCKS_PER_DAY * 3) - 1n,
            })
          ),
    [latestBlockNumber, fetchNounsActivity]
  );

  if (visibleItems.length === 0) return null;

  return (
    <>
      <ActivityList items={visibleItems} />

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
    </>
  );
});

const FeedSidebar = React.memo(({ visible = true }) => {
  const [filter, setFilter] = useCachedState(
    "browse-screen:activity-filter",
    "all"
  );

  if (!visible) return null;

  return (
    <div
      css={css({
        padding: "1rem 0 3.2rem",
        "@media (min-width: 600px)": {
          padding: "6rem 0 8rem",
        },
      })}
    >
      <div
        css={css({
          height: "4.05rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          margin: "0 0 2rem",
        })}
      >
        <Select
          size="small"
          aria-label="Feed filter"
          value={filter}
          options={[
            { value: "all", label: "Everything" },
            { value: "proposals", label: "Proposal activity only" },
            { value: "candidates", label: "Candidate activity only" },
          ]}
          onChange={(value) => {
            setFilter(value);
          }}
          fullWidth={false}
          align="right"
          width="max-content"
          renderTriggerContent={(value) => {
            const filterLabel = {
              all: "Everything",
              proposals: "Proposal activity",
              candidates: "Candidate activity",
            }[value];
            return (
              <>
                Show:{" "}
                <em
                  css={(t) =>
                    css({
                      fontStyle: "normal",
                      fontWeight: t.text.weights.emphasis,
                    })
                  }
                >
                  {filterLabel}
                </em>
              </>
            );
          }}
        />
      </div>

      <ActivityFeed filter={filter} />
    </div>
  );
});

const FeedTabContent = React.memo(() => {
  const [filter, setFilter] = useCachedState(
    "browse-screen:activity-filter",
    "all"
  );

  return (
    <div css={css({ padding: "2rem 0" })}>
      <div css={css({ margin: "0 0 2rem" })}>
        <Select
          size="small"
          aria-label="Feed filter"
          value={filter}
          options={[
            { value: "all", label: "Everything" },
            { value: "proposals", label: "Proposal activity only" },
            { value: "candidates", label: "Candidate activity only" },
          ]}
          onChange={(value) => {
            setFilter(value);
          }}
          fullWidth={false}
          width="max-content"
          renderTriggerContent={(value) => {
            const filterLabel = {
              all: "Everything",
              proposals: "Proposal activity",
              candidates: "Candidate activity",
            }[value];
            return (
              <>
                Show:{" "}
                <em
                  css={(t) =>
                    css({
                      fontStyle: "normal",
                      fontWeight: t.text.weights.emphasis,
                    })
                  }
                >
                  {filterLabel}
                </em>
              </>
            );
          }}
        />
      </div>

      <ActivityFeed filter={filter} />
    </div>
  );
});

const ProposalItem = React.memo(({ proposalId }) => {
  // const theme = useTheme();
  const proposal = useProposal(proposalId);
  const { displayName: authorAccountDisplayName } = useAccountDisplayName(
    proposal.proposer?.id
  );

  const isDimmed =
    proposal.state != null && ["canceled", "expired"].includes(proposal.state);

  const tagWithStatusText = <PropTagWithStatusText proposalId={proposalId} />;

  return (
    <RouterLink
      to={`/proposals/${proposalId}`}
      data-dimmed={isDimmed}
      // data-avatar-layout
    >
      {/* <Avatar */}
      {/*   signature={proposalId} */}
      {/*   signatureLength={3} */}
      {/*   size="3.2rem" */}
      {/*   background={isDimmed ? theme.colors.backgroundModifierHover : undefined} */}
      {/*   data-desktop-only */}
      {/* /> */}
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

const PropStatusText = React.memo(({ proposalId }) => {
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
              Ends{" "}
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
          Ends{" "}
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
});

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
        {votingPower} / {proposalThreshold + 1}{" "}
        {votingPower === 1 ? "sponsor" : "sponsors"}
        {/* <NogglesIcon */}
        {/*   style={{ */}
        {/*     display: "inline-flex", */}
        {/*     width: "1.7rem", */}
        {/*     height: "auto", */}
        {/*     position: "relative", */}
        {/*     top: "-0.1rem", */}
        {/*     marginLeft: "0.5rem", */}
        {/*   }} */}
        {/* /> */}
      </>
    );

  return (
    <RouterLink to={`/candidates/${encodeURIComponent(candidateId)}`}>
      {/* <Avatar */}
      {/*   signature={candidate.slug.split("-")[0]} */}
      {/*   signatureLength={2} */}
      {/*   size="3.2rem" */}
      {/*   data-desktop-only */}
      {/* /> */}
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
          <div data-small css={css({ marginTop: "0.2rem" })}>
            {candidate.lastUpdatedTimestamp != null &&
            candidate.lastUpdatedTimestamp.getTime() !==
              candidate.createdTimestamp.getTime() ? (
              <>
                Last updated{" "}
                <FormattedDateWithTooltip
                  relativeDayThreshold={5}
                  capitalize={false}
                  value={candidate.lastUpdatedTimestamp}
                  day="numeric"
                  month="short"
                />
              </>
            ) : (
              <>
                Created{" "}
                <FormattedDateWithTooltip
                  relativeDayThreshold={5}
                  capitalize={false}
                  value={candidate.createdTimestamp}
                  day="numeric"
                  month="short"
                />
              </>
            )}
          </div>
        </div>
        <div
          data-small
          css={css({
            display: "flex",
            gap: "1.6rem",
            alignItems: "center",
          })}
        >
          <div>{statusText}</div>

          {isCanceled ? (
            <Tag variant="error" size="large">
              Canceled
            </Tag>
          ) : candidate.latestVersion.targetProposalId != null ? (
            <Tag variant="special" size="large">
              Proposal update
            </Tag>
          ) : null}
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
      {/* <Avatar */}
      {/*   signature={draft.name || "Untitled draft"} */}
      {/*   signatureLength={2} */}
      {/*   size="3.2rem" */}
      {/*   data-desktop-only */}
      {/* /> */}
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
        fontSize: t.text.sizes.micro,
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
        "@media(min-width: 600px)": {
          fontSize: t.text.sizes.tiny,
        },
      })
    }
    {...props}
  />
);

export default BrowseScreen;
