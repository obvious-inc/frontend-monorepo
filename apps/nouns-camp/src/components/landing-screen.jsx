"use client";

import dateSubtractDays from "date-fns/subDays";
import dateStartOfDay from "date-fns/startOfDay";

import React from "react";
import NextLink from "next/link";
import { css } from "@emotion/react";
import { useFetch } from "@shades/common/react";
import { useCachedState } from "@shades/common/app";
import { array as arrayUtils } from "@shades/common/utils";
import Button from "@shades/ui-web/button";
import Link from "@shades/ui-web/link";
import Select from "@shades/ui-web/select";
import * as Menu from "@shades/ui-web/dropdown-menu";
import {
  CaretDown as CaretDownIcon,
  Fullscreen as FullscreenIcon,
} from "@shades/ui-web/icons";
import { APPROXIMATE_BLOCKS_PER_DAY } from "@/constants/ethereum";
import {
  isFinalState as isFinalProposalState,
  isSucceededState as isSucceededProposalState,
  isVotableState as isVotableProposalState,
} from "@/utils/proposals";
import {
  getSponsorSignatures as getCandidateSponsorSignatures,
  // getScore as getCandidateScore,
  getForYouGroup as getCandidateForYouGroup,
  makeUrlId as makeCandidateUrlId,
} from "@/utils/candidates";
import useBlockNumber from "@/hooks/block-number";
import { useSearchParams } from "@/hooks/navigation";
import { useWallet } from "@/hooks/wallet";
import useMatchDesktopLayout from "@/hooks/match-desktop-layout";
import {
  useSubgraphFetch,
  useActions,
  useDelegates,
  useProposals,
  useProposalCandidates,
  useProposalUpdateCandidates,
  useMainFeedItems,
} from "@/store";
import { useCommandPalette } from "@/components/command-palette";
import { useCollection as useDrafts } from "@/hooks/drafts";

import * as Tabs from "@/components/tabs";
import Layout, { MainContentContainer } from "@/components/layout";
import SectionedList from "@/components/sectioned-list";
import { useVotes, useRevoteCount } from "@/components/browse-accounts-screen";

const ActivityFeed = React.lazy(() => import("@/components/activity-feed"));

const DIGEST_NEW_THRESHOLD_IN_DAYS = 7;
const DIGEST_ACTIVE_THRESHOLD_IN_DAYS = 7;

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
      const isApplication = c.latestVersion?.type === "application";
      return isApplication
        ? `applications:${forYouGroup}`
        : `${isTopic ? "topics" : "candidates"}:${forYouGroup}`;
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
      sort: (cs) => {
        const updatesByTargetProposalId = arrayUtils.groupBy(
          (c) => c.latestVersion?.targetProposalId ?? "-",
          sortCandidatesReverseChronological(cs),
        );
        // If there’s multiple updates for the same proposal, only show the latest one
        return Object.values(updatesByTargetProposalId).map(([first]) => first);
      },
    },
    {
      key: "proposals:awaiting-vote",
      title: "Not yet voted",
      sort: sortProposalsByEndsSoon,
      showVotingBar: true,
    },
    {
      key: "proposals:ongoing",
      title: "Ongoing proposals",
      description: "Currently voting",
      sort: sortProposalsByEndsSoon,
      showVotingBar: true,
    },
    {
      key: "proposals:new",
      title: "Upcoming proposals",
      // description: "Not yet open for voting",
      sort: sortProposalsByStartsSoon,
      truncationThreshold: 2,
    },
    {
      key: "candidates:new",
      title: "New candidates",
      description: `Created within the last ${DIGEST_NEW_THRESHOLD_IN_DAYS} days`,
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
      key: "topics:new",
      title: "New topics",
      description: `Created within the last ${DIGEST_NEW_THRESHOLD_IN_DAYS} days`,
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
      key: "applications:new",
      title: "New applications",
      description: `Created within the last ${DIGEST_NEW_THRESHOLD_IN_DAYS} days`,
      sort: sortCandidatesReverseChronological,
      truncationThreshold: 2,
    },
    {
      key: "applications:active",
      title: "Recently active applications",
      sort: sortCandidatesByLastActivity,
      truncationThreshold: 2,
    },
    {
      key: "proposals:recently-concluded",
      title: "Recently concluded proposals",
      sort: sortProposalsReverseChrononological,
      // truncationThreshold: 8,
      showVotingBar: true,
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

  const { address: connectedAccountAddress } = useWallet();

  const proposals_ = useProposals({ state: true });
  const candidates_ = useProposalCandidates({
    includeCanceled: false,
    includePromoted: false,
    includeProposalUpdates: false,
  });
  const proposalUpdateCandidates_ = useProposalUpdateCandidates({
    includeTargetProposal: true,
  });

  useDrafts();

  const [page, setPage] = React.useState(1);
  const [proposalSortStrategy, setProposalSortStrategy] = React.useState(
    "reverse-chronological",
  );
  const [candidateSortStrategy, setCandidateSortStrategy] =
    React.useState("activity");
  const [topicSortStrategy, setTopicSortStrategy] = React.useState("activity");
  const [applicationSortStrategy, setApplicationSortStrategy] =
    React.useState("activity");
  const [voterSortStrategy, setVoterSortStrategy] =
    React.useState("recent-revotes");

  const [hasFetchedOnce, setHasFetchedOnce] = React.useState(
    hasFetchedBrowseDataOnce,
  );

  const proposals = React.useMemo(
    () => proposals_.filter((p) => p.startBlock != null),
    [proposals_],
  );
  const {
    candidates = [],
    topics = [],
    applications = [],
  } = React.useMemo(
    () =>
      candidates_.reduce(
        (acc, c) => {
          if (c.latestVersion == null) return acc;
          if (c.latestVersion?.type === "topic")
            return { ...acc, topics: [...acc.topics, c] };
          if (c.latestVersion?.type === "application")
            return { ...acc, applications: [...acc.applications, c] };
          return { ...acc, candidates: [...acc.candidates, c] };
        },
        { candidates: [], topics: [], applications: [] },
      ),
    [candidates_],
  );
  const relevantProposalUpdateCandidates = React.useMemo(() => {
    return filterProposalUpdateCandidates(proposalUpdateCandidates_, {
      connectedAccountAddress,
    });
  }, [proposalUpdateCandidates_, connectedAccountAddress]);

  const paginate = (items) => {
    if (page == null) return items;
    return items.slice(0, BROWSE_LIST_PAGE_ITEM_COUNT * page);
  };

  const { fetchBrowseScreenData } = useActions();

  const commandPalette = useCommandPalette();

  useFetch(async () => {
    await fetchBrowseScreenData({ first: 40 });
    setHasFetchedOnce(true);
    if (hasFetchedOnce) return;
    hasFetchedBrowseDataOnce = true;
    fetchBrowseScreenData({ skip: 40, first: 1000 });
  }, [fetchBrowseScreenData]);

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
        <Tabs.Item key="applications" title="Applications">
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
              aria-label="Application sorting"
              inlineLabel="Order"
              value={applicationSortStrategy}
              options={[
                { value: "activity", label: "By recent activity" },
                { value: "reverse-chronological", label: "Chronological" },
              ]}
              onChange={(value) => {
                setApplicationSortStrategy(value);
              }}
              fullWidth={false}
              width="max-content"
            />
            <Button
              component={NextLink}
              href="/applications"
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
              applicationSortStrategy === "reverse-chronological"
                ? sortCandidatesReverseChronological(applications)
                : sortCandidatesByLastActivity(applications);
            const hasMoreItems =
              page != null && items.length > BROWSE_LIST_PAGE_ITEM_COUNT * page;
            return (
              <>
                <SectionedList
                  forcePlaceholder={!hasFetchedOnce}
                  items={[
                    {
                      key: "applications",
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
                  items={[
                    {
                      key: "candidates",
                      type: "section",
                      children: paginate(items),
                      showScoreStack: true,
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
          { extends: "create-menu", desktopOnly: false },
          { extends: "treasury-dialog-trigger", desktopOnly: false },
          { extends: "auction-dialog-trigger", desktopOnly: false },
        ]}
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
                <button
                  css={(t) =>
                    css({
                      width: "100%",
                      fontSize: t.text.sizes.large,
                      color: t.colors.inputPlaceholder,
                      background: t.colors.backgroundModifierNormal,
                      borderRadius: "0.6rem",
                      padding: "0.9rem 1.1rem",
                      textAlign: "left",
                      fontFamily: "inherit",
                      border: 0,
                      outline: "none",
                      "&:focus-visible": {
                        boxShadow: t.shadows.focus,
                      },
                    })
                  }
                  onClick={() => commandPalette.open()}
                >
                  Search...
                </button>
              </div>

              {isDesktopLayout ? (
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
          if (!allowItemActions(item)) return null;
          return `${createItemOriginUrl(item)}?${new URLSearchParams({
            tab: "activity",
            "reply-target": item.id,
          })}`;
        }}
        createRepostHref={(item) => {
          if (!allowItemActions(item)) return null;
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
    key: "topics",
    title: "Topic activity",
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
  "topics",
  "noun-representation",
  "auction-excluding-bids",
  // "auction-bids",
  "propdates",
];
const useFeedFilterCategories = () => {
  const [state, setState] = useCachedState(
    "landing-screen:selected-feed-categories-v2",
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
