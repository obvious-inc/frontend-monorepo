"use client";

import startOfDay from "date-fns/startOfDay";
import endOfDay from "date-fns/endOfDay";
import React from "react";
import { css } from "@emotion/react";
import NextLink from "next/link";
import { useDebouncedCallback } from "use-debounce";
import {
  ethereum as ethereumUtils,
  array as arrayUtils,
  object as objectUtils,
} from "@shades/common/utils";
import { useFetch, useIsOnScreen } from "@shades/common/react";
import { DotsHorizontal as DotsHorizontalIcon } from "@shades/ui-web/icons";
import * as DropdownMenu from "@shades/ui-web/dropdown-menu";
import Input from "@shades/ui-web/input";
import Button from "@shades/ui-web/button";
import Select from "@shades/ui-web/select";
import {
  useDelegatesFetch,
  useDelegates,
  useDelegate,
  useAccount,
  useEnsCache,
} from "../store.js";
import { subgraphFetch } from "../nouns-subgraph.js";
import { createRepostExtractor } from "../utils/votes-and-feedbacks.js";
import { useSearchParams } from "../hooks/navigation.js";
import { useWallet } from "../hooks/wallet.js";
import { useDialog } from "../hooks/global-dialogs.js";
import useContract from "../hooks/contract.js";
import useEnsName from "../hooks/ens-name.js";
import Layout, { MainContentContainer } from "./layout.js";
import AccountAvatar from "./account-avatar.js";
import DateRangePicker, { toLocalDate } from "./date-range-picker.js";
import { VotesTagGroup } from "./browse-screen.js";

const ONE_DAY_MILLIS = 24 * 60 * 60 * 1000;

const isDebugSession =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("debug") != null;

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

const useRecentVotes = ({ start, end } = {}) => {
  const [votesByAccountAddress, setVotesByAccountAddress] =
    React.useState(null);

  useFetch(async () => {
    const fetchVotes = async ({ page = 1, pageSize = 1000 } = {}) => {
      const { votes } = await subgraphFetch({
        query: `{
          votes (
            orderBy: blockNumber,
            first: ${pageSize},
            skip: ${(page - 1) * pageSize}
            where: {
              blockTimestamp_gt: "${Math.floor(start.getTime() / 1000)}",
              blockTimestamp_lt: "${Math.floor(end.getTime() / 1000)}"
            }
          ) {
            supportDetailed
            reason
            voter {
              id
            }
          }
        }`,
      });

      if (votes.length < pageSize) return votes;

      const remainingVotes = await fetchVotes({ page: page + 1, pageSize });

      return [...votes, ...remainingVotes];
    };

    const votes = await fetchVotes();

    const votesByAccountAddress = votes.reduce((acc, v) => {
      return { ...acc, [v.voter.id]: [...(acc[v.voter.id] ?? []), v] };
    }, {});

    setVotesByAccountAddress(votesByAccountAddress);
  }, [start, end]);

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

const useRecentRevoteCount = ({ start, end } = {}) => {
  const [revoteCountByAccountAddress, setRevoteCountByAccountAddress] =
    React.useState(null);

  useFetch(async () => {
    const fetchVotes = async ({ page = 1, pageSize = 1000 } = {}) => {
      const { votes } = await subgraphFetch({
        query: `{
          votes(
            orderBy: blockNumber,
            first: ${pageSize},
            skip: ${(page - 1) * pageSize}
            where: {
              reason_not: "",
              blockTimestamp_gt: "${Math.floor(start.getTime() / 1000)}",
              blockTimestamp_lt: "${Math.floor(end.getTime() / 1000)}"
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

    const sourceVotesById = arrayUtils.indexBy((v) => v.id, sourceVotes);
    const sourceVotesByProposalId = arrayUtils.groupBy(
      (v) => v.proposal.id,
      sourceVotes,
    );

    const revoteCountByAccountAddress = votes.reduce((acc, { id: voteId }) => {
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
    }, {});

    setRevoteCountByAccountAddress(revoteCountByAccountAddress);
  }, [start, end]);

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
      start: localDateRange.start.toDate(),
      end: localDateRange.end.toDate(),
    }),
    [localDateRange],
  );

  const {
    votesByAccountAddress: recentVotesByAccountAddress,
    vwrCountByAccountAddress: recentVwrCountByAccountAddress,
  } = useRecentVotes(dateRange);
  const recentRevoteCountByAccountAddress = useRecentRevoteCount(dateRange);

  const matchingAddresses = React.useMemo(() => {
    if (deferredQuery.trim() === "") return null;
    return searchEns(primaryEnsNameByAddress, deferredQuery);
  }, [primaryEnsNameByAddress, deferredQuery]);

  const sortedFilteredAccounts = React.useMemo(() => {
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
              value: (a) => (recentVotesByAccountAddress?.[a.id] ?? []).length,
              order,
            },
            {
              value: (a) => recentRevoteCountByAccountAddress?.[a.id] ?? 0,
              order,
            },
            { value: (a) => a.votes?.length ?? 0, order },
            accounts,
          );
        case "timeframe-vwrs-cast":
          return arrayUtils.sortBy(
            {
              value: (a) => recentVwrCountByAccountAddress?.[a.id] ?? 0,
              order,
            },
            accounts,
          );
        case "timeframe-revotes":
          return arrayUtils.sortBy(
            {
              value: (a) => recentRevoteCountByAccountAddress?.[a.id] ?? 0,
              order,
            },
            {
              value: (a) => {
                const recentVwrCount =
                  recentVwrCountByAccountAddress?.[a.id] ?? 0;
                if (recentVwrCount === 0) return Infinity;
                const recentVoteCount = (
                  recentVotesByAccountAddress?.[a.id] ?? []
                ).length;

                // Non-vwrs are worth less than vws
                return recentVwrCount + (recentVoteCount - recentVwrCount) * 2;
              },
              order: invertedOrder,
            },
            {
              value: (a) => {
                const recentVoteCount = (
                  recentVotesByAccountAddress?.[a.id] ?? []
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

    if (
      deferredSortStrategy === "timeframe-votes-cast" &&
      recentVotesByAccountAddress == null
    )
      return []; // Loading
    if (
      deferredSortStrategy === "timeframe-vwrs-cast" &&
      recentVwrCountByAccountAddress == null
    )
      return []; // Loading
    if (
      deferredSortStrategy === "timeframe-revotes" &&
      recentRevoteCountByAccountAddress == null
    )
      return []; // Loading

    if (matchingAddresses == null) return sort(accountsExcludingContracts);

    const filteredAccounts = accountsExcludingContracts.filter((a) =>
      matchingAddresses.includes(a.id),
    );

    return sort(filteredAccounts);
  }, [
    matchingAddresses,
    deferredSortStrategy,
    deferredSortOrder,
    accounts,
    treasuryAddress,
    forkEscrowAddress,
    recentVotesByAccountAddress,
    recentVwrCountByAccountAddress,
    recentRevoteCountByAccountAddress,
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
                  css={css({
                    flex: 1,
                    minWidth: 0,
                  })}
                />
              </div>
              <div
                css={css({
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "1rem",
                  margin: "2rem 0 1.6rem",
                  "@media(min-width: 600px": {
                    margin: "2.4rem 0 1.6rem",
                  },
                })}
              >
                <Select
                  size="small"
                  aria-label="Sort by"
                  value={sortStrategy}
                  options={[
                    {
                      value: "timeframe-revotes",
                      label: "Most revoted (last 30 days)",
                      shortLabel: "Recent revotes",
                    },
                    {
                      value: "timeframe-votes-cast",
                      label: "Recent votes cast (last 30 days)",
                      shortLabel: "Recent votes",
                    },
                    {
                      value: "timeframe-vwrs-cast",
                      label: "Recent votes cast with reason (last 30 days)",
                      shortLabel: "Recent vwrs",
                    },
                    {
                      value: "votes-cast",
                      label: "Total votes cast",
                      shortLabel: "Votes cast",
                    },
                    {
                      value: "vwrs-cast",
                      label: "Total votes cast with reason",
                      shortLabel: "Vwrs cast",
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
                  renderTriggerContent={(value, options) => {
                    const selectedOption = options.find(
                      (o) => o.value === value,
                    );
                    return (
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
                          {selectedOption.shortLabel ?? selectedOption.label}
                        </em>
                      </>
                    );
                  }}
                />
                <Select
                  size="small"
                  aria-label="Order"
                  value={sortOrder}
                  options={[
                    {
                      value: "asc",
                      label: "Ascending",
                    },
                    {
                      value: "desc",
                      label: "Descending",
                    },
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
                    onChange={({ start, end }) => {
                      setLocalDateRange({
                        start: toLocalDate(startOfDay(start.toDate())),
                        end: toLocalDate(endOfDay(end.toDate())),
                      });
                    }}
                  />
                )}
              </div>
              <div>
                <ul
                  data-loading={sortStrategy !== deferredSortStrategy}
                  css={(t) => {
                    const hoverColor = t.colors.backgroundModifierNormal;
                    return css({
                      listStyle: "none",
                      lineHeight: 1.25,
                      transition: "filter 0.1s ease-out, opacity 0.1s ease-out",
                      ".dimmed": { color: t.colors.textDimmed },
                      ".small": { fontSize: t.text.sizes.small },
                      '&[data-loading="true"]': {
                        opacity: 0.5,
                        filter: "saturate(0)",
                      },
                      "& > li": {
                        position: "relative",
                        ".account-link": {
                          position: "absolute",
                          inset: 0,
                        },
                        ".container": {
                          pointerEvents: "none",
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          gap: "1.2rem",
                          padding: "1.2rem 0",
                        },
                        ".content-container": {
                          flex: 1,
                          minWidth: 0,
                          display: "grid",
                          gridTemplateColumns: "minmax(0,1fr) auto auto",
                          alignItems: "center",
                          gap: "1.2rem",
                        },
                        ".dots-button": {
                          pointerEvents: "all",
                        },
                        ".display-name": {
                          fontWeight: t.text.weights.emphasis,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        },
                        ".avatar-placeholder": {
                          width: "3.6rem",
                          height: "3.6rem",
                        },
                        ".nowrap": { whiteSpace: "nowrap" },
                        "@media(max-width: 600px)": {
                          ".content-container": {
                            gridTemplateColumns: "minmax(0,1fr) auto",
                          },
                          ".votes-tag-group-container": {
                            display: "none",
                          },
                        },
                      },
                      // Hover enhancement
                      "@media(hover: hover)": {
                        "& > li": { cursor: "pointer" },
                        "& > li:hover": {
                          background: `linear-gradient(90deg, transparent 0%, ${hoverColor} 20%, ${hoverColor} 80%, transparent 100%)`,
                        },
                      },
                    });
                  }}
                >
                  {sortedFilteredAccounts.map((account) => (
                    <li key={account.id}>
                      <AccountListItem
                        address={account.id}
                        sortStrategy={sortStrategy}
                        recentVotes={
                          recentVotesByAccountAddress?.[account.id] ?? []
                        }
                        recentVwrCount={
                          recentVwrCountByAccountAddress?.[account.id] ?? 0
                        }
                        recentRevoteCount={
                          recentRevoteCountByAccountAddress?.[account.id] ?? 0
                        }
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </MainContentContainer>
        </div>
      </Layout>
    </>
  );
};

const AccountListItem = React.memo(
  ({
    address: accountAddress,
    sortStrategy,
    recentVotes,
    recentVwrCount,
    recentRevoteCount,
  }) => {
    const containerRef = React.useRef();
    const hasBeenOnScreenRef = React.useRef(false);

    const { address: connectedAccountAddress } = useWallet();
    const connectedAccount = useAccount(connectedAccountAddress);
    const isOnScreen = useIsOnScreen(containerRef);

    React.useEffect(() => {
      if (isOnScreen) hasBeenOnScreenRef.current = true;
    });

    const hasBeenOnScreen = isOnScreen ?? hasBeenOnScreenRef.current;

    const isMe = accountAddress.toLowerCase() === connectedAccountAddress;
    const enableImpersonation = !isMe && isDebugSession;
    const enableDelegation = connectedAccount?.nouns?.length > 0;

    const delegate = useDelegate(accountAddress);
    const ensName = useEnsName(accountAddress, {
      enabled: hasBeenOnScreen,
    });
    const truncatedAddress = ethereumUtils.truncateAddress(accountAddress);
    const displayName = ensName ?? truncatedAddress;
    const votingPower = delegate?.nounsRepresented.length;

    const { open: openDelegationDialog } = useDialog("delegation");

    const hasDisplayName = displayName !== truncatedAddress;

    return (
      <>
        <NextLink
          className="account-link"
          href={`/voters/${ensName ?? accountAddress}`}
        />
        <div className="container" ref={containerRef}>
          {isOnScreen ? (
            <AccountAvatar size="3.6rem" address={accountAddress} />
          ) : (
            <div className="avatar-placeholder" />
          )}
          <div className="content-container">
            <div>
              <div className="display-name">
                {displayName} {votingPower != null && <>({votingPower})</>}
              </div>
              <span className="small dimmed">
                {hasDisplayName && truncatedAddress}
                {[
                  {
                    key: "votes",
                    element: (() => {
                      if (sortStrategy.startsWith("timeframe"))
                        return (
                          <>
                            {recentVotes.length} recent{" "}
                            {recentVotes.length === 1 ? "vote" : "votes"}{" "}
                            <span className="nowrap">
                              ({recentVwrCount}{" "}
                              {recentVwrCount === 1 ? "vwr" : "vwrs"})
                            </span>
                          </>
                        );

                      if (delegate?.votes == null) return null;

                      const vwrCount = delegate.votes.reduce((sum, v) => {
                        if (v.reason == null || v.reason.trim() === "")
                          return sum;
                        return sum + 1;
                      }, 0);

                      return (
                        <>
                          <span className="nowrap">
                            {delegate.votes.length}{" "}
                            {delegate.votes.length === 1 ? "vote" : "votes"}
                          </span>{" "}
                          <span className="nowrap">
                            ({vwrCount} {vwrCount === 1 ? "vwr" : "vwrs"})
                          </span>
                        </>
                      );
                    })(),
                  },
                  {
                    key: "revotes",
                    element: sortStrategy.startsWith("timeframe") && (
                      <span className="nowrap">
                        {recentRevoteCount}{" "}
                        {recentRevoteCount === 1 ? "revote" : "revotes"}
                      </span>
                    ),
                  },
                ]
                  .filter(({ element }) => Boolean(element))
                  .map(({ key, element }, i) => (
                    <React.Fragment key={key}>
                      {i !== 0 ? (
                        <>, </>
                      ) : hasDisplayName ? (
                        <> {"\u00B7"} </>
                      ) : null}
                      {element}
                    </React.Fragment>
                  ))}
              </span>
            </div>
            {isOnScreen && (
              <>
                <div className="votes-tag-group-container">
                  {sortStrategy.startsWith("timeframe") ? (
                    <DelegateVotesTagGroup votes={recentVotes} />
                  ) : delegate?.votes == null ? (
                    <div />
                  ) : delegate.votes.length > 0 ? (
                    <DelegateVotesTagGroup votes={delegate?.votes} />
                  ) : (
                    <div className="small dimmed">No votes</div>
                  )}
                </div>
                <DropdownMenu.Root
                  placement="bottom end"
                  offset={18}
                  crossOffset={5}
                >
                  <DropdownMenu.Trigger asChild>
                    <Button
                      variant="transparent"
                      size="small"
                      icon={
                        <DotsHorizontalIcon
                          style={{ width: "1.8rem", height: "auto" }}
                        />
                      }
                      style={{ pointerEvents: "all" }}
                    />
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    css={css({
                      width: "min-content",
                      minWidth: "min-content",
                      maxWidth: "calc(100vw - 2rem)",
                    })}
                    items={[
                      {
                        id: "main",
                        children: [
                          !enableDelegation
                            ? null
                            : isMe
                              ? {
                                  id: "manage-delegation",
                                  label: "Manage delegation",
                                }
                              : {
                                  id: "delegate-to-account",
                                  label: "Delegate to this account",
                                },
                          {
                            id: "copy-account-address",
                            label: "Copy account address",
                          },
                          enableImpersonation && {
                            id: "impersonate-account",
                            label: "Impersonate account",
                          },
                        ].filter(Boolean),
                      },
                      {
                        id: "external",
                        children: [
                          {
                            id: "open-etherscan",
                            label: "Etherscan",
                          },
                          {
                            id: "open-mogu",
                            label: "Mogu",
                          },
                          {
                            id: "open-agora",
                            label: "Agora",
                          },
                          {
                            id: "open-nounskarma",
                            label: "NounsKarma",
                          },
                          {
                            id: "open-rainbow",
                            label: "Rainbow",
                          },
                        ],
                      },
                    ]}
                    onAction={(key) => {
                      switch (key) {
                        case "manage-delegation":
                          openDelegationDialog();
                          close();
                          break;

                        case "delegate-to-account":
                          openDelegationDialog({ target: accountAddress });
                          close();
                          break;

                        case "copy-account-address":
                          navigator.clipboard.writeText(
                            accountAddress.toLowerCase(),
                          );
                          close();
                          break;

                        case "impersonate-account": {
                          const searchParams = new URLSearchParams(
                            location.search,
                          );
                          searchParams.set("impersonate", accountAddress);
                          location.replace(
                            `${location.pathname}?${searchParams}`,
                          );
                          close();
                          break;
                        }

                        case "open-etherscan":
                          window.open(
                            `https://etherscan.io/address/${accountAddress}`,
                            "_blank",
                          );
                          break;

                        case "open-mogu":
                          window.open(
                            `https://mmmogu.com/address/${accountAddress}`,
                            "_blank",
                          );
                          break;

                        case "open-agora":
                          window.open(
                            `https://nounsagora.com/delegate/${accountAddress}`,
                            "_blank",
                          );
                          break;

                        case "open-nounskarma":
                          window.open(
                            `https://nounskarma.xyz/player/${accountAddress}`,
                            "_blank",
                          );
                          break;

                        case "open-rainbow":
                          window.open(
                            `https://rainbow.me/${accountAddress}`,
                            "_blank",
                          );
                          break;
                      }
                    }}
                  >
                    {(item) => (
                      <DropdownMenu.Section items={item.children}>
                        {(item) => (
                          <DropdownMenu.Item>{item.label}</DropdownMenu.Item>
                        )}
                      </DropdownMenu.Section>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </>
            )}
          </div>
        </div>
      </>
    );
  },
);

const DelegateVotesTagGroup = ({ votes }) => {
  const [forVotes, againstVotes, abstainVotes] = votes.reduce(
    ([for_, against, abstain], vote) => {
      switch (vote.support ?? vote.supportDetailed) {
        case 0:
          return [for_, against + 1, abstain];
        case 1:
          return [for_ + 1, against, abstain];
        case 2:
          return [for_, against, abstain + 1];
        default:
          return [for_, against, abstain];
      }
    },
    [0, 0, 0],
  );

  return (
    <VotesTagGroup
      for={forVotes}
      against={againstVotes}
      abstain={abstainVotes}
    />
  );
};

export default BrowseAccountsScreen;
