"use client";

import dateSubtractDays from "date-fns/subDays";
import dateStartOfDay from "date-fns/startOfDay";
import React from "react";
import NextLink from "next/link";
import { css } from "@emotion/react";
import { useBlockNumber } from "wagmi";
import { useDebouncedCallback } from "use-debounce";
import { useFetch } from "@shades/common/react";
import { useCachedState } from "@shades/common/app";
import { useAccountDisplayName } from "@shades/common/ethereum-react";
import {
  array as arrayUtils,
  object as objectUtils,
  date as dateUtils,
  searchRecords,
} from "@shades/common/utils";
import Input from "@shades/ui-web/input";
import Button from "@shades/ui-web/button";
import Link from "@shades/ui-web/link";
import Select from "@shades/ui-web/select";
import { isNodeEmpty as isRichTextNodeEmpty } from "@shades/ui-web/rich-text-editor";
import {
  ArrowDownSmall as ArrowDownSmallIcon,
  Plus as PlusIcon,
} from "@shades/ui-web/icons";
import { APPROXIMATE_BLOCKS_PER_DAY } from "../constants/ethereum.js";
import {
  isFinalState as isFinalProposalState,
  isSucceededState as isSucceededProposalState,
  isVotableState as isVotableProposalState,
  buildFeed as buildProposalFeed,
} from "../utils/proposals.js";
import {
  buildFeed as buildCandidateFeed,
  getSignals as getCandidateSignals,
  makeUrlId as makeCandidateUrlId,
  getSponsorSignatures as getCandidateSponsorSignatures,
} from "../utils/candidates.js";
import { buildFeed as buildPropdateFeed } from "../utils/propdates.js";
import { useSearchParams } from "../hooks/navigation.js";
import { useProposalThreshold } from "../hooks/dao-contract.js";
import { useWallet } from "../hooks/wallet.js";
import useMatchDesktopLayout from "../hooks/match-desktop-layout.js";
import {
  useActions,
  useProposal,
  useProposals,
  useProposalCandidates,
  useProposalUpdateCandidates,
  useProposalCandidate,
  useProposalCandidateVotingPower,
  usePropdates,
  useEnsCache,
} from "../store.js";
import useApproximateBlockTimestampCalculator from "../hooks/approximate-block-timestamp-calculator.js";
import {
  useCollection as useDrafts,
  useSingleItem as useDraft,
} from "../hooks/drafts.js";
import * as Tabs from "./tabs.js";
import Layout, { MainContentContainer } from "./layout.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import AccountAvatar from "./account-avatar.js";
import Tag from "./tag.js";
import ProposalStateTag from "./proposal-state-tag.js";
import ActivityFeed_ from "./activity-feed.js";

const CANDIDATE_NEW_THRESHOLD_IN_DAYS = 3;
const CANDIDATE_ACTIVE_THRESHOLD_IN_DAYS = 5;

const getCandidateScore = (candidate) => {
  const signals = getCandidateSignals({ candidate });
  if (signals.delegates.for === 0 && signals.delegates.abstain === 0)
    return null;
  return signals.delegates.for - signals.delegates.against;
};

const searchEns = (nameByAddress, rawQuery) => {
  const query = rawQuery.trim().toLowerCase();
  const ensEntries = Object.entries(nameByAddress);

  const matchingRecords = ensEntries.reduce((matches, [address, name]) => {
    const index = name.toLowerCase().indexOf(query);
    if (index === -1) return matches;
    return [...matches, { address, index }];
  }, []);

  return arrayUtils
    .sortBy({ value: (r) => r.index, type: "index" }, matchingRecords)
    .map((r) => r.address);
};

const useFeedItems = ({ filter }) => {
  const { data: eagerLatestBlockNumber } = useBlockNumber({
    watch: true,
    cacheTime: 10_000,
  });
  const latestBlockNumber = React.useDeferredValue(eagerLatestBlockNumber);

  const proposals = useProposals({ state: true, propdates: true });
  const candidates = useProposalCandidates({
    includeCanceled: true,
    includePromoted: true,
    includeProposalUpdates: true,
  });
  const propdates = usePropdates();

  return React.useMemo(() => {
    const buildProposalItems = () =>
      proposals.flatMap((p) =>
        buildProposalFeed(p, { latestBlockNumber, includePropdates: false })
      );
    const buildCandidateItems = () =>
      candidates.flatMap((c) => buildCandidateFeed(c));
    const buildPropdateItems = () => buildPropdateFeed(propdates);

    const buildFeedItems = () => {
      switch (filter) {
        case "proposals":
          return [...buildProposalItems(), ...buildPropdateItems()];
        case "candidates":
          return buildCandidateItems();
        case "propdates":
          return buildPropdateItems();
        default:
          return [
            ...buildProposalItems(),
            ...buildCandidateItems(),
            ...buildPropdateItems(),
          ];
      }
    };

    return arrayUtils.sortBy(
      { value: (i) => i.blockNumber, order: "desc" },
      buildFeedItems()
    );
  }, [proposals, candidates, propdates, filter, latestBlockNumber]);
};

const BROWSE_LIST_PAGE_ITEM_COUNT = 20;

const groupConfigByKey = {
  drafts: {},
  "proposals:new": { title: "New" },
  "proposals:ongoing": { title: "Ongoing" },
  "proposals:awaiting-vote": { title: "Not yet voted" },
  "proposals:authored": { title: "Authored" },
  "proposals:past": { title: "Past" },
  "candidates:authored": { title: "Authored" },
  "candidates:sponsored": { title: "Sponsored" },
  "candidates:new": {
    title: "New",
    description: "Candidates created within the last 3 days",
  },
  "candidates:recently-active": { title: "Recently active" },
  "candidates:feedback-given": { title: "Feedback given" },
  "candidates:feedback-missing": {
    title: "Missing feedback",
    description: "Candidates that hasn’t received feedback from you",
  },
  "candidates:popular": {
    title: "Trending",
    description: `The most popular candidates active within the last ${CANDIDATE_ACTIVE_THRESHOLD_IN_DAYS} days`,
  },
  "proposals:sponsored-proposal-update-awaiting-signature": {
    title: "Missing your signature",
  },
  "candidates:inactive": {
    title: "Stale",
    description: `No activity within the last ${CANDIDATE_ACTIVE_THRESHOLD_IN_DAYS} days`,
  },
};

let hasFetchedBrowseDataOnce = false;

const BrowseScreen = () => {
  const scrollContainerRef = React.useRef();
  const [searchParams, setSearchParams] = useSearchParams();

  const isDesktopLayout = useMatchDesktopLayout();
  const tabAnchorRef = React.useRef();
  const tabContainerRef = React.useRef();

  const query = searchParams.get("q") ?? "";
  const deferredQuery = React.useDeferredValue(query.trim());

  const { address: connectedWalletAccountAddress } = useWallet();

  const { nameByAddress: primaryEnsNameByAddress } = useEnsCache();

  const proposals = useProposals({ state: true });
  const candidates = useProposalCandidates({
    includeCanceled: false,
    includePromoted: false,
    includeProposalUpdates: false,
  });
  const proposalUpdateCandidates = useProposalUpdateCandidates({
    includeTargetProposal: true,
  });

  const { items: proposalDrafts } = useDrafts();

  const [page, setPage] = React.useState(1);
  const [candidateSortStrategy_, setCandidateSortStrategy] = useCachedState(
    "candidate-sorting-strategy",
    "activity"
  );

  const [hasFetchedOnce, setHasFetchedOnce] = React.useState(
    hasFetchedBrowseDataOnce
  );

  const candidateSortStrategies =
    connectedWalletAccountAddress == null
      ? ["activity", "popularity"]
      : ["activity", "popularity", "connected-account-feedback"];

  const candidateSortStrategy = candidateSortStrategies.includes(
    candidateSortStrategy_
  )
    ? candidateSortStrategy_
    : "popularity";

  const filteredProposals = React.useMemo(
    () => proposals.filter((p) => p.startBlock != null),
    [proposals]
  );
  const filteredCandidates = React.useMemo(
    () => candidates.filter((c) => c.latestVersion != null),
    [candidates]
  );
  const filteredProposalUpdateCandidates = React.useMemo(() => {
    const hasSigned = (c) => {
      const signatures = getCandidateSponsorSignatures(c, {
        excludeInvalid: true,
        activeProposerIds: [],
      });
      return signatures.some(
        (s) => s.signer.id.toLowerCase() === connectedWalletAccountAddress
      );
    };

    // Include authored updates, as well as sponsored updates not yet signed
    return proposalUpdateCandidates.filter((c) => {
      if (c.latestVersion == null) return false;

      if (c.proposerId.toLowerCase() === connectedWalletAccountAddress)
        return true;

      const isSponsor = c.targetProposal.signers.some(
        (s) => s.id.toLowerCase() === connectedWalletAccountAddress
      );

      return isSponsor && !hasSigned(c);
    });
  }, [proposalUpdateCandidates, connectedWalletAccountAddress]);

  const filteredItems = React.useMemo(() => {
    const filteredProposalDrafts =
      proposalDrafts == null
        ? []
        : proposalDrafts
            .filter((d) => {
              if (d.name.trim() !== "") return true;
              return d.body.some(
                (n) => !isRichTextNodeEmpty(n, { trim: true })
              );
            })
            .map((d) => ({ ...d, type: "draft" }));

    if (deferredQuery === "")
      return [
        ...filteredProposalDrafts,
        ...filteredCandidates,
        ...filteredProposals,
        ...filteredProposalUpdateCandidates,
      ];

    const matchingAddresses = searchEns(primaryEnsNameByAddress, deferredQuery);

    const matchingRecords = searchRecords(
      [
        ...filteredProposalDrafts.map((d) => ({
          type: "draft",
          data: d,
          tokens: [
            { value: d.id, exact: true },
            { value: d.proposerId, exact: true },
            { value: d.name },
          ],
          fallbackSortProperty: Infinity,
        })),
        ...filteredProposals.map((p) => ({
          type: "proposal",
          data: p,
          tokens: [
            { value: p.id, exact: true },
            { value: p.proposerId, exact: true },
            { value: p.title },
            ...(p.signers ?? []).map((s) => ({ value: s.id, exact: true })),
          ],
          fallbackSortProperty: p.createdBlock,
        })),
        ...[...filteredCandidates, ...filteredProposalUpdateCandidates].map(
          (c) => ({
            type: "candidate",
            data: c,
            tokens: [
              { value: c.id, exact: true },
              { value: c.proposerId, exact: true },
              { value: c.latestVersion?.content.title },
              ...(c.latestVersion?.content.contentSignatures ?? []).map(
                (s) => ({ value: s.signer.id, exact: true })
              ),
            ],
            fallbackSortProperty: c.createdBlock,
          })
        ),
      ],
      [deferredQuery, ...matchingAddresses]
    );

    return matchingRecords.map((r) => r.data);
  }, [
    deferredQuery,
    filteredProposals,
    filteredCandidates,
    filteredProposalUpdateCandidates,
    proposalDrafts,
    primaryEnsNameByAddress,
  ]);

  const groupProposal = (p) => {
    const connectedAccount = connectedWalletAccountAddress?.toLowerCase();

    if (["pending", "updatable"].includes(p.state)) return "proposals:new";
    if (isFinalProposalState(p.state) || isSucceededProposalState(p.state))
      return "proposals:past";

    if (connectedAccount == null) return "proposals:ongoing";

    if (
      p.proposerId.toLowerCase() === connectedAccount /*||
      p.signers.some((s) => s.id.toLowerCase() === connectedAccount)*/
    )
      return "proposals:authored";

    if (
      isVotableProposalState(p.state) &&
      p.votes != null &&
      !p.votes.some((v) => v.voterId.toLowerCase() === connectedAccount)
    )
      return "proposals:awaiting-vote";

    return "proposals:ongoing";
  };

  const candidateActiveThreshold = dateStartOfDay(
    dateSubtractDays(new Date(), CANDIDATE_ACTIVE_THRESHOLD_IN_DAYS)
  );
  const candidateNewThreshold = dateStartOfDay(
    dateSubtractDays(new Date(), CANDIDATE_NEW_THRESHOLD_IN_DAYS)
  );

  const groupCandidate = (c) => {
    const { content } = c.latestVersion;
    const connectedAccount = connectedWalletAccountAddress;

    if (c.latestVersion.targetProposalId != null)
      return c.proposerId.toLowerCase() == connectedAccount
        ? "proposals:authored"
        : "proposals:sponsored-proposal-update-awaiting-signature";

    const isActive =
      c.createdTimestamp > candidateActiveThreshold ||
      c.lastUpdatedTimestamp > candidateActiveThreshold ||
      (c.feedbackPosts != null &&
        c.feedbackPosts.some(
          (p) => p.createdTimestamp > candidateActiveThreshold
        ));

    if (!isActive) return "candidates:inactive";

    if (candidateSortStrategy === "popularity") return "candidates:popular";

    if (candidateSortStrategy === "connected-account-feedback") {
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

    if (c.createdTimestamp >= candidateNewThreshold) return "candidates:new";

    return "candidates:recently-active";
  };

  const sectionsByName = objectUtils.mapValues(
    // Sort and slice sections
    (items, groupKey) => {
      const isSearch = deferredQuery !== "";
      const { title, description } = groupConfigByKey[groupKey];

      switch (groupKey) {
        case "drafts":
          return {
            title,
            items: isSearch
              ? items
              : arrayUtils.sortBy(
                  { value: (i) => Number(i.id), order: "desc" },
                  items
                ),
          };

        case "proposals:awaiting-vote":
          return {
            title,
            items: isSearch
              ? items
              : arrayUtils.sortBy(
                  (i) => Number(i.objectionPeriodEndBlock ?? i.endBlock),
                  items
                ),
          };

        case "proposals:authored":
        case "proposals:ongoing":
        case "proposals:new":
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
          const paginate = page != null && groupKey === "proposals:past";
          return {
            title,
            count: sortedItems.length,
            items: paginate
              ? sortedItems.slice(0, BROWSE_LIST_PAGE_ITEM_COUNT * page)
              : sortedItems,
          };
        }

        case "candidates:authored":
        case "candidates:sponsored":
        case "candidates:new":
        case "candidates:recently-active":
        case "candidates:feedback-given":
        case "candidates:feedback-missing":
        case "candidates:popular":
        case "candidates:authored-proposal-update":
        case "candidates:inactive":
        case "proposals:sponsored-proposal-update-awaiting-signature": {
          const sortedItems = isSearch
            ? items
            : arrayUtils.sortBy(
                candidateSortStrategy === "popularity"
                  ? {
                      value: (i) => getCandidateScore(i) ?? 0,
                      order: "desc",
                    }
                  : {
                      value: (i) =>
                        Math.max(
                          i.lastUpdatedTimestamp,
                          ...(i.feedbackPosts?.map((p) => p.createdTimestamp) ??
                            [])
                        ),
                      order: "desc",
                    },
                items
              );

          const paginate = page != null && groupKey === "candidates:inactive";

          return {
            title,
            description,
            count: sortedItems.length,
            items: paginate
              ? sortedItems.slice(0, BROWSE_LIST_PAGE_ITEM_COUNT * page)
              : sortedItems,
          };
        }

        case "hidden":
          return null;

        default:
          throw new Error(`Unknown group "${groupKey}"`);
      }
    },
    // Group items
    arrayUtils.groupBy((i) => {
      if (i.type === "draft") return "drafts";
      if (i.slug != null) return groupCandidate(i);
      return groupProposal(i);
    }, filteredItems)
  );

  const { fetchBrowseScreenData } = useActions();

  useFetch(
    () =>
      fetchBrowseScreenData({ first: 40 }).then(() => {
        setHasFetchedOnce(true);
        if (hasFetchedOnce) return;
        hasFetchedBrowseDataOnce = true;
        fetchBrowseScreenData({ skip: 40, first: 1000 });
      }),
    [fetchBrowseScreenData]
  );

  const handleSearchInputChange = useDebouncedCallback((query) => {
    setPage(1);

    // Clear search from path if query is empty
    if (query.trim() === "") {
      setSearchParams(
        (p) => {
          const newParams = new URLSearchParams(p);
          newParams.delete("q");
          return newParams;
        },
        { replace: true }
      );
      return;
    }

    setSearchParams(
      (p) => {
        const newParams = new URLSearchParams(p);
        newParams.set("q", query);
        return newParams;
      },
      { replace: true }
    );
  });

  return (
    <>
      <Layout
        scrollContainerRef={scrollContainerRef}
        actions={[
          {
            label: "New Proposal",
            buttonProps: {
              component: NextLink,
              href: "/new",
              icon: <PlusIcon style={{ width: "0.9rem" }} />,
            },
          },
        ]}
      >
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
                containerType: "inline-size",
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
                  defaultValue={query}
                  size="large"
                  onChange={(e) => {
                    handleSearchInputChange(e.target.value);
                  }}
                  css={css({ flex: 1, minWidth: 0 })}
                />
              </div>

              {deferredQuery !== "" ? (
                // Search results
                <>
                  <SectionedList
                    sections={[
                      {
                        items:
                          page == null
                            ? filteredItems
                            : filteredItems.slice(
                                0,
                                BROWSE_LIST_PAGE_ITEM_COUNT * page
                              ),
                      },
                    ]}
                    style={{ marginTop: "2rem" }}
                  />
                  {page != null &&
                    filteredItems.length >
                      BROWSE_LIST_PAGE_ITEM_COUNT * page && (
                      <Pagination
                        showNext={() => setPage((p) => p + 1)}
                        showAll={() => setPage(null)}
                      />
                    )}
                </>
              ) : (
                <>
                  <div ref={tabAnchorRef} />
                  <Tabs.Root
                    ref={tabContainerRef}
                    aria-label="Proposals and candidates"
                    selectedKey={
                      searchParams.get("tab") ??
                      (isDesktopLayout ? "proposals" : "activity")
                    }
                    onSelectionChange={(key) => {
                      const tabAnchorRect =
                        tabAnchorRef.current?.getBoundingClientRect();
                      const tabContainerRect =
                        tabContainerRef.current?.getBoundingClientRect();

                      if (tabContainerRect?.top > tabAnchorRect?.top)
                        scrollContainerRef.current.scrollTo({
                          top: tabAnchorRef.current.offsetTop - 42,
                        });

                      setSearchParams((p) => {
                        const newParams = new URLSearchParams(p);
                        newParams.set("tab", key);
                        return newParams;
                      });
                      setPage(1);
                    }}
                    css={(t) =>
                      css({
                        position: "sticky",
                        top: "4.2rem",
                        zIndex: 1,
                        paddingTop: "1.6rem",
                        background: t.colors.backgroundPrimary,
                        "[role=tab]": { fontSize: t.text.sizes.base },
                      })
                    }
                  >
                    {!isDesktopLayout && (
                      <Tabs.Item key="activity" title="Activity">
                        <FeedTabContent
                          visible={filteredProposals.length > 0}
                        />
                      </Tabs.Item>
                    )}
                    <Tabs.Item key="proposals" title="Proposals">
                      <div
                        css={css({
                          paddingTop: "2.4rem",
                          "@media (min-width: 600px)": {
                            paddingTop: "2.8rem",
                          },
                        })}
                      >
                        <SectionedList
                          showPlaceholder={!hasFetchedOnce}
                          sections={[
                            // "drafts",
                            "proposals:authored",
                            "proposals:sponsored-proposal-update-awaiting-signature",
                            "proposals:awaiting-vote",
                            "proposals:ongoing",
                            "proposals:new",
                            "proposals:past",
                          ]
                            .map(
                              (sectionName) => sectionsByName[sectionName] ?? {}
                            )
                            .filter(
                              ({ items }) => items != null && items.length !== 0
                            )}
                        />
                        {page != null &&
                          sectionsByName["proposals:past"] != null &&
                          sectionsByName["proposals:past"].count >
                            BROWSE_LIST_PAGE_ITEM_COUNT * page && (
                            <Pagination
                              showNext={() => setPage((p) => p + 1)}
                              showAll={() => setPage(null)}
                            />
                          )}
                      </div>
                    </Tabs.Item>
                    <Tabs.Item key="candidates" title="Candidates">
                      <div
                        css={css({
                          paddingTop: "2.4rem",
                          "@media (min-width: 600px)": {
                            paddingTop: "2.8rem",
                          },
                        })}
                      >
                        <div
                          css={css({
                            margin: "-0.4rem 0 2.4rem",
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
                              { value: "popularity", label: "Popularity" },
                              { value: "activity", label: "Recent activity" },
                              {
                                value: "connected-account-feedback",
                                label: "Your feedback",
                              },
                            ].filter(
                              (o) =>
                                // A connected wallet is required for feedback filter to work
                                connectedWalletAccountAddress != null ||
                                o.value !== "connected-account-feedback"
                            )}
                            onChange={(value) => {
                              setCandidateSortStrategy(value);
                            }}
                            fullWidth={false}
                            width="max-content"
                            renderTriggerContent={(value, options) => (
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
                                  {
                                    options.find((o) => o.value === value)
                                      ?.label
                                  }
                                </em>
                              </>
                            )}
                          />
                        </div>

                        <SectionedList
                          showPlaceholder={!hasFetchedOnce}
                          sections={[
                            "candidates:authored",
                            "candidates:sponsored",
                            "candidates:feedback-missing",
                            "candidates:feedback-given",
                            "candidates:new",
                            "candidates:recently-active",
                            "candidates:popular",
                            "candidates:inactive",
                          ]
                            .map(
                              (sectionName) => sectionsByName[sectionName] ?? {}
                            )
                            .filter(
                              ({ items }) => items != null && items.length !== 0
                            )}
                        />
                        {page != null &&
                          sectionsByName["candidates:inactive"] != null &&
                          sectionsByName["candidates:inactive"].count >
                            BROWSE_LIST_PAGE_ITEM_COUNT * page && (
                            <Pagination
                              showNext={() => setPage((p) => p + 1)}
                              showAll={() => setPage(null)}
                            />
                          )}
                      </div>
                    </Tabs.Item>
                    <Tabs.Item key="drafts" title="My drafts">
                      <div
                        css={css({
                          paddingTop: "2.4rem",
                          "@media (min-width: 600px)": {
                            paddingTop: "2.8rem",
                          },
                        })}
                      >
                        <DraftTabContent
                          items={sectionsByName["drafts"]?.items}
                        />
                      </div>
                    </Tabs.Item>
                  </Tabs.Root>
                </>
              )}
            </div>
          </MainContentContainer>
        </div>
      </Layout>
    </>
  );
};

export const SectionedList = ({
  sections,
  showPlaceholder = false,
  ...props
}) => {
  return (
    <ul
      role={showPlaceholder ? "presentation" : undefined}
      css={(t) => {
        const hoverColor = t.colors.backgroundModifierNormal;
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
            color: t.colors.textDimmed,
            "@media(min-width: 600px)": {
              padding: "1.1rem 0",
            },
          },
          "[data-group-description]": {
            textTransform: "none",
            fontSize: t.text.sizes.small,
            fontWeight: t.text.weights.normal,
            color: t.colors.textDimmed,
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
            lineHeight: 1.25,
            padding: "0.1rem 0",
          },
          "[data-nowrap]": {
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
          "@container(max-width: 580px)": {
            "[data-desktop-only]": {
              display: "none",
            },
          },
          // Desktop-only
          "@container(min-width: 580px)": {
            "[data-mobile-only]": {
              display: "none",
            },
            "[data-group] li + li": { marginTop: "0.4rem" },
          },
          // Hover enhancement
          "@media(hover: hover)": {
            "a:hover": {
              background: `linear-gradient(90deg, transparent 0%, ${hoverColor} 20%, ${hoverColor} 80%, transparent 100%)`,
            },
          },
        });
      }}
      {...props}
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

let hasFetchedActivityFeedOnce = false;

const ActivityFeed = React.memo(({ filter = "all" }) => {
  const { data: latestBlockNumber } = useBlockNumber({
    watch: true,
    cache: 20_000,
  });

  const { fetchNounsActivity } = useActions();

  const [page, setPage] = React.useState(2);
  const [hasFetchedOnce, setHasFetchedOnce] = React.useState(
    hasFetchedActivityFeedOnce
  );

  const feedItems = useFeedItems({ filter });
  const visibleItems = feedItems.slice(0, FEED_PAGE_ITEM_COUNT * page);

  // Fetch feed items
  useFetch(
    latestBlockNumber == null
      ? null
      : () => {
          fetchNounsActivity({
            startBlock:
              latestBlockNumber - BigInt(APPROXIMATE_BLOCKS_PER_DAY * 2),
            endBlock: latestBlockNumber,
          }).then(() => {
            if (hasFetchedOnce) return;

            setHasFetchedOnce(true);
            hasFetchedActivityFeedOnce = true;

            fetchNounsActivity({
              startBlock:
                latestBlockNumber - BigInt(APPROXIMATE_BLOCKS_PER_DAY * 30),
              endBlock:
                latestBlockNumber - BigInt(APPROXIMATE_BLOCKS_PER_DAY * 2) - 1n,
            });
          });
        },
    [latestBlockNumber, fetchNounsActivity]
  );

  if (visibleItems.length === 0 || !hasFetchedOnce) return null;

  return (
    <>
      <ActivityFeed_ items={visibleItems} />

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
            { value: "propdates", label: "Propdates only" },
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
              propdates: "Propdates",
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

const FeedTabContent = React.memo(({ visible }) => {
  const [filter, setFilter] = useCachedState(
    "browse-screen:activity-filter",
    "all"
  );

  if (!visible) return null;

  return (
    <div css={css({ padding: "2rem 0" })}>
      <div css={css({ margin: "0 0 2.8rem" })}>
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
  const proposal = useProposal(proposalId, { watch: false });
  const authorAccountDisplayName = useAccountDisplayName(proposal?.proposerId);
  const calculateBlockTimestamp = useApproximateBlockTimestampCalculator();

  const statusText = renderPropStatusText({
    proposal,
    calculateBlockTimestamp,
  });

  const showVoteStatus = !["pending", "updatable"].includes(proposal.state);

  const isDimmed =
    proposal.state != null && ["canceled", "expired"].includes(proposal.state);

  return (
    <NextLink prefetch href={`/proposals/${proposalId}`} data-dimmed={isDimmed}>
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
          <div data-title>
            {proposal.title === null ? "Untitled" : proposal.title}
          </div>
          <div
            data-small
            data-mobile-only
            css={css({
              marginTop: "0.3rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: "0.5rem",
            })}
          >
            <ProposalStateTag proposalId={proposalId} />
            {showVoteStatus && <ProposalVotesTag proposalId={proposalId} />}
            {statusText != null && (
              <div data-small style={{ padding: "0 0.1rem" }}>
                {statusText}
              </div>
            )}
          </div>
          {showVoteStatus && statusText != null && (
            <div
              data-small
              data-desktop-only
              css={css({ marginTop: "0.2rem" })}
            >
              {statusText}
            </div>
          )}
        </div>
        <div
          data-desktop-only
          css={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "1.2rem",
            textAlign: "right",
          })}
        >
          {showVoteStatus ? (
            <ProposalVotesTag proposalId={proposalId} />
          ) : (
            <span data-small data-nowrap>
              {statusText}
            </span>
          )}
          <ProposalStateTag
            proposalId={proposalId}
            style={{ minWidth: "7.6rem" }}
          />
        </div>
      </div>
    </NextLink>
  );
});

const renderPropStatusText = ({ proposal, calculateBlockTimestamp }) => {
  switch (proposal.state) {
    case "updatable": {
      const updatePeriodEndDate = calculateBlockTimestamp(
        proposal.updatePeriodEndBlock
      );
      const { minutes, hours, days } = dateUtils.differenceUnits(
        updatePeriodEndDate,
        new Date()
      );

      if (minutes < 1) return <>Closes for changes in less than 1 minute</>;

      if (hours <= 1)
        return (
          <>
            Editable for another {Math.max(minutes, 0)}{" "}
            {minutes === 1 ? "minute" : "minutes"}
          </>
        );

      if (days <= 2) return <>Editable for another {hours} hours</>;

      return <>Editable for another {days} days</>;
    }

    case "pending": {
      const startDate = calculateBlockTimestamp(proposal.startBlock);
      const { minutes, hours, days } = dateUtils.differenceUnits(
        startDate,
        new Date()
      );

      if (minutes < 1) return <>Starts in less than 1 minute</>;

      if (hours === 0)
        return (
          <>
            Starts in {Math.max(minutes, 0)}{" "}
            {minutes === 1 ? "minute" : "minutes"}
          </>
        );

      if (days <= 1) return <>Starts in {Math.round(minutes / 60)} hours</>;

      return <>Starts in {Math.round(hours / 24)} days</>;
    }

    case "active":
    case "objection-period": {
      const endDate = calculateBlockTimestamp(
        proposal.objectionPeriodEndBlock ?? proposal.endBlock
      );
      const { minutes, hours, days } = dateUtils.differenceUnits(
        endDate,
        new Date()
      );

      if (minutes < 1) return <>Ends in less than 1 minute</>;

      if (hours <= 1)
        return (
          <>
            Ends in {Math.max(minutes, 0)}{" "}
            {minutes === 1 ? "minute" : "minutes"}
          </>
        );

      if (days <= 1) return <>Ends in {Math.round(minutes / 60)} hours</>;

      return <>Ends in {Math.round(hours / 24)} days</>;
    }

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

const ProposalVotesTag = React.memo(({ proposalId }) => {
  const { address: connectedWalletAccountAddress } = useWallet();
  const proposal = useProposal(proposalId, { watch: false });

  const vote = proposal.votes?.find(
    (v) => v.voterId === connectedWalletAccountAddress
  );

  return (
    <span
      css={(t) =>
        css({
          display: "inline-flex",
          gap: "0.1rem",
          whiteSpace: "nowrap",
          fontSize: t.text.sizes.micro,
          lineHeight: 1.2,
          color: t.colors.textDimmed,
          borderRadius: "0.2rem",
          "@media(min-width: 600px)": {
            fontSize: t.text.sizes.tiny,
          },
          "& > *": {
            display: "flex",
            padding: "0.3rem 0.5rem",
            background: t.colors.backgroundModifierNormal,
            minWidth: "1.86rem",
            justifyContent: "center",
          },
          "& > *:first-of-type": {
            borderTopLeftRadius: "0.2rem",
            borderBottomLeftRadius: "0.2rem",
          },
          "& > *:last-of-type": {
            borderTopRightRadius: "0.2rem",
            borderBottomRightRadius: "0.2rem",
          },
          '[data-voted="true"]': {
            color: t.colors.textNormal,
            fontWeight: t.text.weights.smallTextEmphasis,
            background: t.colors.backgroundModifierStrong,
          },
          "[data-arrow]": {
            width: "0.9rem",
            marginLeft: "0.2rem",
            marginRight: "-0.1rem",
          },
          '[data-arrow="up"]': {
            transform: "scaleY(-1)",
          },
        })
      }
    >
      <span data-for={proposal.forVotes} data-voted={vote?.support === 1}>
        {proposal.forVotes}
        <ArrowDownSmallIcon data-arrow="up" />
      </span>
      <span
        data-abstain={proposal.abstainVotes}
        data-voted={vote?.support === 2}
      >
        {proposal.abstainVotes}
      </span>
      <span
        data-against={proposal.againstVotes}
        data-voted={vote?.support === 0}
      >
        {proposal.againstVotes}
        <ArrowDownSmallIcon data-arrow="down" />
      </span>
    </span>
  );
});

const ProposalCandidateItem = React.memo(({ candidateId }) => {
  const candidate = useProposalCandidate(candidateId);
  const updateTargetProposal = useProposal(
    candidate.latestVersion.targetProposalId,
    { watch: false }
  );

  const authorAccountDisplayName = useAccountDisplayName(candidate.proposerId);

  const candidateVotingPower = useProposalCandidateVotingPower(candidateId);
  const proposalThreshold = useProposalThreshold();

  const signals = getCandidateSignals({ candidate });
  // const commentCount =
  //   signals.delegates.for +
  //   signals.delegates.against +
  //   signals.delegates.abstain;

  const isCanceled = candidate.canceledTimestamp != null;
  const isProposalUpdate = candidate.latestVersion.targetProposalId != null;
  const isProposalThresholdMet = candidateVotingPower > proposalThreshold;

  const hasUpdate =
    candidate.lastUpdatedTimestamp != null &&
    candidate.lastUpdatedTimestamp.getTime() !==
      candidate.createdTimestamp.getTime();

  const feedbackPostsAscending = arrayUtils.sortBy(
    (p) => p.createdBlock,
    candidate?.feedbackPosts ?? []
  );
  const mostRecentFeedbackPost = feedbackPostsAscending.slice(-1)[0];

  const hasFeedback = mostRecentFeedbackPost != null;

  const mostRecentActivity =
    hasFeedback &&
    (!hasUpdate ||
      mostRecentFeedbackPost.createdBlock > candidate.lastUpdatedBlock)
      ? "feedback"
      : hasUpdate
      ? "update"
      : "create";

  const feedbackAuthorAccounts = arrayUtils.unique(
    feedbackPostsAscending.map((p) => p.voterId)
  );

  const showScoreStack = !isProposalUpdate;

  const renderProposalUpdateStatusText = () => {
    if (updateTargetProposal?.signers == null) return "...";

    const validSignatures = getCandidateSponsorSignatures(candidate, {
      excludeInvalid: true,
      activeProposerIds: [],
    });

    const signerIds = validSignatures.map((s) => s.signer.id.toLowerCase());

    const missingSigners = updateTargetProposal.signers.filter((s) => {
      const signerId = s.id.toLowerCase();
      return !signerIds.includes(signerId);
    });

    const sponsorCount =
      updateTargetProposal.signers.length - missingSigners.length;

    return (
      <>
        {sponsorCount} / {updateTargetProposal.signers.length} sponsors signed
      </>
    );
  };

  return (
    <NextLink
      prefetch
      href={`/candidates/${encodeURIComponent(
        makeCandidateUrlId(candidateId)
      )}`}
    >
      <div
        css={css({
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto",
          gridGap: "3.2rem",
          alignItems: "stretch",
        })}
      >
        <div
          css={css({
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr)",
            gridGap: "1.2rem",
            alignItems: "center",
          })}
          style={{
            gridTemplateColumns: showScoreStack
              ? "2.2rem minmax(0,1fr)"
              : undefined,
          }}
        >
          {showScoreStack && <div />}
          <div>
            <div data-small>
              {isProposalUpdate ? "Proposal update" : "Candidate"} by{" "}
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
            <div
              data-title
              css={css({ margin: "0.1rem 0", position: "relative" })}
            >
              {candidate.latestVersion.content.title}
              {showScoreStack && (
                <div
                  css={css({
                    position: "absolute",
                    right: "calc(100% + 1.2rem)",
                    top: "50%",
                    transform: "translateY(-50%)",
                  })}
                >
                  <ScoreStack {...signals.delegates} />
                </div>
              )}
            </div>
            <div data-small>
              {isProposalUpdate ? (
                renderProposalUpdateStatusText()
              ) : (
                <>
                  {mostRecentActivity === "update" ? (
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
                  ) : mostRecentActivity === "feedback" ? (
                    <>
                      Last comment{" "}
                      <FormattedDateWithTooltip
                        relativeDayThreshold={5}
                        capitalize={false}
                        value={mostRecentFeedbackPost.createdTimestamp}
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
                  {isProposalThresholdMet && (
                    <span>
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        css={(t) =>
                          css({
                            ":before": {
                              content: '"–"',
                              color: t.colors.textMuted,
                              margin: "0 0.5rem",
                            },
                          })
                        }
                      />
                      Sponsor threshold met
                    </span>
                  )}
                </>
              )}
            </div>
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
          {/* <span data-desktop-only> */}
          {/*   {commentCount > 0 ? ( */}
          {/*     <> */}
          {/*       <span data-small style={{ marginRight: "1.6rem" }}> */}
          {/*         {commentCount} comments */}
          {/*       </span> */}
          {/*     </> */}
          {/*   ) : null} */}
          {/* </span> */}
          <div
            css={css({
              display: "none",
              "@container(min-width: 540px)": {
                display: "flex",
                gap: "0.3rem",
                alignItems: "center",
              },
            })}
          >
            {feedbackAuthorAccounts.slice(0, 10).map((a) => (
              <AccountAvatar key={a} address={a} size="2rem" />
            ))}
            {feedbackAuthorAccounts.length > 10 && <>...</>}
          </div>

          {isCanceled ? (
            <Tag variant="error" size="large">
              Canceled
            </Tag>
          ) : isProposalUpdate ? (
            <Tag variant="special" size="large">
              Prop {candidate.latestVersion.targetProposalId} update
            </Tag>
          ) : null}
          {/* votingPower > proposalThreshold ? ( */}
          {/*   <Tag variant="success">Sponsor threshold met</Tag> */}
          {/* ) : ( */}
          {/*   <Tag> */}
          {/*     {votingPower} / {proposalThreshold + 1}{" "} */}
          {/*     {votingPower === 1 ? "sponsor" : "sponsors"} */}
          {/*   </Tag> */}
          {/* )} */}
        </div>
      </div>
    </NextLink>
  );
});

const ProposalDraftItem = ({ draftId }) => {
  const [draft] = useDraft(draftId);
  const { address: connectedAccountAddress } = useWallet();
  const authorAccountDisplayName = useAccountDisplayName(
    connectedAccountAddress
  );

  return (
    <NextLink prefetch href={`/new/${draftId}`}>
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
    </NextLink>
  );
};

const ScoreStack = React.memo(({ for: for_, against }) => {
  const score = for_ - against;
  const hasScore = for_ > 0 || against > 0;
  return (
    <div
      css={(t) =>
        css({
          width: "2.2rem",
          overflow: "visible",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.2rem",
          textAlign: "center",
          fontWeight: t.text.weights.normal,
        })
      }
    >
      <div
        data-active={for_ > 0}
        css={(t) =>
          css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: t.text.sizes.tiny,
            padding: "0.2rem",
            lineHeight: 1,
            color: t.colors.textMuted,
            "> *": { minWidth: "0.9rem" },
            '&[data-active="true"]': {
              color: t.colors.textPositive,
            },
          })
        }
      >
        <div>{for_}</div>
        <ArrowDownSmallIcon
          style={{ width: "0.9rem", transform: "scaleY(-1)" }}
        />
      </div>
      <div
        data-active={hasScore}
        css={(t) =>
          css({
            color: t.colors.textMuted,
            background: t.colors.backgroundModifierHover,
            fontSize: t.text.sizes.base,
            borderRadius: "0.2rem",
            lineHeight: 1,
            padding: "0.4rem",
            minWidth: "2.2rem",
            '&[data-active="true"]': {
              color: t.colors.textNormal,
            },
            '[data-negative="true"]': { transform: "translateX(-0.1rem)" },
          })
        }
      >
        <div data-negative={score < 0}>{score}</div>
      </div>
      <div
        data-active={against > 0}
        css={(t) =>
          css({
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: t.text.sizes.tiny,
            padding: "0.2rem",
            lineHeight: 1,
            color: t.colors.textMuted,
            "> *": { minWidth: "0.9rem" },
            '&[data-active="true"]': {
              color: t.colors.textNegative,
            },
          })
        }
      >
        <div>{against}</div>
        <ArrowDownSmallIcon style={{ width: "0.9rem" }} />
      </div>
    </div>
  );
});

const DraftTabContent = ({ items = [] }) => {
  const hasDrafts = items.length > 0;

  if (!hasDrafts)
    return (
      <Tabs.EmptyPlaceholder
        description="You have no drafts"
        buttonLabel="New proposal"
        buttonProps={{
          component: NextLink,
          href: "/new",
          icon: <PlusIcon style={{ width: "1rem" }} />,
        }}
        css={css({ padding: "3.2rem 0" })}
      />
    );

  return (
    <SectionedList
      sections={[
        {
          title: "Drafts",
          description:
            "Drafts are stored in your browser, and can’t be seen by anyone else",
          items,
        },
      ]}
    />
  );
};

const Pagination = ({ showNext, showAll }) => (
  <div
    css={{
      textAlign: "center",
      padding: "3.2rem 0",
      "@container (min-width: 600px)": {
        padding: "4.8rem 0",
      },
    }}
  >
    <Button size="small" onClick={showNext}>
      Show more
    </Button>
    <div style={{ marginTop: "1.6rem" }}>
      <Link
        size="small"
        component="button"
        color={(t) => t.colors.textDimmed}
        onClick={showAll}
      >
        Show all
      </Link>
    </div>
  </div>
);

export default BrowseScreen;
