"use client";

import dateSubtractDays from "date-fns/subDays";
import dateStartOfDay from "date-fns/startOfDay";
import { formatEther } from "viem";
import React from "react";
import NextLink from "next/link";
import { css } from "@emotion/react";
import { useDebouncedCallback } from "use-debounce";
import { useFetch } from "@shades/common/react";
import { useCachedState } from "@shades/common/app";
import { array as arrayUtils, searchRecords } from "@shades/common/utils";
import Input from "@shades/ui-web/input";
import Button from "@shades/ui-web/button";
import Link from "@shades/ui-web/link";
import Select from "@shades/ui-web/select";
import * as Menu from "@shades/ui-web/dropdown-menu";
import { isNodeEmpty as isRichTextNodeEmpty } from "@shades/ui-web/rich-text-editor";
import {
  CaretDown as CaretDownIcon,
  Fullscreen as FullscreenIcon,
} from "@shades/ui-web/icons";
import { APPROXIMATE_BLOCKS_PER_DAY } from "../constants/ethereum.js";
import {
  isFinalState as isFinalProposalState,
  isSucceededState as isSucceededProposalState,
  isVotableState as isVotableProposalState,
} from "../utils/proposals.js";
import { search as searchEns } from "../utils/ens.js";
import {
  getSponsorSignatures as getCandidateSponsorSignatures,
  // getScore as getCandidateScore,
  getForYouGroup as getCandidateForYouGroup,
  makeUrlId as makeCandidateUrlId,
} from "../utils/candidates.js";
import useBlockNumber from "../hooks/block-number.js";
import { useSearchParams } from "../hooks/navigation.js";
import { useWallet } from "../hooks/wallet.js";
import useMatchDesktopLayout from "../hooks/match-desktop-layout.js";
import {
  useSubgraphFetch,
  useActions,
  useDelegates,
  useProposals,
  useProposalCandidates,
  useProposalUpdateCandidates,
  useEnsCache,
  useMainFeedItems,
} from "../store.js";
import { useCollection as useDrafts } from "../hooks/drafts.js";
import useTreasuryData from "../hooks/treasury-data.js";
import * as Tabs from "./tabs.js";
import Layout, { MainContentContainer } from "./layout.js";
import SectionedList from "./sectioned-list.js";
import { useVotes, useRevoteCount } from "./browse-accounts-screen.js";
import useEnsAddress from "@/hooks/ens-address.js";

const ActivityFeed = React.lazy(() => import("./activity-feed.js"));

const DIGEST_NEW_THRESHOLD_IN_DAYS = 3;
const DIGEST_ACTIVE_THRESHOLD_IN_DAYS = 5;

const BROWSE_LIST_PAGE_ITEM_COUNT = 20;

const sortProposalsByStartsSoon = (ps) =>
  arrayUtils.sortBy((p) => Number(p.startBlock), ps);

const sortProposalsByEndsSoon = (ps) =>
  arrayUtils.sortBy((p) => Number(p.objectionPeriodEndBlock ?? p.endBlock), ps);

const sortProposalsChrononological = (ps) =>
  arrayUtils.sortBy({ value: (p) => Number(p.startBlock), order: "asc" }, ps);

const sortProposalsReverseChrononological = (ps) =>
  arrayUtils.sortBy({ value: (p) => Number(p.startBlock), order: "desc" }, ps);

const sortCandidatesChronological = (cs) =>
  arrayUtils.sortBy((c) => c.createdTimestamp, cs);

const sortCandidatesReverseChronological = (cs) =>
  arrayUtils.sortBy({ value: (c) => c.createdTimestamp, order: "desc" }, cs);

// Note: Farcaster comments not taken into account
const sortCandidatesByLastActivity = (cs) =>
  arrayUtils.sortBy(
    {
      value: (c) =>
        Math.max(
          c.lastUpdatedTimestamp,
          ...(c.feedbackPosts?.map((p) => p.createdTimestamp) ?? []),
        ),
      order: "desc",
    },
    cs,
  );

const filterProposalUpdateCandidates = (
  proposalUpdateCandidates,
  { connectedAccountAddress },
) => {
  const hasSigned = (c) => {
    const signatures = getCandidateSponsorSignatures(c, {
      excludeInvalid: true,
      activeProposerIds: [],
    });
    return signatures.some(
      (s) => s.signer.id.toLowerCase() === connectedAccountAddress,
    );
  };

  // Include authored updates, as well as sponsored updates not yet signed
  return proposalUpdateCandidates.filter((c) => {
    if (c.latestVersion == null) return false;

    if (c.proposerId.toLowerCase() === connectedAccountAddress) return true;

    const isSponsor =
      c.targetProposal?.signers != null &&
      c.targetProposal.signers.some(
        (s) => s.id.toLowerCase() === connectedAccountAddress,
      );

    return isSponsor && !hasSigned(c);
  });
};

const createDigestSections = ({
  proposals,
  candidates,
  topics,
  proposalUpdateCandidates,
  connectedAccountAddress,
}) => {
  const activeThreshold = dateStartOfDay(
    dateSubtractDays(new Date(), DIGEST_ACTIVE_THRESHOLD_IN_DAYS),
  );
  const newThreshold = dateStartOfDay(
    dateSubtractDays(new Date(), DIGEST_NEW_THRESHOLD_IN_DAYS),
  );

  const proposalsBySection = arrayUtils.groupBy((p) => {
    if (["pending", "updatable"].includes(p.state)) return "proposals:new";
    if (isFinalProposalState(p.state) || isSucceededProposalState(p.state)) {
      const recentlyConcluded =
        p.endTimestamp != null && p.endTimestamp >= newThreshold;
      const recentlyCanceled =
        p.canceledTimestamp != null && p.canceledTimestamp >= newThreshold;
      if (recentlyConcluded || recentlyCanceled)
        return "proposals:recently-concluded";
      return "proposals:past";
    }
    if (
      isVotableProposalState(p.state) &&
      connectedAccountAddress != null &&
      p.votes != null &&
      !p.votes.some((v) => v.voterId === connectedAccountAddress)
    )
      return "proposals:awaiting-vote";
    return "proposals:ongoing";
  }, proposals);

  const candidatesBySection = arrayUtils.groupBy(
    (c) => {
      const forYouGroup = getCandidateForYouGroup(
        { connectedAccountAddress, activeThreshold, newThreshold },
        c,
      );
      const isTopic = c.latestVersion?.type === "topic";
      return `${isTopic ? "topics" : "candidates"}:${forYouGroup}`;
    },
    [...topics, ...candidates, ...proposalUpdateCandidates],
  );

  const itemsBySectionKey = { ...proposalsBySection, ...candidatesBySection };

  return [
    {
      key: "candidates:authored-proposal-update",
      title: "Your proposal updates",
      sort: sortCandidatesChronological,
    },
    {
      key: "candidates:sponsored-proposal-update-awaiting-signature",
      title: "Missing your signature",
      description:
        "Pending updates of sponsored proposals that you need to sign",
      sort: sortCandidatesChronological,
    },
    {
      key: "proposals:awaiting-vote",
      title: "Not yet voted",
      sort: sortProposalsByEndsSoon,
    },
    {
      key: "proposals:ongoing",
      title: "Ongoing proposals",
      description: "Currently voting",
      sort: sortProposalsByEndsSoon,
      truncationThreshold: 2,
    },
    {
      key: "proposals:new",
      title: "Upcoming proposals",
      // description: "Not yet open for voting",
      sort: sortProposalsByStartsSoon,
      truncationThreshold: 2,
    },
    {
      key: "topics:new",
      title: "New topics",
      description: "Created within the last 3 days",
      sort: sortCandidatesReverseChronological,
      truncationThreshold: 2,
    },
    {
      key: "topics:active",
      title: "Recently active topics",
      sort: sortCandidatesByLastActivity,
      truncationThreshold: 2,
    },
    {
      key: "candidates:new",
      title: "New candidates",
      description: "Created within the last 3 days",
      sort: sortCandidatesReverseChronological,
      truncationThreshold: 2,
    },
    {
      key: "candidates:active",
      title: "Recently active candidates",
      sort: sortCandidatesByLastActivity,
      truncationThreshold: 2,
    },
    {
      key: "proposals:recently-concluded",
      title: "Recently concluded proposals",
      sort: sortProposalsReverseChrononological,
      truncationThreshold: 8,
    },
  ].map(({ key, sort, ...sectionProps }) => {
    const items = itemsBySectionKey[key] ?? [];
    return {
      type: "section",
      key,
      children: sort(items),
      collapsible: true,
      ...sectionProps,
    };
  });
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

  const { address: connectedAccountAddress } = useWallet();

  const { nameByAddress: primaryEnsNameByAddress } = useEnsCache();

  const proposals_ = useProposals({ state: true });
  const candidates_ = useProposalCandidates({
    includeCanceled: false,
    includePromoted: false,
    includeProposalUpdates: false,
  });
  const proposalUpdateCandidates_ = useProposalUpdateCandidates({
    includeTargetProposal: true,
  });

  const { items: allProposalDrafts } = useDrafts();

  const [page, setPage] = React.useState(1);
  const [proposalSortStrategy, setProposalSortStrategy] = React.useState(
    "reverse-chronological",
  );
  const [candidateSortStrategy, setCandidateSortStrategy] =
    React.useState("activity");
  const [topicSortStrategy, setTopicSortStrategy] = React.useState("activity");
  const [voterSortStrategy, setVoterSortStrategy] =
    React.useState("recent-revotes");

  const [hasFetchedOnce, setHasFetchedOnce] = React.useState(
    hasFetchedBrowseDataOnce,
  );

  const treasuryData = useTreasuryData();

  const eagerMatchingEnsAddress = useEnsAddress(deferredQuery);
  const matchingEnsAddress = React.useDeferredValue(eagerMatchingEnsAddress);

  const proposals = React.useMemo(
    () => proposals_.filter((p) => p.startBlock != null),
    [proposals_],
  );
  const { candidates = [], topics = [] } = React.useMemo(
    () =>
      candidates_.reduce(
        (acc, c) => {
          if (c.latestVersion == null) return acc;
          return c.latestVersion?.type === "topic"
            ? { ...acc, topics: [...acc.topics, c] }
            : { ...acc, candidates: [...acc.candidates, c] };
        },
        { candidates: [], topics: [] },
      ),
    [candidates_],
  );
  const relevantProposalUpdateCandidates = React.useMemo(() => {
    return filterProposalUpdateCandidates(proposalUpdateCandidates_, {
      connectedAccountAddress,
    });
  }, [proposalUpdateCandidates_, connectedAccountAddress]);

  const proposalDrafts = React.useMemo(() => {
    if (allProposalDrafts == null) return [];
    return allProposalDrafts
      .filter((d) => {
        if (d.name.trim() !== "") return true;
        return d.body.some((n) => !isRichTextNodeEmpty(n, { trim: true }));
      })
      .map((d) => ({ ...d, type: "draft" }));
  }, [allProposalDrafts]);

  const searchResultItems = React.useMemo(() => {
    if (deferredQuery === "") return [];

    const matchingAddresses =
      deferredQuery.length >= 3
        ? searchEns(primaryEnsNameByAddress, deferredQuery)
        : [];

    const matchingRecords = searchRecords(
      [
        ...proposalDrafts.map((d) => ({
          type: "draft",
          data: d,
          tokens: [
            { value: d.id, exact: true },
            { value: d.proposerId, exact: true },
            { value: d.name },
          ],
          fallbackSortProperty: Infinity,
        })),
        ...proposals.map((p) => ({
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
        ...[...candidates, ...relevantProposalUpdateCandidates].map((c) => ({
          type: "candidate",
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
      ],
      [deferredQuery, ...matchingAddresses],
    );

    if (matchingEnsAddress != null) {
      matchingRecords.unshift({
        type: "account",
        data: { id: matchingEnsAddress },
      });
    } else {
      for (const address of matchingAddresses.toReversed()) {
        matchingRecords.unshift({
          type: "account",
          data: { id: address },
        });
      }
    }

    return matchingRecords.map((r) => r.data);
  }, [
    deferredQuery,
    matchingEnsAddress,
    proposals,
    candidates,
    relevantProposalUpdateCandidates,
    proposalDrafts,
    primaryEnsNameByAddress,
  ]);

  const paginate = (items) => {
    if (page == null) return items;
    return items.slice(0, BROWSE_LIST_PAGE_ITEM_COUNT * page);
  };

  const { fetchBrowseScreenData } = useActions();

  useFetch(async () => {
    await fetchBrowseScreenData({ first: 40 });
    setHasFetchedOnce(true);
    if (hasFetchedOnce) return;
    hasFetchedBrowseDataOnce = true;
    fetchBrowseScreenData({ skip: 40, first: 1000 });
  }, [fetchBrowseScreenData]);

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

  const defaultTabKey = isDesktopLayout ? "digest" : "activity";

  const listings = (
    <>
      <div ref={tabAnchorRef} />
      <Tabs.Root
        ref={tabContainerRef}
        aria-label="Listings tabs"
        selectedKey={searchParams.get("tab") ?? defaultTabKey}
        onSelectionChange={(key) => {
          const tabAnchorRect = tabAnchorRef.current?.getBoundingClientRect();
          const tabContainerRect =
            tabContainerRef.current?.getBoundingClientRect();

          if (tabContainerRect?.top > tabAnchorRect?.top)
            scrollContainerRef.current.scrollTo({
              top: tabAnchorRef.current.offsetTop - 42,
            });

          setSearchParams(
            (p) => {
              const newParams = new URLSearchParams(p);
              if (key === defaultTabKey) {
                newParams.delete("tab");
                return newParams;
              }
              newParams.set("tab", key);
              return newParams;
            },
            { replace: true },
          );
          setPage(1);
        }}
        css={(t) =>
          css({
            position: "sticky",
            top: 0,
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
        <Tabs.Item key="digest" title="Digest">
          <div css={css({ padding: "2rem 0" })}>
            <SectionedList
              cacheKey="landing-digest"
              forcePlaceholder={!hasFetchedOnce}
              items={(() => {
                const sections = createDigestSections({
                  connectedAccountAddress,
                  proposals,
                  candidates,
                  topics,
                  proposalUpdateCandidates: relevantProposalUpdateCandidates,
                });
                return sections
                  .filter(
                    ({ children }) => children != null && children.length !== 0,
                  )
                  .map((section, _, sections) => {
                    // Tweaking the title if necessary to make it more coherant
                    switch (section.key) {
                      case "topics:active": {
                        const hasNew = sections.some(
                          (s) => s.key === "topics:new",
                        );
                        return {
                          ...section,
                          title: hasNew ? "Other active topics" : section.title,
                        };
                      }

                      case "candidates:active": {
                        const hasNew = sections.some(
                          (s) => s.key === "candidates:new",
                        );
                        return {
                          ...section,
                          title: hasNew
                            ? "Other active candidates"
                            : section.title,
                        };
                      }

                      default:
                        return section;
                    }
                  });
              })()}
            />
          </div>
        </Tabs.Item>
        <Tabs.Item key="proposals" title="Proposals">
          <div
            css={css({
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.8rem",
              padding: "2rem 0",
            })}
          >
            <Select
              size="small"
              aria-label="Proposal sorting"
              value={proposalSortStrategy}
              options={[
                { value: "reverse-chronological", label: "Descending" },
                { value: "chronological", label: "Ascending" },
              ]}
              onChange={(value) => {
                setProposalSortStrategy(value);
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
            <Button
              component={NextLink}
              href="/proposals"
              prefetch
              size="small"
              variant="transparent"
              icon={
                <FullscreenIcon
                  style={{
                    width: "1.4rem",
                    height: "auto",
                    transform: "scaleX(-1)",
                  }}
                />
              }
            />
          </div>
          {(() => {
            const items =
              proposalSortStrategy === "chronological"
                ? sortProposalsChrononological(proposals)
                : sortProposalsReverseChrononological(proposals);

            const hasMoreItems =
              page != null && items.length > BROWSE_LIST_PAGE_ITEM_COUNT * page;

            return (
              <>
                <SectionedList
                  forcePlaceholder={!hasFetchedOnce}
                  items={[
                    {
                      key: "proposals",
                      type: "section",
                      children: paginate(items),
                    },
                  ]}
                />
                {hasMoreItems && (
                  <Pagination
                    showNext={() => setPage((p) => p + 1)}
                    showAll={() => setPage(null)}
                  />
                )}
              </>
            );
          })()}
        </Tabs.Item>
        {topics.length > 0 && (
          <Tabs.Item key="topics" title="Topics">
            <div
              css={css({
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.8rem",
                padding: "2rem 0",
              })}
            >
              <Select
                size="small"
                aria-label="Topic sorting"
                inlineLabel="Order"
                value={topicSortStrategy}
                options={[
                  { value: "activity", label: "By recent activity" },
                  { value: "reverse-chronological", label: "Chronological" },
                ]}
                onChange={(value) => {
                  setTopicSortStrategy(value);
                }}
                fullWidth={false}
                width="max-content"
              />
              <Button
                component={NextLink}
                href="/topics"
                prefetch
                size="small"
                variant="transparent"
                icon={
                  <FullscreenIcon
                    style={{
                      width: "1.4rem",
                      height: "auto",
                      transform: "scaleX(-1)",
                    }}
                  />
                }
              />
            </div>

            {(() => {
              const items =
                topicSortStrategy === "reverse-chronological"
                  ? sortCandidatesReverseChronological(topics)
                  : sortCandidatesByLastActivity(topics);
              const hasMoreItems =
                page != null &&
                items.length > BROWSE_LIST_PAGE_ITEM_COUNT * page;
              return (
                <>
                  <SectionedList
                    forcePlaceholder={!hasFetchedOnce}
                    showCandidateScore
                    items={[
                      {
                        key: "topics",
                        type: "section",
                        children: paginate(items),
                      },
                    ]}
                  />

                  {hasMoreItems && (
                    <Pagination
                      showNext={() => setPage((p) => p + 1)}
                      showAll={() => setPage(null)}
                    />
                  )}
                </>
              );
            })()}
          </Tabs.Item>
        )}
        <Tabs.Item key="candidates" title="Candidates">
          <div
            css={css({
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.8rem",
              padding: "2rem 0",
            })}
          >
            <Select
              size="small"
              aria-label="Candidate sorting"
              inlineLabel="Order"
              value={candidateSortStrategy}
              options={[
                { value: "activity", label: "By recent activity" },
                {
                  value: "reverse-chronological",
                  label: "Chronological",
                },
              ]}
              onChange={(value) => {
                setCandidateSortStrategy(value);
              }}
              fullWidth={false}
              width="max-content"
            />
            <Button
              component={NextLink}
              href="/candidates"
              prefetch
              size="small"
              variant="transparent"
              icon={
                <FullscreenIcon
                  style={{
                    width: "1.4rem",
                    height: "auto",
                    transform: "scaleX(-1)",
                  }}
                />
              }
            />
          </div>

          {(() => {
            const items =
              candidateSortStrategy === "reverse-chronological"
                ? sortCandidatesReverseChronological(candidates)
                : sortCandidatesByLastActivity(candidates);
            const hasMoreItems =
              page != null && items.length > BROWSE_LIST_PAGE_ITEM_COUNT * page;
            return (
              <>
                <SectionedList
                  forcePlaceholder={!hasFetchedOnce}
                  showCandidateScore
                  items={[
                    {
                      key: "candidates",
                      type: "section",
                      children: paginate(items),
                    },
                  ]}
                />

                {hasMoreItems && (
                  <Pagination
                    showNext={() => setPage((p) => p + 1)}
                    showAll={() => setPage(null)}
                  />
                )}
              </>
            );
          })()}
        </Tabs.Item>
        <Tabs.Item key="voters" title="Voters">
          <div
            css={css({
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.8rem",
              padding: "2rem 0",
            })}
          >
            <Select
              size="small"
              aria-label="Voter sorting"
              inlineLabel="Sort by"
              value={voterSortStrategy}
              options={[
                {
                  value: "recent-revotes",
                  label: "Most revoted (30 days)",
                },
                {
                  value: "recent-votes",
                  label: "Votes cast (30 days)",
                },
              ]}
              onChange={(value) => {
                setVoterSortStrategy(value);
              }}
              fullWidth={false}
              width="max-content"
            />
            <Button
              component={NextLink}
              href="/voters"
              prefetch
              size="small"
              variant="transparent"
              icon={
                <FullscreenIcon
                  style={{
                    width: "1.4rem",
                    height: "auto",
                    transform: "scaleX(-1)",
                  }}
                />
              }
            />
          </div>

          <VoterList sortStrategy={voterSortStrategy} />
        </Tabs.Item>
        {/* <Tabs.Item key="drafts" title="My drafts">
          <div css={css({ paddingTop: "2.4rem" })}>
            <DraftTabContent items={sectionsByName["drafts"]?.children} />
          </div>
        </Tabs.Item> */}
      </Tabs.Root>
    </>
  );

  return (
    <>
      <Layout
        scrollContainerRef={scrollContainerRef}
        actions={[
          // {
          //   label: "Propose",
          //   buttonProps: {
          //     component: NextLink,
          //     href: "/new",
          //     prefetch: true,
          //   },
          // },
          {
            type: "dropdown",
            label: "New",
            placement: "bottom start",
            items: [
              {
                id: "-",
                children: [
                  {
                    id: "new-proposal",
                    label: "Proposal",
                  },
                  {
                    id: "new-discussion-topic",
                    label: "Discussion topic",
                  },
                ],
              },
            ],
            buttonProps: {
              iconRight: (
                <CaretDownIcon style={{ width: "0.9rem", height: "auto" }} />
              ),
            },
          },
          treasuryData != null && {
            label: (
              <>
                <span data-desktop-only>Treasury </span>
                {"Ξ"}{" "}
                {Math.round(
                  parseFloat(formatEther(treasuryData.totals.allInEth)),
                ).toLocaleString()}
              </>
            ),
            buttonProps: {
              component: NextLink,
              href: (() => {
                const linkSearchParams = new URLSearchParams(searchParams);
                linkSearchParams.set("treasury", 1);
                return `?${linkSearchParams}`;
              })(),
              prefetch: true,
            },
          },
        ].filter(Boolean)}
      >
        <div css={css({ padding: "0 1.6rem" })}>
          <MainContentContainer
            sidebarWidth="44rem"
            sidebar={
              // No sidebar on small screens
              !isDesktopLayout ? null : (
                <div
                  css={css({
                    containerType: "inline-size",
                    padding: "0 0 3.2rem",
                    "@media (min-width: 600px)": {
                      padding: "4rem 0 2.8rem",
                    },
                  })}
                >
                  {listings}
                </div>
              )
            }
          >
            <div
              css={css({
                containerType: "inline-size",
                padding: "0 0 3.2rem",
                "@media (min-width: 600px)": {
                  padding: "4rem 0",
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
                    "@media (min-width: 600px)": {
                      marginBottom: "2.4rem",
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
                />
              </div>

              {deferredQuery !== "" ? (
                // Search results
                <div css={css({ marginTop: "2rem" })}>
                  <SectionedList
                    items={
                      page == null
                        ? searchResultItems
                        : searchResultItems.slice(
                            0,
                            BROWSE_LIST_PAGE_ITEM_COUNT * page,
                          )
                    }
                  />
                  {page != null &&
                    searchResultItems.length >
                      BROWSE_LIST_PAGE_ITEM_COUNT * page && (
                      <Pagination
                        showNext={() => setPage((p) => p + 1)}
                        showAll={() => setPage(null)}
                      />
                    )}
                </div>
              ) : isDesktopLayout ? (
                <div
                  css={css({ transition: "0.2s ease-out opacity" })}
                  style={{
                    // Hiding until the first fetch is done to avoid flickering
                    opacity: hasFetchedOnce ? 1 : 0,
                  }}
                >
                  <Feed />
                </div>
              ) : (
                <div css={css({ marginTop: "0.8rem" })}>{listings}</div>
              )}
            </div>
          </MainContentContainer>
        </div>
      </Layout>
    </>
  );
};

const FEED_PAGE_ITEM_COUNT = 30;

let hasFetchedActivityFeedOnce = false;

const useActivityFeedItems = ({ categories }) => {
  const { fetchNounsActivity } = useActions();

  const [hasFetchedOnce, setHasFetchedOnce] = React.useState(
    hasFetchedActivityFeedOnce,
  );

  const eagerLatestBlockNumber = useBlockNumber({
    watch: true,
    cacheTime: 10_000,
  });
  const latestBlockNumber = React.useDeferredValue(eagerLatestBlockNumber);

  // Fetch feed data
  useFetch(
    latestBlockNumber == null
      ? null
      : async () => {
          await fetchNounsActivity({
            startBlock:
              latestBlockNumber - BigInt(APPROXIMATE_BLOCKS_PER_DAY * 2),
            endBlock: latestBlockNumber,
          });

          if (hasFetchedOnce) return;

          setHasFetchedOnce(true);
          hasFetchedActivityFeedOnce = true;

          await fetchNounsActivity({
            startBlock:
              latestBlockNumber - BigInt(APPROXIMATE_BLOCKS_PER_DAY * 30),
            endBlock:
              latestBlockNumber - BigInt(APPROXIMATE_BLOCKS_PER_DAY * 2) - 1n,
          });
        },
    [latestBlockNumber, fetchNounsActivity],
  );

  return useMainFeedItems(categories, { enabled: hasFetchedOnce });
};

const TruncatedActivityFeed = ({ items }) => {
  const [page, setPage] = React.useState(2);
  const visibleItems = items.slice(0, FEED_PAGE_ITEM_COUNT * page);

  const allowItemActions = (item) =>
    ["vote", "feedback-post"].includes(item.type) &&
    item.reason != null &&
    item.reason.trim() !== "";

  const createItemOriginUrl = (item) => {
    if (item.proposalId != null) return `/proposals/${item.proposalId}`;

    const candidateUrlId = encodeURIComponent(
      makeCandidateUrlId(item.candidateId),
    );
    return `/candidates/${candidateUrlId}`;
  };

  return (
    <>
      <ActivityFeed
        items={visibleItems}
        createReplyHref={(item) => {
          if (!allowItemActions) return null;
          return `${createItemOriginUrl(item)}?${new URLSearchParams({
            tab: "activity",
            "reply-target": item.id,
          })}`;
        }}
        createRepostHref={(item) => {
          if (!allowItemActions) return null;
          return `${createItemOriginUrl(item)}?${new URLSearchParams({
            tab: "activity",
            "repost-target": item.id,
          })}`;
        }}
      />

      {items.length > visibleItems.length && (
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
};

const feedFilterCategoryItems = [
  {
    key: "proposals",
    title: "Proposal activity",
  },
  {
    key: "candidates",
    title: "Candidate activity",
  },
  {
    key: "noun-representation",
    title: "Delegations & transfers",
  },
  {
    key: "auction-excluding-bids",
    title: "Auction winners & settlements",
  },
  { key: "auction-bids", title: "Auction bids" },
  { key: "propdates", title: "Propdate posts" },
  { key: "flow-votes", title: "Flows activity" },
];
const defaultSelectedFeedFilterCategories = [
  "proposals",
  "candidates",
  "noun-representation",
  "auction-excluding-bids",
  // "auction-bids",
  "propdates",
];
const useFeedFilterCategories = () => {
  const [state, setState] = useCachedState(
    "landing-screen:selected-feed-categories",
    defaultSelectedFeedFilterCategories,
  );
  return [state ?? [], setState];
};

const Feed = React.memo(() => {
  const [selectedCategories, setSelectedCategories] = useFeedFilterCategories();
  const deferredSelectedCategories = React.useDeferredValue(selectedCategories);
  const feedItems = useActivityFeedItems({
    categories: deferredSelectedCategories,
  });

  return (
    <div css={css({ transition: "0.2s ease-out opacity" })}>
      <React.Suspense fallback={null}>
        <div css={css({ margin: "0 0 2rem" })}>
          <FeedFilterMenu
            selectedCategories={selectedCategories}
            setSelectedCategories={setSelectedCategories}
          />
        </div>

        <TruncatedActivityFeed items={feedItems} />
      </React.Suspense>
    </div>
  );
});

const FeedTabContent = React.memo(() => {
  const [selectedCategories, setSelectedCategories] = useFeedFilterCategories();
  const deferredSelectedCategories = React.useDeferredValue(selectedCategories);
  const feedItems = useActivityFeedItems({
    categories: deferredSelectedCategories,
  });

  return (
    <div css={css({ transition: "0.2s ease-out opacity", padding: "2rem 0" })}>
      <React.Suspense fallback={null}>
        <div css={css({ margin: "0 0 2.8rem" })}>
          <FeedFilterMenu
            selectedCategories={selectedCategories}
            setSelectedCategories={setSelectedCategories}
          />
        </div>

        <TruncatedActivityFeed items={feedItems} />
      </React.Suspense>
    </div>
  );
});

const VoterList = ({ sortStrategy }) => {
  const subgraphFetch = useSubgraphFetch();
  const accounts = useDelegates();

  const [page, setPage] = React.useState(1);
  const [dateRange] = React.useState(() => {
    const ONE_DAY_MILLIS = 24 * 60 * 60 * 1000;
    const now = new Date();
    return {
      start: new Date(now.getTime() - 30 * ONE_DAY_MILLIS),
      end: now,
    };
  });

  const { votesByAccountAddress, vwrCountByAccountAddress } =
    useVotes(dateRange);
  const revoteCountByAccountAddress = useRevoteCount(dateRange);

  const filteredSortedAccounts = React.useMemo(() => {
    switch (sortStrategy) {
      default:
      case "recent-revotes": {
        const filteredAccounts = accounts.filter((a) => {
          const revoteCount = revoteCountByAccountAddress?.[a.id] ?? 0;
          return revoteCount > 0;
        });
        return arrayUtils.sortBy(
          {
            value: (a) => revoteCountByAccountAddress?.[a.id] ?? 0,
            order: "desc",
          },
          {
            value: (a) => {
              const vwrCount = vwrCountByAccountAddress?.[a.id] ?? 0;
              if (vwrCount === 0) return Infinity;
              const voteCount = (votesByAccountAddress?.[a.id] ?? []).length;

              // Non-vwrs are worth less than vwrs
              return vwrCount + (voteCount - vwrCount) * 2;
            },
            order: "asc",
          },
          {
            value: (a) => {
              const voteCount = (votesByAccountAddress?.[a.id] ?? []).length;
              return voteCount === 0 ? Infinity : voteCount;
            },
            order: "asc",
          },
          filteredAccounts,
        );
      }

      case "recent-votes": {
        const filteredAccounts = accounts.filter((a) => {
          const votes = votesByAccountAddress?.[a.id] ?? [];
          return votes.length > 0;
        });
        return arrayUtils.sortBy(
          {
            value: (a) => (votesByAccountAddress?.[a.id] ?? []).length,
            order: "desc",
          },
          {
            value: (a) => revoteCountByAccountAddress?.[a.id] ?? 0,
            order: "desc",
          },
          {
            value: (a) => vwrCountByAccountAddress?.[a.id] ?? 0,
            order: "desc",
          },
          filteredAccounts,
        );
      }
    }
  }, [
    accounts,
    sortStrategy,
    votesByAccountAddress,
    revoteCountByAccountAddress,
    vwrCountByAccountAddress,
  ]);

  useFetch(() => {
    const dateRangeStart = Math.floor(dateRange.start.getTime() / 1000);
    return subgraphFetch({
      query: `{
        delegates(
          first: 1000,
          where: {
            votes_: {
              blockTimestamp_gt: "${dateRangeStart}"
            }
          }
        ) {
          id
          votes(first: 1000, orderBy: blockNumber, orderDirection: desc) {
            id
            blockNumber
            supportDetailed
            reason
          }
          nounsRepresented(first: 1000) {
            id
            seed {
              head
              glasses
              body
              background
              accessory
            }
            owner {
              id
              delegate { id }
            }
          }
        }
      }`,
    });
  }, [subgraphFetch, dateRange]);

  return (
    <>
      <SectionedList
        forcePlaceholder={revoteCountByAccountAddress == null}
        items={
          page != null
            ? filteredSortedAccounts.slice(
                0,
                BROWSE_LIST_PAGE_ITEM_COUNT * page,
              )
            : filteredSortedAccounts
        }
        getItemProps={(item) => ({
          votes: votesByAccountAddress?.[item.id] ?? null,
          revoteCount: revoteCountByAccountAddress?.[item.id] ?? null,
        })}
      />
      {page != null &&
        filteredSortedAccounts.length > BROWSE_LIST_PAGE_ITEM_COUNT * page && (
          <Pagination
            showNext={() => setPage((p) => p + 1)}
            showAll={() => setPage(null)}
          />
        )}
    </>
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
    <div style={{ marginTop: "1.2rem" }}>
      <Link size="small" component="button" variant="dimmed" onClick={showAll}>
        Show all
      </Link>
    </div>
  </div>
);

const FilterMenu = ({
  size,
  fullWidth,
  widthFollowTrigger,
  inlineLabel,
  items,
  selectedKeys,
  setSelectedKeys,
  renderTriggerContent,
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
        {(() => {
          if (renderTriggerContent != null) return renderTriggerContent();

          return (
            <span
              data-inline-label={inlineLabel != null}
              css={(t) =>
                css({
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
                const selectedItems = items.filter((i) =>
                  selectedKeys.has(i.key),
                );
                return selectedItems.map((i) => i.title).join(", ");
              })()}
            </span>
          );
        })()}
      </Button>
    </Menu.Trigger>
    <Menu.Content
      widthFollowTrigger={widthFollowTrigger}
      selectionMode="multiple"
      selectedKeys={selectedKeys}
      onSelectionChange={(keys) => {
        setSelectedKeys(keys);
      }}
    >
      {items.map((item) => (
        <Menu.Item key={item.key}>{item.title}</Menu.Item>
      ))}
    </Menu.Content>
  </Menu.Root>
);

const FeedFilterMenu = ({ selectedCategories, setSelectedCategories }) => (
  <FilterMenu
    size="small"
    selectedKeys={new Set(selectedCategories)}
    setSelectedKeys={(keys) => {
      setSelectedCategories([...keys]);
    }}
    items={feedFilterCategoryItems}
    renderTriggerContent={() => {
      if (
        selectedCategories.length === feedFilterCategoryItems.length ||
        selectedCategories.length === 0
      )
        return "Show everything";

      const { included = [], excluded = [] } = arrayUtils.groupBy(
        (i) => (selectedCategories.includes(i.key) ? "included" : "excluded"),
        feedFilterCategoryItems,
      );
      const stateExcludedItems = excluded.length < included.length;
      const items = stateExcludedItems ? excluded : included;
      return (
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
          {stateExcludedItems
            ? items.length === 1
              ? "Show: All except"
              : "Hide"
            : "Show:"}{" "}
          {items.map((item, i, items) => (
            <React.Fragment key={item.key}>
              {i > 0 && (
                <>
                  {items.length !== 2 && ","}{" "}
                  {i === items.length - 1 && <>and </>}
                </>
              )}
              <em>{item.title}</em>
            </React.Fragment>
          ))}
        </span>
      );
    }}
  />
);

export default BrowseScreen;
