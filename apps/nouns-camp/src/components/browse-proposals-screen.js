"use client";

import React from "react";
import { css } from "@emotion/react";
import NextLink from "next/link";
import { useDebouncedCallback } from "use-debounce";
import { array as arrayUtils, searchRecords } from "@shades/common/utils";
import { useFetch, ErrorBoundary } from "@shades/common/react";
import Input from "@shades/ui-web/input";
import Select from "@shades/ui-web/select";
import Switch from "@shades/ui-web/switch";
import {
  useSubgraphFetch,
  useEnsCache,
  useProposals,
  useProposal,
} from "../store.js";
import { search as searchEns } from "../utils/ens.js";
import { isFinalState as isFinalProposalState } from "../utils/proposals.js";
import { useSearchParams } from "../hooks/navigation.js";
import useApproximateBlockTimestampCalculator from "../hooks/approximate-block-timestamp-calculator.js";
import Layout, { MainContentContainer } from "./layout.js";
import DateRangePicker, { toLocalDate } from "./date-range-picker.js";
import ProposalStateTag from "./proposal-state-tag.js";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";
import FormattedNumber from "./formatted-number.js";
import { ProposalVotesTag, renderPropStatusText } from "./browse-screen.js";

const ProposalVotesDialog = React.lazy(
  () => import("./proposal-votes-dialog.js"),
);

const ONE_DAY_MILLIS = 24 * 60 * 60 * 1000;

const BrowseProposalsScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const deferredQuery = React.useDeferredValue(query.trim());

  const proposals = useProposals({ state: true });

  const [filter, setFilter] = React.useState("none");
  const [sortStrategy, setSortStrategy] = React.useState("chronological");
  const [sortOrder, setSortOrder] = React.useState("desc");
  const [localDateRange, setLocalDateRange] = React.useState(null);

  const votesOverviewDialogProposalId =
    searchParams.get("vote-overview") || null;

  const { nameByAddress: primaryEnsNameByAddress } = useEnsCache();

  const deferredSortStrategy = React.useDeferredValue(sortStrategy);
  const deferredSortOrder = React.useDeferredValue(sortOrder);
  const deferredFilter = React.useDeferredValue(filter);

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
      const baseFilterPredicate = (() => {
        switch (deferredFilter) {
          case "none":
            return null;
          case "final":
            return (p) => isFinalProposalState(p.state);
          default:
            throw new Error(`Invalid filter : ${deferredFilter}`);
        }
      })();

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
            return (p) => {
              const voteCount = p.forVotes + p.againstVotes + p.abstainVotes;
              return voteCount > 0;
            };
          case "chronological":
            return null;
          default:
            throw new Error(`Invalid sort strategy: ${deferredSortStrategy}`);
        }
      })();

      const predicates = [
        baseFilterPredicate,
        timeframePredicate,
        sortStrategyPredicate,
      ].filter(Boolean);

      if (predicates.length === 0) return proposals;

      return proposals.filter((p) =>
        predicates.every((predicate) => predicate(p)),
      );
    };

    const sort = (proposals) => {
      const order = deferredSortOrder;

      switch (deferredSortStrategy) {
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
            { value: (p) => p.forVotes + 1 / p.againstVotes, order },
            proposals,
          );
        case "against-votes":
          return arrayUtils.sortBy(
            { value: (p) => p.againstVotes + 1 / p.forVotes, order },
            proposals,
          );
        default:
          throw new Error(`Invalid sort strategy: ${deferredSortStrategy}`);
      }
    };

    if (deferredQuery.trim() === "") return sort(filter(proposals));

    const matchingRecords = searchRecords(
      proposals.map((p) => ({
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
    matchingAddresses,
    deferredQuery,
    deferredFilter,
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

  useFetch(() => {
    subgraphFetch({
      query: `{
        proposals(
          orderBy: createdBlock,
          orderDirection: desc,
          first: 1000
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
  }, [subgraphFetch]);

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
              </div>
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
                  margin: "2rem 0 1.6rem",
                  "@media(min-width: 600px)": {
                    margin: "2.4rem 0",
                  },
                })}
              >
                <div
                  css={css({ display: "flex", flexWrap: "wrap", gap: "1rem" })}
                >
                  {" "}
                  <Select
                    size="small"
                    aria-label="Sort by"
                    value={sortStrategy}
                    options={[
                      {
                        value: "chronological",
                        label: "Chronological",
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
                          {selectedOption.value === "chronological"
                            ? "Order"
                            : "Sort by"}
                          :{" "}
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
                    )}
                  />
                  <DateRangePicker
                    inlineLabel="Timeframe"
                    granularity="day"
                    size="small"
                    value={localDateRange}
                    onChange={setLocalDateRange}
                  />
                </div>
              </div>
              <div>
                <ul
                  data-loading={
                    sortStrategy !== deferredSortStrategy ||
                    sortOrder !== deferredSortOrder ||
                    dateRange !== deferredDateRange
                  }
                  css={(t) => {
                    const hoverColor = t.colors.backgroundModifierNormal;
                    return css({
                      listStyle: "none",
                      lineHeight: 1.25,
                      transition: "filter 0.1s ease-out, opacity 0.1s ease-out",
                      containerType: "inline-size",
                      '&[data-loading="true"]': {
                        opacity: 0.5,
                        filter: "saturate(0)",
                      },
                      "& > li": {
                        position: "relative",
                        ".link": {
                          position: "absolute",
                          inset: 0,
                        },
                        ".item-container": {
                          pointerEvents: "none",
                          position: "relative",
                          padding: "0.8rem 0",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.1rem",
                        },
                        ".title-status-container": {
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.2rem",
                        },
                        ".header, .status-text": {
                          color: t.colors.textDimmed,
                          fontSize: t.text.sizes.small,
                        },
                        ".title": {
                          fontWeight: t.text.weights.smallHeader,
                          lineHeight: 1.3,
                        },
                        ".status-container": {
                          display: "flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          padding: "0.1rem 0",
                        },
                        "@container(min-width: 540px)": {
                          ".title-status-container": {
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "0.8rem",
                          },
                          ".status-container": {
                            flexDirection: "row-reverse",
                            "[data-state-tag]": { minWidth: "7.2em" },
                          },
                        },
                      },
                      // Hover enhancement
                      "@media(hover: hover)": {
                        "& > li .link": { cursor: "pointer" },
                        "& > li .link:hover": {
                          background: `linear-gradient(90deg, transparent 0%, ${hoverColor} 20%, ${hoverColor} 80%, transparent 100%)`,
                        },
                      },
                    });
                  }}
                >
                  {sortedFilteredProposals.map((proposal) => (
                    <li key={proposal.id}>
                      <ProposalItem
                        proposalId={proposal.id}
                        sortStrategy={deferredSortStrategy}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </MainContentContainer>
        </div>
      </Layout>

      {votesOverviewDialogProposalId != null && (
        <ErrorBoundary fallback={null}>
          <React.Suspense fallback={null}>
            <ProposalVotesDialog
              proposalId={votesOverviewDialogProposalId}
              isOpen
              close={() => {
                setSearchParams(
                  (p) => {
                    const newParams = new URLSearchParams(p);
                    newParams.delete("vote-overview");
                    return newParams;
                  },
                  { replace: true },
                );
              }}
            />
          </React.Suspense>
        </ErrorBoundary>
      )}
    </>
  );
};

const ProposalItem = React.memo(({ proposalId, sortStrategy }) => {
  const proposal = useProposal(proposalId, { watch: false });
  const calculateBlockTimestamp = useApproximateBlockTimestampCalculator();

  const statusText = (() => {
    const baseStatusText = renderPropStatusText({
      proposal,
      calculateBlockTimestamp,
    });

    const voteCount =
      proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
    if (sortStrategy === "token-turnout")
      return (
        <>
          {baseStatusText} &middot;{" "}
          <FormattedNumber
            value={voteCount / proposal.adjustedTotalSupply}
            style="percent"
            maximumFractionDigits={1}
          />{" "}
          turnout
        </>
      );

    if (sortStrategy === "for-votes")
      return (
        <>
          {baseStatusText} &middot;{" "}
          <FormattedNumber
            value={proposal.forVotes / voteCount}
            style="percent"
            maximumFractionDigits={1}
          />{" "}
          of votes in favor
        </>
      );

    if (sortStrategy === "against-votes")
      return (
        <>
          {baseStatusText} &middot;{" "}
          <FormattedNumber
            value={proposal.againstVotes / voteCount}
            style="percent"
            maximumFractionDigits={1}
          />{" "}
          of votes opposed
        </>
      );

    return baseStatusText;
  })();

  const showVoteStatus = !["pending", "updatable"].includes(proposal.state);

  const isDimmed =
    proposal.state != null && ["canceled", "expired"].includes(proposal.state);

  return (
    <>
      <NextLink
        className="link"
        prefetch
        href={`/proposals/${proposalId}`}
        data-dimmed={isDimmed}
      />
      <div className="item-container">
        <div className="header">
          Prop {proposalId} by{" "}
          <em
            css={(t) =>
              css({
                pointerEvents: "all",
                fontWeight: t.text.weights.emphasis,
                fontStyle: "normal",
              })
            }
          >
            {proposal.proposerId == null ? (
              "..."
            ) : (
              <AccountPreviewPopoverTrigger
                accountAddress={proposal.proposerId}
              />
            )}
          </em>
          {proposal.signers != null && proposal.signers.length > 0 && (
            <>
              , sponsored by{" "}
              {proposal.signers.map((signer, i) => (
                <React.Fragment key={signer.id}>
                  {i > 0 && <>, </>}
                  <em
                    css={(t) =>
                      css({
                        pointerEvents: "all",
                        fontWeight: t.text.weights.emphasis,
                        fontStyle: "normal",
                      })
                    }
                  >
                    <AccountPreviewPopoverTrigger accountAddress={signer.id} />
                  </em>
                </React.Fragment>
              ))}
            </>
          )}
        </div>
        <div className="title-status-container">
          <div className="title">
            {proposal.title === null ? "Untitled" : proposal.title}
          </div>
          <div className="status-container">
            <ProposalStateTag data-state-tag proposalId={proposalId} />
            {showVoteStatus && <ProposalVotesTag proposalId={proposalId} />}
          </div>
        </div>
        {statusText != null && (
          <div className="status-text" style={{ padding: "0 0.1rem" }}>
            {statusText}
          </div>
        )}
      </div>
    </>
  );
});

export default BrowseProposalsScreen;
