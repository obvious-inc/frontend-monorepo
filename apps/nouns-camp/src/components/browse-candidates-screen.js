"use client";

import dateSubtractDays from "date-fns/subDays";
import dateStartOfDay from "date-fns/startOfDay";
import React from "react";
import { css } from "@emotion/react";
import NextLink from "next/link";
import { useDebouncedCallback } from "use-debounce";
import { array as arrayUtils, searchRecords } from "@shades/common/utils";
import { useFetch } from "@shades/common/react";
import Input, { Label } from "@shades/ui-web/input";
import Button from "@shades/ui-web/button";
import Select from "@shades/ui-web/select";
import * as Menu from "@shades/ui-web/dropdown-menu";
import { CaretDown as CaretDownIcon } from "@shades/ui-web/icons";
// import Switch from "@shades/ui-web/switch";
import {
  useSubgraphFetch,
  useEnsCache,
  useProposalCandidates,
} from "../store.js";
import { search as searchEns } from "../utils/ens.js";
import {
  getForYouGroup as getCandidateForYouGroup,
  getScore as getCandidateScore,
} from "../utils/candidates.js";
import useMatchDesktopLayout from "../hooks/match-desktop-layout.js";
import { useWallet } from "../hooks/wallet.js";
import { useSearchParams } from "../hooks/navigation.js";
import Layout, { MainContentContainer } from "./layout.js";
import DateRangePicker from "./date-range-picker.js";
import ProposalList from "./proposal-list.js";

const NEW_THRESHOLD_IN_DAYS = 3;
const ACTIVE_THRESHOLD_IN_DAYS = 5;

const sectionConfigByKey = {
  authored: { title: "Authored" },
  sponsored: { title: "Sponsored" },
  "sponsored-proposal-update-awaiting-signature": {
    title: "Missing your signature",
  },
  new: {
    title: "New",
    description: `Candidates created within the last ${NEW_THRESHOLD_IN_DAYS} days`,
  },
  active: { title: "Recently active" },
  inactive: {
    title: "Stale",
    description: `No activity within the last ${ACTIVE_THRESHOLD_IN_DAYS} days`,
  },
};

const sortOptions = [
  { value: "chronological", label: "Latest" },
  { value: "activity", label: "Recent activity" },
  { value: "popularity", label: "Popularity" },
];

const filterOptions = [
  {
    key: "non-canceled",
    label: "Show non-canceled",
    inlineLabel: "non-canceled",
  },
  {
    key: "canceled",
    label: "Show canceled",
    inlineLabel: "canceled",
  },
  {
    key: "proposal-updates",
    label: "Show proposal updates",
    inlineLabel: "prop updates",
  },
  {
    key: "promoted",
    label: "Show promoted",
    inlineLabel: "promoted",
  },
];

const BrowseCandidatesScreen = () => {
  const isDesktopLayout = useMatchDesktopLayout();

  const { address: connectedAccountAddress } = useWallet();

  const candidates = useProposalCandidates({
    includeCanceled: true,
    includePromoted: true,
    includeProposalUpdates: true,
  });
  const { nameByAddress: primaryEnsNameByAddress } = useEnsCache();

  const [showRegular, setShowRegular] = React.useState(true);
  const [showCanceled, setShowCanceled] = React.useState(false);
  const [showProposalUpdates, setShowProposalUpdates] = React.useState(false);
  const [showPromoted, setShowPromoted] = React.useState(false);

  const [localDateRange, setLocalDateRange] = React.useState(null);

  const [showFilters, setShowFilters] = React.useState(false);

  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const sortStrategy_ = searchParams.get("sort");
  const sortStrategy = sortOptions.some((o) => o.value === sortStrategy_)
    ? sortStrategy_
    : query.trim() !== ""
      ? "best-match"
      : "chronological";
  const isAscendingOrder = searchParams.get("asc") != null;

  const sortOrder = isAscendingOrder ? "asc" : "desc";

  const deferredQuery = React.useDeferredValue(query.trim());
  const deferredSortStrategy = React.useDeferredValue(sortStrategy);
  const deferredSortOrder = React.useDeferredValue(sortOrder);

  const deferredShowRegular = React.useDeferredValue(showRegular);
  const deferredShowCanceled = React.useDeferredValue(showCanceled);
  const deferredShowProposalUpdates =
    React.useDeferredValue(showProposalUpdates);
  const deferredShowPromoted = React.useDeferredValue(showPromoted);

  const dateRange = React.useMemo(
    () => ({
      start: localDateRange?.start.toDate() ?? null,
      end: localDateRange?.end.toDate() ?? null,
    }),
    [localDateRange],
  );
  const deferredDateRange = React.useDeferredValue(dateRange);

  const matchingAddresses = React.useMemo(() => {
    if (deferredQuery.trim() === "") return [];
    return searchEns(primaryEnsNameByAddress, deferredQuery);
  }, [primaryEnsNameByAddress, deferredQuery]);

  const sortedFilteredCandidates = React.useMemo(() => {
    const filter = (candidates) => {
      const stateFilterPredicate = (c) => {
        // Incomplete data
        if (c.latestVersion == null) return false;

        // Canceled filter trumps everything
        if (c.canceledTimestamp != null && !deferredShowCanceled) return false;

        // Updates & promoted candies override the "regular" filter
        if (c.latestVersion.targetProposalId != null)
          return deferredShowProposalUpdates;
        if (c.latestVersion.proposalId != null) return deferredShowPromoted;

        // Filtering by non-canceled last to not mess with other filters
        if (c.canceledTimestamp == null && !deferredShowRegular) return false;

        return true;
      };

      const timeframePredicate = (() => {
        const { start, end } = deferredDateRange;
        if (start == null && end == null) return null;
        return (c) => {
          if (start == null) return c.createdTimestamp < end;
          if (end == null) return c.createdTimestamp > start;
          return c.createdTimestamp < end && c.createdTimestamp > start;
        };
      })();

      const predicates = [stateFilterPredicate, timeframePredicate].filter(
        Boolean,
      );

      if (predicates.length === 0) return candidates;

      return candidates.filter((p) =>
        predicates.every((predicate) => predicate(p)),
      );
    };

    const group = (candidates) => {
      switch (deferredSortStrategy) {
        case "activity": {
          const activeThreshold = dateStartOfDay(
            dateSubtractDays(new Date(), ACTIVE_THRESHOLD_IN_DAYS),
          );
          const newThreshold = dateStartOfDay(
            dateSubtractDays(new Date(), NEW_THRESHOLD_IN_DAYS),
          );
          const candidatesByGroupKey = arrayUtils.groupBy((p) => {
            const groupKey = getCandidateForYouGroup(
              { connectedAccountAddress, activeThreshold, newThreshold },
              p,
            );
            if (groupKey === "authored-proposal-update") return "authored";
            return groupKey;
          }, candidates);

          return [
            "sponsored-proposal-update-awaiting-signature",
            "authored",
            "sponsored",
            "new",
            "active",
            "inactive",
          ].reduce((acc, groupKey) => {
            const candidates = candidatesByGroupKey[groupKey];
            if (candidates == null) return acc;
            return [
              ...acc,
              {
                type: "section",
                key: groupKey,
                title: sectionConfigByKey[groupKey]?.title,
                description: sectionConfigByKey[groupKey]?.description,
                children: candidates,
              },
            ];
          }, []);
        }
        case "popularity":
        case "chronological":
        case "best-match":
          return candidates;
        default:
          throw new Error(`Invalid sort strategy: ${deferredSortStrategy}`);
      }
    };

    const sort = (candidates) => {
      const order = deferredSortOrder;

      switch (deferredSortStrategy) {
        case "best-match":
          return candidates;

        case "chronological":
          return arrayUtils.sortBy(
            { value: (p) => Number(p.createdBlock), order },
            candidates,
          );

        case "popularity":
          return arrayUtils.sortBy(
            { value: (i) => getCandidateScore(i) ?? 0, order },
            candidates,
          );

        case "activity":
          return candidates.map((section) => {
            return {
              ...section,
              children: arrayUtils.sortBy(
                {
                  value: (i) => {
                    const mostRecentActivtyTimestamp = Math.max(
                      i.lastUpdatedTimestamp,
                      ...(i.feedbackPosts?.map((p) => p.createdTimestamp) ??
                        []),
                    );

                    return mostRecentActivtyTimestamp;
                  },
                  order: "desc",
                },
                section.children,
              ),
            };
          });

        default:
          throw new Error(`Invalid sort strategy: ${deferredSortStrategy}`);
      }
    };

    if (deferredQuery.trim() === "") return sort(group(filter(candidates)));

    const matchingRecords = searchRecords(
      filter(candidates).map((c) => ({
        data: c,
        tokens: [
          { value: c.id, exact: true },
          { value: c.proposerId, exact: true },
          { value: c.latestVersion?.content.title },
          ...(c.latestVersion?.content.contentSignatures ?? []).map((s) => ({
            value: s.signer.id,
            exact: true,
          })),
        ],
        fallbackSortProperty: c.createdBlock,
      })),
      [deferredQuery, ...matchingAddresses],
    );

    return sort(matchingRecords.map((r) => r.data));
  }, [
    connectedAccountAddress,
    matchingAddresses,
    deferredQuery,
    deferredShowRegular,
    deferredShowCanceled,
    deferredShowProposalUpdates,
    deferredShowPromoted,
    deferredSortStrategy,
    deferredSortOrder,
    deferredDateRange,
    candidates,
  ]);

  const handleSearchInputChange = useDebouncedCallback((query) => {
    // Clear search from path if query is empty
    if (query.trim() === "") {
      setSearchParams(
        (p) => {
          const newParams = new URLSearchParams(p);
          newParams.delete("q");
          return newParams;
        },
        { replace: true },
      );
      return;
    }

    setSearchParams(
      (p) => {
        const newParams = new URLSearchParams(p);
        if (p.get("q") == null) {
          // newParams.set("sort", "best-match");
          newParams.delete("sort");
        }
        newParams.set("q", query);
        return newParams;
      },
      { replace: true },
    );
  });

  const selectedFilters = (() => {
    const toggledFilters = [];
    if (showRegular) toggledFilters.push("non-canceled");
    if (showCanceled) toggledFilters.push("canceled");
    if (showProposalUpdates) toggledFilters.push("proposal-updates");
    if (showPromoted) toggledFilters.push("promoted");
    return new Set(toggledFilters);
  })();

  const setSelectedFilters = (filters) => {
    setShowRegular(filters.has("non-canceled"));
    setShowCanceled(filters.has("canceled"));
    setShowProposalUpdates(filters.has("proposal-updates"));
    setShowPromoted(filters.has("promoted"));
  };

  const subgraphFetch = useSubgraphFetch();

  useFetch(
    ({ signal }) => {
      const pageSize = 50;

      const fetchCandidates = async (page = 1) => {
        const { proposalCandidates } = await subgraphFetch({
          query: `{
            proposalCandidates(
              orderBy: createdBlock,
              orderDirection: desc,
              first: ${pageSize},
              skip: ${(page - 1) * pageSize},
            ) {
              id
              slug
              proposer
              createdBlock
              canceledBlock
              lastUpdatedBlock
              canceledTimestamp
              createdTimestamp
              lastUpdatedTimestamp
              latestVersion {
                id
                content {
                  title
                  matchingProposalIds
                  proposalIdToUpdate
                  contentSignatures {
                    canceled
                    createdBlock
                    createdTimestamp
                    expirationTimestamp
                    signer {
                      id
                      nounsRepresented { id }
                    }
                  }
                }
              }
            }
          }`,
        });
        const matchingProposalIds = proposalCandidates
          .map((c) => c.latestVersion.proposalId)
          .filter(Boolean);

        // Props required to show signers state on updates
        if (matchingProposalIds.length > 0)
          await subgraphFetch({
            query: `{
              proposals(
                first: 1000,
                where: { id_in: [${matchingProposalIds.map((id) => `"${id}"`)}] }
              ) {
                id
                createdTimestamp
                signers { id }
              }
            }`,
          });

        if (signal?.aborted) return [];
        if (proposalCandidates.length < pageSize) return proposalCandidates;
        // Recursively fetch the rest
        const rest = await fetchCandidates(page + 1);
        return [...proposalCandidates, ...rest];
      };

      return fetchCandidates();
    },
    [subgraphFetch],
  );

  useFetch(
    ({ signal }) => {
      const pageSize = 1000;

      const fetchCandidateFeedbacks = async (page = 1) => {
        const { candidateFeedbacks } = await subgraphFetch({
          query: `{
            candidateFeedbacks(
              orderBy: createdBlock,
              orderDirection: desc,
              first: ${pageSize},
              skip: ${(page - 1) * pageSize},
            ) {
              id
              supportDetailed
              createdBlock
              createdTimestamp
              votes
              voter {
                id
                nounsRepresented { id }
              }
              candidate { id }
            }
          }`,
        });
        if (signal?.aborted) return [];
        if (candidateFeedbacks.length < pageSize) return candidateFeedbacks;
        // Recursively fetch the rest
        const rest = await fetchCandidateFeedbacks(page + 1);
        return [...candidateFeedbacks, ...rest];
      };

      return fetchCandidateFeedbacks();
    },
    [subgraphFetch],
  );

  return (
    <>
      <Layout
        navigationStack={[{ to: "/candidates", label: "Candidates" }]}
        actions={[
          {
            label: "Propose",
            buttonProps: {
              component: NextLink,
              href: "/new",
              prefetch: true,
            },
          },
        ]}
      >
        <div css={css({ padding: "0 1.6rem" })}>
          <MainContentContainer
            sidebarWidth="30rem"
            sidebar={
              !isDesktopLayout ? null : (
                <>
                  <div
                    css={css({
                      display: "flex",
                      flexDirection: "column",
                      gap: "1.6rem",
                      padding: "0 0 3.2rem",
                      "@media (min-width: 600px)": {
                        padding: "6rem 0 8rem",
                      },
                    })}
                  >
                    <div>
                      <Label style={{ display: "block" }}>Filters</Label>
                      <FilterMenu
                        size="default"
                        fullWidth
                        widthFollowTrigger
                        selectedFilters={selectedFilters}
                        setSelectedFilters={setSelectedFilters}
                      />
                    </div>
                    <DateRangePicker
                      label="Timeframe"
                      fullWidth
                      granularity="day"
                      size="default"
                      value={localDateRange}
                      onChange={setLocalDateRange}
                    />
                  </div>
                </>
              )
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
                    // Background needed since the input is transparent
                    background: t.colors.backgroundPrimary,
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                    // Top offset to prevent hidden focus box shadow when sticky
                    padding: "0.3rem 0 0",
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
                />
              </div>

              <div
                css={css({
                  display: "flex",
                  flexDirection: "column",
                  margin: "1.6rem 0",
                  "@media (min-width: 600px)": {
                    margin: "1.6rem 0 2.8rem",
                  },
                })}
              >
                <div css={css({ display: "flex", gap: "0.8rem" })}>
                  <div>
                    <Select
                      size="small"
                      aria-label="Sort by"
                      inlineLabel={
                        !isDesktopLayout && sortStrategy === "popularity"
                          ? null
                          : "Sort by"
                      }
                      value={sortStrategy}
                      options={[
                        query.trim() !== "" && {
                          value: "best-match",
                          label: "Best match",
                        },
                        ...sortOptions,
                      ].filter(Boolean)}
                      onChange={(value) => {
                        setSearchParams(
                          (p) => {
                            const newParams = new URLSearchParams(p);
                            newParams.set("sort", value);
                            newParams.delete("asc");
                            return newParams;
                          },
                          { replace: true },
                        );
                      }}
                      fullWidth={false}
                      width="max-content"
                    />
                  </div>
                  {!["activity", "best-match"].includes(sortStrategy) && (
                    <div>
                      <Select
                        size="small"
                        aria-label="Order"
                        inlineLabel={isDesktopLayout ? "Order" : undefined}
                        value={sortOrder}
                        options={[
                          { value: "asc", label: "Ascending" },
                          { value: "desc", label: "Descending" },
                        ]}
                        onChange={(value) => {
                          if (value !== "asc") {
                            setSearchParams(
                              (p) => {
                                const newParams = new URLSearchParams(p);
                                newParams.delete("asc");
                                return newParams;
                              },
                              { replace: true },
                            );
                            return;
                          }
                          setSearchParams(
                            (p) => {
                              const newParams = new URLSearchParams(p);
                              newParams.set("asc", 1);
                              return newParams;
                            },
                            { replace: true },
                          );
                        }}
                        fullWidth={false}
                        width="max-content"
                      />
                    </div>
                  )}
                  {!isDesktopLayout && (
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        justifyContent: "flex-end",
                      }}
                    >
                      <Button
                        size="small"
                        variant="transparent"
                        iconRight={
                          <CaretDownIcon
                            style={{
                              display: "inline-flex",
                              width: "0.9rem",
                              height: "auto",
                              marginLeft: " 0.2rem",
                            }}
                          />
                        }
                        onClick={() => {
                          setShowFilters((s) => !s);
                        }}
                      >
                        Filters
                      </Button>
                    </div>
                  )}
                </div>
                {!isDesktopLayout && showFilters && (
                  <div
                    css={css({
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.8rem",
                      marginTop: "1.6rem",
                    })}
                  >
                    <FilterMenu
                      size="small"
                      fullWidth
                      widthFollowTrigger
                      selectedFilters={selectedFilters}
                      setSelectedFilters={setSelectedFilters}
                    />
                    <DateRangePicker
                      inlineLabel="Timeframe"
                      granularity="day"
                      size="small"
                      fullWidth
                      value={localDateRange}
                      onChange={setLocalDateRange}
                    />
                  </div>
                )}
              </div>
              <ProposalList
                isLoading={
                  candidates.length === 0 ||
                  sortStrategy !== deferredSortStrategy ||
                  sortOrder !== deferredSortOrder ||
                  dateRange !== deferredDateRange
                }
                sortStrategy={deferredSortStrategy}
                items={sortedFilteredCandidates}
                getItemProps={() => ({
                  showScoreStack: deferredSortStrategy === "popularity",
                })}
              />
            </div>
          </MainContentContainer>
        </div>
      </Layout>
    </>
  );
};

const FilterMenu = ({
  size,
  fullWidth,
  widthFollowTrigger,
  inlineLabel,
  selectedFilters,
  setSelectedFilters,
}) => (
  <Menu.Root>
    <Menu.Trigger asChild>
      <Button
        align="left"
        size={size}
        fullWidth={fullWidth}
        iconRight={
          <CaretDownIcon style={{ width: "1.1rem", height: "auto" }} />
        }
      >
        <span
          data-inline-label={inlineLabel != null}
          css={(t) =>
            css({
              em: {
                fontStyle: "normal",
                fontWeight: t.text.weights.emphasis,
              },
              '&[data-inline-label="true"]': {
                fontWeight: t.text.weights.emphasis,
                ".inline-label": {
                  fontWeight: t.text.weights.normal,
                },
              },
            })
          }
        >
          {inlineLabel != null && (
            <span className="inline-label">{inlineLabel}: </span>
          )}
          {(() => {
            if (selectedFilters.size === filterOptions.length)
              return "Show all";

            if (selectedFilters.size === 0) return "Hide all";

            const { visible = [] } = arrayUtils.groupBy(
              (o) => (selectedFilters.has(o.key) ? "visible" : "hidden"),
              filterOptions,
            );

            return (
              <>
                {inlineLabel == null && <>Show </>}
                {visible.map((o, i, os) => {
                  const isLast = i === os.length - 1;
                  return (
                    <React.Fragment key={o.key}>
                      {i > 0 && (isLast ? <>, and </> : <>, </>)}
                      <em>{o.inlineLabel}</em>
                    </React.Fragment>
                  );
                })}
              </>
            );
          })()}
        </span>
      </Button>
    </Menu.Trigger>
    <Menu.Content
      widthFollowTrigger={widthFollowTrigger}
      selectionMode="multiple"
      selectedKeys={selectedFilters}
      onSelectionChange={(filters) => {
        setSelectedFilters(filters);
      }}
    >
      {filterOptions.map((o) => (
        <Menu.Item key={o.key}>{o.label}</Menu.Item>
      ))}
    </Menu.Content>
  </Menu.Root>
);

export default BrowseCandidatesScreen;
