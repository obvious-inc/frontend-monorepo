"use client";

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
import { useSubgraphFetch, useEnsCache, useProposals } from "../store.js";
import { search as searchEns } from "../utils/ens.js";
import {
  // isFinalState as isFinalProposalState,
  getForYouGroup as getProposalForYouGroup,
} from "../utils/proposals.js";
import useMatchDesktopLayout from "../hooks/match-desktop-layout.js";
import { useWallet } from "../hooks/wallet.js";
import { useSearchParams } from "../hooks/navigation.js";
import Layout, { MainContentContainer } from "./layout.js";
import DateRangePicker from "./date-range-picker.js";
import ProposalList from "./proposal-list.js";

const capitalize = (string) => string[0].toUpperCase() + string.slice(1);

const simplifiedProposalStates = [
  "upcoming", // pending and updatable
  "ongoing", // active and objection-period
  "succeeded",
  "queued",
  "executed",
  "defeated",
  "canceled",
  "vetoed",
  "expired",
];

const simplifiedProposalStatesByCategory = arrayUtils.groupBy((s) => {
  switch (s) {
    case "upcoming":
    case "ongoing":
      return "undecided";
    case "succeeded":
    case "queued":
    case "executed":
      return "passed";
    case "defeated":
    case "canceled":
    case "vetoed":
    case "expired":
      return "failed";
    default:
      throw new Error();
  }
}, simplifiedProposalStates);

const sectionTitleByKey = {
  new: "Upcoming",
  ongoing: "Ongoing",
  "awaiting-vote": "Not yet voted",
  authored: "Authored",
  past: "Past",
};

const BrowseProposalsScreen = () => {
  const isDesktopLayout = useMatchDesktopLayout();

  const { address: connectedAccountAddress } = useWallet();

  const proposals = useProposals({ state: true });
  const { nameByAddress: primaryEnsNameByAddress } = useEnsCache();

  const [visibleSimplifiedProposalStates, setVisibleSimlifiedProposalStates] =
    React.useState(() => new Set(simplifiedProposalStates));
  const [localDateRange, setLocalDateRange] = React.useState(null);

  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const sortStrategy = searchParams.get("sort") ?? "chronological";
  const isAscendingOrder = searchParams.get("asc") != null;

  const sortOrder = isAscendingOrder ? "asc" : "desc";

  const deferredQuery = React.useDeferredValue(query.trim());
  const deferredSortStrategy = React.useDeferredValue(sortStrategy);
  const deferredSortOrder = React.useDeferredValue(sortOrder);

  const visibleProposalStates = React.useMemo(
    () =>
      [...visibleSimplifiedProposalStates.keys()].flatMap((s) => {
        switch (s) {
          case "upcoming":
            return ["pending", "updatable"];
          case "ongoing":
            return ["active", "objection-period"];
          default:
            return [s];
        }
      }),
    [visibleSimplifiedProposalStates],
  );

  const deferredVisibleProposalStates = React.useDeferredValue(
    visibleProposalStates,
  );

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

  const sortedFilteredProposals = React.useMemo(() => {
    const filter = (proposals) => {
      const proposalStateFilterPredicate = (p) =>
        p.title != null && deferredVisibleProposalStates.includes(p.state);

      const timeframePredicate = (() => {
        const { start, end } = deferredDateRange;
        if (start == null && end == null) return null;
        return (p) => {
          if (start == null) return p.createdTimestamp < end;
          if (end == null) return p.createdTimestamp > start;
          return p.createdTimestamp < end && p.createdTimestamp > start;
        };
      })();

      const sortStrategyPredicate = (() => {
        switch (deferredSortStrategy) {
          case "token-turnout":
          case "for-votes":
          case "against-votes":
          case "abstain-votes":
            return (p) => {
              const voteCount = p.forVotes + p.againstVotes + p.abstainVotes;
              return voteCount > 0;
            };
          case "voting-state":
          case "chronological":
            return null;
          default:
            throw new Error(`Invalid sort strategy: ${deferredSortStrategy}`);
        }
      })();

      const predicates = [
        proposalStateFilterPredicate,
        timeframePredicate,
        sortStrategyPredicate,
      ].filter(Boolean);

      if (predicates.length === 0) return proposals;

      return proposals.filter((p) =>
        predicates.every((predicate) => predicate(p)),
      );
    };

    const group = (proposals) => {
      switch (deferredSortStrategy) {
        case "voting-state": {
          const proposalsByGroupKey = arrayUtils.groupBy(
            (p) => getProposalForYouGroup({ connectedAccountAddress }, p),
            proposals,
          );

          return ["new", "ongoing", "awaiting-vote", "authored", "past"].reduce(
            (acc, groupKey) => {
              const proposals = proposalsByGroupKey[groupKey];
              if (proposals == null) return acc;
              return [
                ...acc,
                {
                  type: "section",
                  key: groupKey,
                  title: sectionTitleByKey[groupKey],
                  children: proposals,
                },
              ];
            },
            [],
          );
        }
        case "chronological":
        case "token-turnout":
        case "for-votes":
        case "against-votes":
        case "abstain-votes":
          return proposals;
        default:
          throw new Error(`Invalid sort strategy: ${deferredSortStrategy}`);
      }
    };

    const sort = (proposals) => {
      const order = deferredSortOrder;

      switch (deferredSortStrategy) {
        case "voting-state":
          return proposals.map((section) => {
            switch (section.key) {
              case "awaiting-vote":
                return {
                  ...section,
                  children: arrayUtils.sortBy(
                    (i) => Number(i.objectionPeriodEndBlock ?? i.endBlock),
                    section.children,
                  ),
                };
              case "authored":
              case "new":
              case "ongoing":
              case "past":
                return {
                  ...section,
                  children: arrayUtils.sortBy(
                    {
                      value: (i) => Number(i.startBlock),
                      order: "desc",
                    },
                    section.children,
                  ),
                };
              default:
                throw new Error(`Invalid section key: ${section.key}`);
            }
          });

        case "chronological":
          return arrayUtils.sortBy(
            { value: (p) => Number(p.createdBlock), order },
            proposals,
          );
        case "token-turnout":
          return arrayUtils.sortBy(
            {
              value: (p) => {
                const voteCount = p.forVotes + p.againstVotes + p.abstainVotes;
                return voteCount / p.adjustedTotalSupply;
              },
              order,
            },
            proposals,
          );
        case "for-votes":
          return arrayUtils.sortBy(
            { value: (p) => p.forVotes + 1 / (p.againstVotes + 1), order },
            proposals,
          );
        case "against-votes":
          return arrayUtils.sortBy(
            {
              value: (p) => p.againstVotes + 1 / (p.forVotes + 1),
              order,
            },
            proposals,
          );
        case "abstain-votes":
          return arrayUtils.sortBy(
            {
              value: (p) => {
                const nonAbstainVoteCount = p.forVotes + p.againstVotes;
                return p.abstainVotes + 1 / (nonAbstainVoteCount + 1);
              },
              order,
            },
            proposals,
          );
        default:
          throw new Error(`Invalid sort strategy: ${deferredSortStrategy}`);
      }
    };

    if (deferredQuery.trim() === "") return sort(group(filter(proposals)));

    const matchingRecords = searchRecords(
      filter(proposals).map((p) => ({
        data: p,
        tokens: [
          { value: p.id, exact: true },
          { value: p.proposerId, exact: true },
          { value: p.title },
          ...(p.signers ?? []).map((s) => ({ value: s.id, exact: true })),
        ],
        fallbackSortProperty: p.createdBlock,
      })),
      [deferredQuery, ...matchingAddresses],
    );

    return matchingRecords.map((r) => r.data);
  }, [
    connectedAccountAddress,
    matchingAddresses,
    deferredQuery,
    // deferredFilter,
    deferredVisibleProposalStates,
    deferredSortStrategy,
    deferredSortOrder,
    deferredDateRange,
    proposals,
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
        newParams.set("q", query);
        return newParams;
      },
      { replace: true },
    );
  });

  const subgraphFetch = useSubgraphFetch();

  useFetch(
    ({ signal }) => {
      const pageSize = 50;

      const fetchProposals = async (page = 1) => {
        const { proposals } = await subgraphFetch({
          query: `{
            proposals(
              orderBy: createdBlock,
              orderDirection: desc,
              first: ${pageSize},
              skip: ${(page - 1) * pageSize},
            ) {
              id
              title
              status
              createdBlock
              createdTimestamp
              lastUpdatedBlock
              lastUpdatedTimestamp
              startBlock
              endBlock
              updatePeriodEndBlock
              objectionPeriodEndBlock
              canceledBlock
              canceledTimestamp
              queuedBlock
              queuedTimestamp
              executedBlock
              executedTimestamp
              forVotes
              againstVotes
              abstainVotes
              quorumVotes
              executionETA
              adjustedTotalSupply
              proposer { id }
              signers { id }
            }
          }`,
        });
        if (signal?.aborted) return;
        if (proposals.length < pageSize) return proposals;
        const remainingProposals = await fetchProposals(page + 1);
        return [...proposals, ...remainingProposals];
      };

      return fetchProposals();
    },
    [subgraphFetch],
  );

  useFetch(
    ({ signal }) => {
      const pageSize = 1000;

      const fetchAccountVotes = async (page = 1) => {
        const { votes } = await subgraphFetch({
          query: `{
            votes(
              orderBy: blockNumber,
              orderDirection: desc,
              first: ${pageSize},
              skip: ${(page - 1) * pageSize},
              where: {
                voter: "${connectedAccountAddress}"
              }
            ) {
              id
              supportDetailed
              voter { id }
              proposal { id }
            }
          }`,
        });
        if (signal?.aborted) return;
        if (votes.length < pageSize) return votes;
        const remainingVotes = await fetchAccountVotes(page + 1);
        return [...votes, ...remainingVotes];
      };

      return fetchAccountVotes();
    },
    {
      enabled: connectedAccountAddress != null,
    },
    [subgraphFetch, connectedAccountAddress],
  );

  const sortOptions = [
    {
      value: "chronological",
      label: "Latest",
    },
    {
      value: "voting-state",
      label: "Voting state",
    },
    {
      value: "token-turnout",
      label: "Turnout",
    },
    {
      value: "for-votes",
      label: "For votes",
    },
    {
      value: "against-votes",
      label: "Against votes",
    },
    {
      value: "abstain-votes",
      label: "Abstain votes",
    },
  ];

  return (
    <>
      <Layout
        navigationStack={[{ to: "/proposals", label: "Proposals" }]}
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
                      <Label style={{ display: "block" }}>
                        Proposal states
                      </Label>
                      <Menu.Root>
                        <Menu.Trigger asChild>
                          <Button
                            align="left"
                            size="default"
                            fullWidth
                            iconRight={
                              <CaretDownIcon
                                style={{ width: "1.1rem", height: "auto" }}
                              />
                            }
                          >
                            <span
                              css={(t) =>
                                css({
                                  em: {
                                    fontStyle: "normal",
                                    fontWeight: t.text.weights.emphasis,
                                  },
                                })
                              }
                            >
                              {(() => {
                                if (visibleSimplifiedProposalStates.size === 0)
                                  return "Hide all";

                                if (
                                  visibleSimplifiedProposalStates.size ===
                                  simplifiedProposalStates.length
                                )
                                  return "Show all";

                                const { hidden, visible } = arrayUtils.groupBy(
                                  (g) =>
                                    visibleSimplifiedProposalStates.has(g)
                                      ? "visible"
                                      : "hidden",
                                  simplifiedProposalStates,
                                );

                                if (hidden.length === 1)
                                  return (
                                    <>
                                      Hide <em>{hidden[0]}</em>
                                    </>
                                  );
                                if (hidden.length === 2)
                                  return (
                                    <>
                                      Hide <em>{hidden[0]}</em> and{" "}
                                      <em>{hidden[1]}</em>
                                    </>
                                  );

                                return (
                                  <>
                                    Show{" "}
                                    {visible.map((state, i) => (
                                      <React.Fragment key={state}>
                                        {i > 0 && <>, </>}
                                        <em>{state}</em>
                                      </React.Fragment>
                                    ))}
                                  </>
                                );
                              })()}
                            </span>
                          </Button>
                        </Menu.Trigger>
                        <Menu.Content
                          widthFollowTrigger
                          selectionMode="multiple"
                          selectedKeys={visibleSimplifiedProposalStates}
                          onSelectionChange={(states) => {
                            setVisibleSimlifiedProposalStates(states);
                          }}
                        >
                          {["undecided", "passed", "failed"].map((category) => {
                            const simplifiedStates =
                              simplifiedProposalStatesByCategory[category];
                            return (
                              <Menu.Section
                                key={category}
                                title={capitalize(category)}
                              >
                                {simplifiedStates.map((state) => (
                                  <Menu.Item key={state}>
                                    {capitalize(state)}
                                  </Menu.Item>
                                ))}
                              </Menu.Section>
                            );
                          })}
                        </Menu.Content>
                      </Menu.Root>
                    </div>
                    <DateRangePicker
                      // inlineLabel="Timeframe"
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
              {/* <div
                css={css({
                  display: "flex",
                  justifyContent: "flex-end",
                  padding: "0.8rem 0 0",
                  marginBottom: "1.6rem",
                  "@media (min-width: 600px)": {
                    padding: 0,
                    marginBottom: "2rem",
                  },
                })}
              >
                <Switch
                  value={filter !== "none"}
                  onChange={(toggled) => {
                    setFilter(toggled ? "final" : "none");
                  }}
                  label="Exclude ongoing proposals"
                  align="right"
                  size="small"
                  css={(t) =>
                    css({
                      // fontSize: t.text.sizes.small,
                      color: t.colors.textDimmed,
                    })
                  }
                />
              </div> */}
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
                    // Top padding to offset the focus box shadow
                    padding: "0.3rem 1.6rem 0",
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

              <div
                css={css({
                  display: "flex",
                  gap: "0.8rem",
                  margin: "1.6rem 0",
                  "@media (min-width: 600px)": {
                    margin: "1.6rem 0 2.8rem",
                  },
                })}
              >
                <div>
                  <Select
                    size="small"
                    aria-label="Sort by"
                    value={sortStrategy}
                    options={sortOptions}
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
                    inlineLabel="Sort by"
                  />
                </div>
                {sortStrategy !== "voting-state" && (
                  <div>
                    <Select
                      size="small"
                      aria-label="Order"
                      inlineLabel="Order"
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
              </div>
              <ProposalList
                isLoading={
                  proposals.length === 0 ||
                  sortStrategy !== deferredSortStrategy ||
                  sortOrder !== deferredSortOrder ||
                  dateRange !== deferredDateRange
                }
                sortStrategy={deferredSortStrategy}
                items={sortedFilteredProposals}
              />
            </div>
          </MainContentContainer>
        </div>
      </Layout>
    </>
  );
};

export default BrowseProposalsScreen;
