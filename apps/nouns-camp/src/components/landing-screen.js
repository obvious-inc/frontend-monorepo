"use client";

import dateSubtractDays from "date-fns/subDays";
import dateStartOfDay from "date-fns/startOfDay";
import React from "react";
import NextLink from "next/link";
import { css } from "@emotion/react";
import { useDebouncedCallback } from "use-debounce";
import { useFetch } from "@shades/common/react";
import { useCachedState } from "@shades/common/app";
import {
  array as arrayUtils,
  object as objectUtils,
  searchRecords,
} from "@shades/common/utils";
import Input from "@shades/ui-web/input";
import Button from "@shades/ui-web/button";
import Link from "@shades/ui-web/link";
import Select from "@shades/ui-web/select";
import { isNodeEmpty as isRichTextNodeEmpty } from "@shades/ui-web/rich-text-editor";
import {
  Plus as PlusIcon,
  // Fullscreen as FullscreenIcon,
} from "@shades/ui-web/icons";
import { APPROXIMATE_BLOCKS_PER_DAY } from "../constants/ethereum.js";
import { getForYouGroup as getProposalForYouGroup } from "../utils/proposals.js";
import { search as searchEns } from "../utils/ens.js";
import {
  getSignals as getCandidateSignals,
  getSponsorSignatures as getCandidateSponsorSignatures,
} from "../utils/candidates.js";
import useBlockNumber from "../hooks/block-number.js";
import { useSearchParams } from "../hooks/navigation.js";
import { useWallet } from "../hooks/wallet.js";
import useMatchDesktopLayout from "../hooks/match-desktop-layout.js";
import {
  useActions,
  useProposals,
  useProposalCandidates,
  useProposalUpdateCandidates,
  // usePropdates,
  useEnsCache,
  useMainFeedItems,
} from "../store.js";
import { useCollection as useDrafts } from "../hooks/drafts.js";
import * as Tabs from "./tabs.js";
import Layout, { MainContentContainer } from "./layout.js";
import ProposalList from "./proposal-list.js";

const ActivityFeed = React.lazy(() => import("./activity-feed.js"));

const CANDIDATE_NEW_THRESHOLD_IN_DAYS = 3;
const CANDIDATE_ACTIVE_THRESHOLD_IN_DAYS = 5;

const getCandidateScore = (candidate) => {
  const { votes } = getCandidateSignals({ candidate });
  const {
    0: againstVotes = [],
    1: forVotes = [],
    2: abstainVotes = [],
  } = arrayUtils.groupBy((v) => v.support, votes);

  if (forVotes.length === 0 && abstainVotes.length === 0) return null;
  return forVotes.length - againstVotes.length;
};

const BROWSE_LIST_PAGE_ITEM_COUNT = 20;

const groupConfigByKey = {
  drafts: {},
  "proposals:chronological": {},
  "proposals:new": { title: "Upcoming" },
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
  const [proposalSortStrategy, setProposalSortStrategy] = useCachedState(
    "proposal-sorting-startegy",
    "activity",
  );
  const [candidateSortStrategy_, setCandidateSortStrategy] = useCachedState(
    "candidate-sorting-strategy",
    "activity",
  );

  const [hasFetchedOnce, setHasFetchedOnce] = React.useState(
    hasFetchedBrowseDataOnce,
  );

  const candidateSortStrategies =
    connectedWalletAccountAddress == null
      ? ["activity", "popularity"]
      : ["activity", "popularity", "connected-account-feedback"];

  const candidateSortStrategy = candidateSortStrategies.includes(
    candidateSortStrategy_,
  )
    ? candidateSortStrategy_
    : "popularity";

  const filteredProposals = React.useMemo(
    () => proposals.filter((p) => p.startBlock != null),
    [proposals],
  );
  const filteredCandidates = React.useMemo(
    () => candidates.filter((c) => c.latestVersion != null),
    [candidates],
  );
  const filteredProposalUpdateCandidates = React.useMemo(() => {
    const hasSigned = (c) => {
      const signatures = getCandidateSponsorSignatures(c, {
        excludeInvalid: true,
        activeProposerIds: [],
      });
      return signatures.some(
        (s) => s.signer.id.toLowerCase() === connectedWalletAccountAddress,
      );
    };

    // Include authored updates, as well as sponsored updates not yet signed
    return proposalUpdateCandidates.filter((c) => {
      if (c.latestVersion == null) return false;

      if (c.proposerId.toLowerCase() === connectedWalletAccountAddress)
        return true;

      const isSponsor =
        c.targetProposal?.signers != null &&
        c.targetProposal.signers.some(
          (s) => s.id.toLowerCase() === connectedWalletAccountAddress,
        );

      return isSponsor && !hasSigned(c);
    });
  }, [proposalUpdateCandidates, connectedWalletAccountAddress]);

  const filteredProposalDrafts = React.useMemo(() => {
    if (proposalDrafts == null) return [];
    return proposalDrafts
      .filter((d) => {
        if (d.name.trim() !== "") return true;
        return d.body.some((n) => !isRichTextNodeEmpty(n, { trim: true }));
      })
      .map((d) => ({ ...d, type: "draft" }));
  }, [proposalDrafts]);

  const allItems = React.useMemo(
    () => [
      ...filteredProposalDrafts,
      ...filteredCandidates,
      ...filteredProposals,
      ...filteredProposalUpdateCandidates,
    ],
    [
      filteredProposalDrafts,
      filteredCandidates,
      filteredProposals,
      filteredProposalUpdateCandidates,
    ],
  );

  const searchResultItems = React.useMemo(() => {
    if (deferredQuery === "") return [];

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
                (s) => ({ value: s.signer.id, exact: true }),
              ),
            ],
            fallbackSortProperty: c.createdBlock,
          }),
        ),
      ],
      [deferredQuery, ...matchingAddresses],
    );

    return matchingRecords.map((r) => r.data);
  }, [
    deferredQuery,
    filteredProposals,
    filteredCandidates,
    filteredProposalUpdateCandidates,
    filteredProposalDrafts,
    primaryEnsNameByAddress,
  ]);

  const groupProposal = (p) => {
    if (proposalSortStrategy === "chronological")
      return "proposals:chronological";

    return [
      "proposals",
      getProposalForYouGroup(
        { connectedAccountAddress: connectedWalletAccountAddress },
        p,
      ),
    ].join(":");
  };

  const candidateActiveThreshold = dateStartOfDay(
    dateSubtractDays(new Date(), CANDIDATE_ACTIVE_THRESHOLD_IN_DAYS),
  );
  const candidateNewThreshold = dateStartOfDay(
    dateSubtractDays(new Date(), CANDIDATE_NEW_THRESHOLD_IN_DAYS),
  );

  const groupCandidate = (c) => {
    const { content } = c.latestVersion;
    const connectedAccount = connectedWalletAccountAddress;

    // Non-authored/sponsored updates are already filtered out
    if (c.latestVersion.targetProposalId != null)
      return c.proposerId.toLowerCase() === connectedAccount
        ? "proposals:authored"
        : "proposals:sponsored-proposal-update-awaiting-signature";

    const isActive =
      c.createdTimestamp > candidateActiveThreshold ||
      c.lastUpdatedTimestamp > candidateActiveThreshold ||
      (c.feedbackPosts != null &&
        c.feedbackPosts.some(
          (p) => p.createdTimestamp > candidateActiveThreshold,
        ));

    if (!isActive) return "candidates:inactive";

    if (candidateSortStrategy === "popularity") return "candidates:popular";

    if (candidateSortStrategy === "connected-account-feedback") {
      const hasFeedback =
        c.feedbackPosts != null &&
        c.feedbackPosts.some(
          (p) => p.voterId.toLowerCase() === connectedAccount,
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
        (s) => !s.canceled && s.signer.id.toLowerCase() === connectedAccount,
      )
    )
      return "candidates:sponsored";

    if (c.createdTimestamp >= candidateNewThreshold) return "candidates:new";

    return "candidates:recently-active";
  };

  const sectionsByName = objectUtils.mapValues(
    // Sort and slice sections
    (items, groupKey) => {
      const { title, description } = groupConfigByKey[groupKey];

      switch (groupKey) {
        case "drafts":
          return {
            type: "section",
            key: groupKey,
            title,
            children: arrayUtils.sortBy(
              { value: (i) => Number(i.id), order: "desc" },
              items,
            ),
          };

        case "proposals:chronological": {
          const sortedItems = arrayUtils.sortBy(
            { value: (i) => Number(i.createdBlock), order: "desc" },
            items,
          );
          const paginate = page != null;
          return {
            type: "section",
            key: groupKey,
            count: sortedItems.length,
            children: paginate
              ? sortedItems.slice(0, BROWSE_LIST_PAGE_ITEM_COUNT * page)
              : sortedItems,
          };
        }

        case "proposals:awaiting-vote":
          return {
            type: "section",
            key: groupKey,
            title,
            children: arrayUtils.sortBy(
              (i) => Number(i.objectionPeriodEndBlock ?? i.endBlock),
              items,
            ),
          };

        case "proposals:authored":
        case "proposals:ongoing":
        case "proposals:new":
        case "proposals:past": {
          const sortedItems = arrayUtils.sortBy(
            {
              value: (i) => Number(i.startBlock),
              order: "desc",
            },
            items,
          );
          const paginate = page != null && groupKey === "proposals:past";
          return {
            type: "section",
            key: groupKey,
            title,
            count: sortedItems.length,
            children: paginate
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
          const sortedItems = arrayUtils.sortBy(
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
                        []),
                    ),
                  order: "desc",
                },
            items,
          );

          const paginate = page != null && groupKey === "candidates:inactive";

          return {
            type: "section",
            key: groupKey,
            title,
            description,
            count: sortedItems.length,
            children: paginate
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
    }, allItems),
  );

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

  const listings = (
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
        <Tabs.Item key="proposals" title="Proposals">
          <div css={css({ paddingTop: "2.4rem" })}>
            <div
              css={css({
                display: "flex",
                justifyContent: "space-between",
                margin: "-0.4rem 0 2rem",
              })}
            >
              <Select
                size="small"
                aria-label="Proposal sorting"
                value={proposalSortStrategy}
                options={[
                  {
                    value: "activity",
                    label: "By proposal state",
                  },
                  {
                    value: "chronological",
                    label: "Chronological",
                  },
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
              {/* <Button
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
              /> */}
            </div>
            <ProposalList
              forcePlaceholder={!hasFetchedOnce}
              items={[
                "proposals:chronological",
                "proposals:authored",
                "proposals:sponsored-proposal-update-awaiting-signature",
                "proposals:awaiting-vote",
                "proposals:ongoing",
                "proposals:new",
                "proposals:past",
              ]
                .map((sectionKey) => sectionsByName[sectionKey] ?? {})
                .filter(
                  ({ children }) => children != null && children.length !== 0,
                )}
            />
            {(() => {
              if (page == null) return null;

              const truncatableItemCount =
                proposalSortStrategy === "chronological"
                  ? sectionsByName["proposals:chronological"]?.count
                  : sectionsByName["proposals:past"]?.count;

              const hasMoreItems =
                truncatableItemCount > BROWSE_LIST_PAGE_ITEM_COUNT * page;

              if (!hasMoreItems) return null;

              return (
                <Pagination
                  showNext={() => setPage((p) => p + 1)}
                  showAll={() => setPage(null)}
                />
              );
            })()}
          </div>
        </Tabs.Item>
        <Tabs.Item key="candidates" title="Candidates">
          <div css={css({ paddingTop: "2.4rem" })}>
            <div css={css({ margin: "-0.4rem 0 2rem" })}>
              <Select
                size="small"
                aria-label="Candidate sorting"
                value={candidateSortStrategy}
                options={[
                  {
                    value: "popularity",
                    label: "By popularity",
                  },
                  {
                    value: "activity",
                    label: "By recent activity",
                  },
                  {
                    value: "connected-account-feedback",
                    label: "By your feedback activity",
                  },
                ].filter(
                  (o) =>
                    // A connected wallet is required for feedback filter to work
                    connectedWalletAccountAddress != null ||
                    o.value !== "connected-account-feedback",
                )}
                onChange={(value) => {
                  setCandidateSortStrategy(value);
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
            </div>

            <ProposalList
              forcePlaceholder={!hasFetchedOnce}
              showCandidateScore
              items={[
                "candidates:authored",
                "candidates:sponsored",
                "candidates:feedback-missing",
                "candidates:feedback-given",
                "candidates:new",
                "candidates:recently-active",
                "candidates:popular",
                "candidates:inactive",
              ]
                .map((sectionKey) => sectionsByName[sectionKey] ?? {})
                .filter(
                  ({ children }) => children != null && children.length !== 0,
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
          <div css={css({ paddingTop: "2.4rem" })}>
            <DraftTabContent items={sectionsByName["drafts"]?.children} />
          </div>
        </Tabs.Item>
      </Tabs.Root>
    </>
  );

  return (
    <>
      <Layout
        scrollContainerRef={scrollContainerRef}
        actions={[
          {
            label: "Voters",
            buttonProps: {
              component: NextLink,
              href: "/voters",
              prefetch: true,
            },
          },
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
            sidebarWidth="44rem"
            sidebar={
              // No sidebar on small screens
              !isDesktopLayout ? null : (
                <div
                  css={css({
                    containerType: "inline-size",
                    padding: "0 0 3.2rem",
                    "@media (min-width: 600px)": {
                      padding: "6rem 0 2.8rem",
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
                  padding: "6rem 0",
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
                  css={css({ flex: 1, minWidth: 0 })}
                />
              </div>

              {deferredQuery !== "" ? (
                // Search results
                <div css={css({ marginTop: "2rem" })}>
                  <ProposalList
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
          ul: { listStyle: "none" },
          "li + li": { marginTop: "1.6rem" },
          "[data-group] li + li": { marginTop: 0 },
          "[data-group-title]": {
            padding: "0.4rem 0",
            background: t.colors.backgroundPrimary,
            textTransform: "uppercase",
            fontSize: t.text.sizes.small,
            fontWeight: t.text.weights.emphasis,
            color: t.colors.textDimmed,
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
          "[data-group-list] > li": {
            position: "relative",
            padding: "0.8rem 0",
            color: t.colors.textNormal,
            borderRadius: "0.5rem",
            ".link": { position: "absolute", inset: 0, display: "block" },
            ".item-container": { position: "relative", pointerEvents: "none" },
          },
          "[data-title]": {
            fontSize: t.text.sizes.base,
            fontWeight: t.text.weights.smallHeader,
            lineHeight: 1.35,
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
              <ul data-group-list>
                {items.map((i) => (
                  <li key={i.id}></li>
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

const useActivityFeedItems = ({ filter = "all" }) => {
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

          fetchNounsActivity({
            startBlock:
              latestBlockNumber - BigInt(APPROXIMATE_BLOCKS_PER_DAY * 30),
            endBlock:
              latestBlockNumber - BigInt(APPROXIMATE_BLOCKS_PER_DAY * 2) - 1n,
          });
        },
    [latestBlockNumber, fetchNounsActivity],
  );

  return useMainFeedItems(filter, { enabled: hasFetchedOnce });
};

const TruncatedActivityFeed = ({ items }) => {
  const [page, setPage] = React.useState(2);
  const visibleItems = items.slice(0, FEED_PAGE_ITEM_COUNT * page);

  return (
    <>
      <ActivityFeed items={visibleItems} />

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

const Feed = React.memo(() => {
  const [filter, setFilter] = useCachedState(
    "browse-screen:activity-filter",
    "all",
  );
  const feedItems = useActivityFeedItems({ filter });

  return (
    <div
      css={css({ transition: "0.2s ease-out opacity" })}
      style={{ opacity: feedItems.length > 0 ? 1 : 0 }}
    >
      <React.Suspense fallback={null}>
        <div
          css={css({
            // height: "4.05rem",
            display: "flex",
            alignItems: "center",
            // justifyContent: "flex-end",
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

        <TruncatedActivityFeed items={feedItems} />
      </React.Suspense>
    </div>
  );
});

const FeedTabContent = React.memo(() => {
  const [filter, setFilter] = useCachedState(
    "browse-screen:activity-filter",
    "all",
  );
  const feedItems = useActivityFeedItems({ filter });

  return (
    <div
      css={css({ transition: "0.2s ease-out opacity", padding: "2rem 0" })}
      style={{ opacity: feedItems.length === 0 ? 0 : 1 }}
    >
      <React.Suspense fallback={null}>
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

        <TruncatedActivityFeed items={feedItems} />
      </React.Suspense>
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
    <ProposalList
      items={[
        {
          key: "drafts",
          type: "section",
          title: "Drafts",
          description:
            "Drafts are stored in your browser, not accessible to others",
          children: items,
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
    <div style={{ marginTop: "1.2rem" }}>
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
