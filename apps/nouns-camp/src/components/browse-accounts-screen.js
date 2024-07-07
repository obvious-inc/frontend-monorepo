"use client";

import startOfDay from "date-fns/startOfDay";
import endOfDay from "date-fns/endOfDay";
import React from "react";
import { css } from "@emotion/react";
import NextLink from "next/link";
import { useDebouncedCallback } from "use-debounce";
import {
  array as arrayUtils,
  object as objectUtils,
} from "@shades/common/utils";
import { useFetch } from "@shades/common/react";
import Input from "@shades/ui-web/input";
import Select from "@shades/ui-web/select";
import { useDelegatesFetch, useDelegates, useEnsCache } from "../store.js";
import { subgraphFetch } from "../nouns-subgraph.js";
import { search as searchEns } from "../utils/ens.js";
import { createRepostExtractor } from "../utils/votes-and-feedbacks.js";
import { useSearchParams } from "../hooks/navigation.js";
import useContract from "../hooks/contract.js";
import Layout, { MainContentContainer } from "./layout.js";
import DateRangePicker, { toLocalDate } from "./date-range-picker.js";
import ProposalList from "./proposal-list.js";

const ONE_DAY_MILLIS = 24 * 60 * 60 * 1000;

export const useVotes = ({ start, end } = {}) => {
  const [votesByAccountAddress, setVotesByAccountAddress] =
    React.useState(null);

  useFetch(
    async ({ signal }) => {
      const fetchVotes = async ({ page = 1, pageSize = 1000 } = {}) => {
        const { votes } = await subgraphFetch({
          query: `{
          votes (
            orderBy: blockNumber,
            first: ${pageSize},
            skip: ${(page - 1) * pageSize}
           where: {
             ${[
               start == null
                 ? null
                 : `# blockTimestamp_gt: "${Math.floor(start.getTime() / 1000)}"`,
               end == null
                 ? null
                 : `# blockTimestamp_lt: "${Math.floor(end.getTime() / 1000)}"`,
             ].join(",")}
           }
          ) {
            supportDetailed
            reason
            voter { id }
          }
        }`,
        });

        if (votes.length < pageSize) return votes;

        const remainingVotes = await fetchVotes({ page: page + 1, pageSize });

        return [...votes, ...remainingVotes];
      };

      const votes = await fetchVotes();

      if (signal?.aborted) return;

      const votesByAccountAddress = votes.reduce((acc, v) => {
        return { ...acc, [v.voter.id]: [...(acc[v.voter.id] ?? []), v] };
      }, {});

      setVotesByAccountAddress(votesByAccountAddress);
    },
    [start, end],
  );

  const vwrCountByAccountAddress = React.useMemo(() => {
    if (votesByAccountAddress == null) return null;
    return objectUtils.mapValues(
      (votes) =>
        votes.reduce((sum, v) => {
          if (v.reason == null || v.reason.trim() === "") return sum;
          return sum + 1;
        }, 0),
      votesByAccountAddress,
    );
  }, [votesByAccountAddress]);

  return { votesByAccountAddress, vwrCountByAccountAddress };
};

export const useRevoteCount = ({ start, end } = {}) => {
  const [revoteCountByAccountAddress, setRevoteCountByAccountAddress] =
    React.useState(null);

  useFetch(
    async ({ signal }) => {
      const fetchVotes = async ({ page = 1, pageSize = 1000 } = {}) => {
        const { votes } = await subgraphFetch({
          query: `{
          votes(
            orderBy: blockNumber,
            first: ${pageSize},
            skip: ${(page - 1) * pageSize}
            where: {
              ${[
                'reason_not: ""',
                start == null
                  ? ""
                  : `# blockTimestamp_gt: "${Math.floor(start.getTime() / 1000)}"`,
                end == null
                  ? ""
                  : `# blockTimestamp_lt: "${Math.floor(end.getTime() / 1000)}"`,
              ]
                .filter(Boolean)
                .join(",")}
            }
          ) {
            id
            proposal { id }
          }
        }`,
        });

        if (votes.length < pageSize) return votes;

        const remainingVotes = await fetchVotes({ page: page + 1, pageSize });

        return [...votes, ...remainingVotes];
      };

      const fetchProposalsVotes = async (
        proposalIds,
        { page = 1, pageSize = 1000 } = {},
      ) => {
        const { votes } = await subgraphFetch({
          query: `{
            votes(
              orderBy: blockNumber,
              first: ${pageSize},
              skip: ${(page - 1) * pageSize}
              where: {
                proposal_in: [${proposalIds.map((id) => `"${id}"`)}],
                reason_not: "",
              }
            ) {
              id
              reason
              supportDetailed
              votes
              voter { id }
              proposal { id }
            }
          }`,
        });

        if (votes.length < pageSize) return votes;

        const remainingVotes = await fetchProposalsVotes(proposalIds, {
          page: page + 1,
          pageSize,
        });

        return [...votes, ...remainingVotes];
      };

      // Potential revotes
      const votes = await fetchVotes();
      // Potential revote targets
      const sourceVotes = await fetchProposalsVotes(
        arrayUtils.unique(votes.map((v) => v.proposal.id)),
      );

      if (signal?.aborted) return;

      const sourceVotesById = arrayUtils.indexBy((v) => v.id, sourceVotes);
      const sourceVotesByProposalId = arrayUtils.groupBy(
        (v) => v.proposal.id,
        sourceVotes,
      );

      const revoteCountByAccountAddress = votes.reduce(
        (acc, { id: voteId }) => {
          const vote = sourceVotesById[voteId];

          if (
            // vote.votes === 0 ||
            vote.reason == null ||
            vote.reason.trim() === ""
          )
            return acc;

          const proposalVotes = sourceVotesByProposalId[vote.proposal.id];
          const proposalIndex = proposalVotes.indexOf(vote);
          const previousProposalVotes = proposalVotes.slice(0, proposalIndex);

          const extractReposts = createRepostExtractor(previousProposalVotes);

          const [revoteTargetVotes_] = extractReposts(vote.reason);

          const revoteTargetVotes = revoteTargetVotes_.filter(
            (targetVote) =>
              // Don’t count revotes that disagree with the revoter
              targetVote.supportDetailed === 2 ||
              targetVote.supportDetailed === vote.supportDetailed,
          );

          if (revoteTargetVotes.length === 0) return acc;
          const nextAcc = { ...acc };
          for (const v of revoteTargetVotes)
            nextAcc[v.voter.id] = (nextAcc[v.voter.id] ?? 0) + 1;
          return nextAcc;
        },
        {},
      );

      setRevoteCountByAccountAddress(revoteCountByAccountAddress);
    },
    [start, end],
  );

  return revoteCountByAccountAddress;
};

const BrowseAccountsScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const deferredQuery = React.useDeferredValue(query.trim());

  const accounts = useDelegates();
  const { address: treasuryAddress } = useContract("executor");
  const { address: forkEscrowAddress } = useContract("fork-escrow");

  const [sortStrategy, setSortStrategy] = React.useState("timeframe-revotes");
  const [sortOrder, setSortOrder] = React.useState("desc");
  const [localDateRange, setLocalDateRange] = React.useState(() => {
    const now = new Date();
    return {
      start: toLocalDate(new Date(now.getTime() - 30 * ONE_DAY_MILLIS)),
      end: toLocalDate(now),
    };
  });

  const { nameByAddress: primaryEnsNameByAddress } = useEnsCache();

  const deferredSortStrategy = React.useDeferredValue(sortStrategy);
  const deferredSortOrder = React.useDeferredValue(sortOrder);

  const dateRange = React.useMemo(
    () => ({
      start: localDateRange?.start.toDate() ?? null,
      end: localDateRange?.end.toDate() ?? null,
    }),
    [localDateRange],
  );

  const deferredDateRange = React.useDeferredValue(dateRange);

  const {
    votesByAccountAddress: timeframeVotesByAccountAddress,
    vwrCountByAccountAddress: timeframeVwrCountByAccountAddress,
  } = useVotes(dateRange);
  const timeframeRevoteCountByAccountAddress = useRevoteCount(dateRange);

  const matchingAddresses = React.useMemo(() => {
    if (deferredQuery.trim() === "") return null;
    return searchEns(primaryEnsNameByAddress, deferredQuery);
  }, [primaryEnsNameByAddress, deferredQuery]);

  const showPlaceholders = (() => {
    switch (deferredSortStrategy) {
      case "timeframe-votes-cast":
        return timeframeVotesByAccountAddress == null;
      case "timeframe-vwrs-cast":
        return timeframeVwrCountByAccountAddress == null;
      case "timeframe-revotes":
        return timeframeRevoteCountByAccountAddress == null;
      default:
        return false;
    }
  })();

  const sortedFilteredAccounts = React.useMemo(() => {
    if (showPlaceholders) return [];

    const accountsExcludingContracts = accounts.filter(
      (a) => a.id !== treasuryAddress && a.id !== forkEscrowAddress,
    );

    const sort = (accounts) => {
      const order = deferredSortOrder;
      const invertedOrder = order === "desc" ? "asc" : "desc";

      switch (deferredSortStrategy) {
        case "voting-power":
          return arrayUtils.sortBy(
            { value: (a) => a.nounsRepresented.length, order },
            { value: (a) => a.votes?.length ?? 0, order },
            accounts,
          );
        case "votes-cast":
          return arrayUtils.sortBy(
            { value: (a) => a.votes?.length ?? 0, order },
            { value: (a) => a.nounsRepresented.length, order },
            accounts,
          );
        case "vwrs-cast":
          return arrayUtils.sortBy(
            {
              value: (a) => {
                if (a.votes == null) return 0;

                const vwrCount = a.votes.reduce((sum, v) => {
                  if (v.reason == null || v.reason.trim() === "") return sum;
                  return sum + 1;
                }, 0);

                return vwrCount;
              },
              order,
            },
            {
              value: (a) => a.votes?.length ?? 0,
              order: invertedOrder,
            },
            { value: (a) => a.nounsRepresented.length, order },
            accounts,
          );
        case "timeframe-votes-cast":
          return arrayUtils.sortBy(
            {
              value: (a) =>
                (timeframeVotesByAccountAddress?.[a.id] ?? []).length,
              order,
            },
            {
              value: (a) => timeframeRevoteCountByAccountAddress?.[a.id] ?? 0,
              order,
            },
            { value: (a) => a.votes?.length ?? 0, order },
            accounts,
          );
        case "timeframe-vwrs-cast":
          return arrayUtils.sortBy(
            {
              value: (a) => timeframeVwrCountByAccountAddress?.[a.id] ?? 0,
              order,
            },
            accounts,
          );
        case "timeframe-revotes":
          return arrayUtils.sortBy(
            {
              value: (a) => timeframeRevoteCountByAccountAddress?.[a.id] ?? 0,
              order,
            },
            {
              value: (a) => {
                const recentVwrCount =
                  timeframeVwrCountByAccountAddress?.[a.id] ?? 0;
                if (recentVwrCount === 0) return Infinity;
                const recentVoteCount = (
                  timeframeVotesByAccountAddress?.[a.id] ?? []
                ).length;

                // Non-vwrs are worth less than vws
                return recentVwrCount + (recentVoteCount - recentVwrCount) * 2;
              },
              order: invertedOrder,
            },
            {
              value: (a) => {
                const recentVoteCount = (
                  timeframeVotesByAccountAddress?.[a.id] ?? []
                ).length;
                return recentVoteCount === 0 ? Infinity : recentVoteCount;
              },
              order: invertedOrder,
            },
            accounts,
          );
        default:
          throw new Error(`Invalid sort strategy: ${deferredSortStrategy}`);
      }
    };

    if (matchingAddresses == null) return sort(accountsExcludingContracts);

    const filteredAccounts = accountsExcludingContracts.filter((a) =>
      matchingAddresses.includes(a.id),
    );

    return sort(filteredAccounts);
  }, [
    accounts,
    treasuryAddress,
    forkEscrowAddress,
    deferredSortStrategy,
    deferredSortOrder,
    showPlaceholders,
    matchingAddresses,
    timeframeVotesByAccountAddress,
    timeframeVwrCountByAccountAddress,
    timeframeRevoteCountByAccountAddress,
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

  useDelegatesFetch({ includeZeroVotingPower: true, includeVotes: true });

  return (
    <>
      <Layout
        navigationStack={[{ to: "/voters", label: "Voters" }]}
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
          <MainContentContainer narrow>
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
                  flexWrap: "wrap",
                  gap: "1rem",
                  margin: "2rem 0 1.6rem",
                  "@media(min-width: 600px)": {
                    margin: "2.4rem 0",
                  },
                })}
              >
                <Select
                  size="small"
                  aria-label="Sort by"
                  inlineLabel="Sort by"
                  value={sortStrategy}
                  options={[
                    {
                      value: "timeframe-revotes",
                      label: "Most revoted",
                    },
                    {
                      value: "timeframe-votes-cast",
                      label: "Most votes cast",
                      inlineLabel: "Votes cast",
                    },
                    {
                      value: "timeframe-vwrs-cast",
                      label: "Most votes cast with reason",
                      inlineLabel: "Vwrs cast",
                    },
                    {
                      value: "votes-cast",
                      label: "Total votes cast",
                      inlineLabel: "Total votes",
                    },
                    {
                      value: "vwrs-cast",
                      label: "Total votes cast with reason",
                      inlineLabel: "Total vwrs",
                    },
                    {
                      value: "voting-power",
                      label: "Voting power",
                    },
                  ]}
                  onChange={(value) => {
                    setSortStrategy(value);
                    setSortOrder("desc");
                    const now = new Date();
                    setLocalDateRange({
                      start: toLocalDate(
                        new Date(now.getTime() - 30 * ONE_DAY_MILLIS),
                      ),
                      end: toLocalDate(now),
                    });
                  }}
                  fullWidth={false}
                  width="max-content"
                />
                <Select
                  size="small"
                  aria-label="Order"
                  value={sortOrder}
                  options={[
                    { value: "asc", label: "Ascending" },
                    { value: "desc", label: "Descending" },
                  ]}
                  onChange={(value) => {
                    setSortOrder(value);
                  }}
                  fullWidth={false}
                  width="max-content"
                  renderTriggerContent={(value, options) => (
                    <>
                      <span
                        css={css({
                          "@media(max-width: 440px)": { display: "none" },
                        })}
                      >
                        Order:{" "}
                      </span>
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

                {sortStrategy.startsWith("timeframe-") && (
                  <DateRangePicker
                    inlineLabel="Timeframe"
                    granularity="day"
                    size="small"
                    value={localDateRange}
                    onChange={(newLocalDateRange) => {
                      if (newLocalDateRange == null) {
                        setLocalDateRange(null);
                        return;
                      }

                      const { start, end } = newLocalDateRange;
                      setLocalDateRange({
                        start: toLocalDate(startOfDay(start.toDate())),
                        end: toLocalDate(endOfDay(end.toDate())),
                      });
                    }}
                  />
                )}
              </div>
              <div>
                <ProposalList
                  isLoading={
                    sortStrategy !== deferredSortStrategy ||
                    sortOrder !== deferredSortOrder ||
                    dateRange !== deferredDateRange
                  }
                  items={sortedFilteredAccounts}
                  getItemProps={(item) => {
                    switch (deferredSortStrategy) {
                      case "timeframe-votes-cast":
                      case "timeframe-vwrs-cast":
                      case "timeframe-revotes":
                        return {
                          votes:
                            timeframeVotesByAccountAddress?.[item.id] ?? null,
                          revoteCount:
                            timeframeRevoteCountByAccountAddress?.[item.id] ??
                            null,
                        };
                      default:
                        return undefined;
                    }
                  }}
                />
              </div>
            </div>
          </MainContentContainer>
        </div>
      </Layout>
    </>
  );
};

export default BrowseAccountsScreen;
