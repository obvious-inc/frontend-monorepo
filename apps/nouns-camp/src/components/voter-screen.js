import React from "react";
import NextLink from "next/link";
import { isAddress, getAddress as checksumEncodeAddress } from "viem";
import { useBlockNumber, useEnsName, useEnsAddress } from "wagmi";
import { css } from "@emotion/react";
import {
  array as arrayUtils,
  ethereum as ethereumUtils,
} from "@shades/common/utils";
import { useCachedState } from "@shades/common/app";
import { useFetch } from "@shades/common/react";
import { useAccountDisplayName } from "@shades/common/ethereum-react";
import Select from "@shades/ui-web/select";
import Button from "@shades/ui-web/button";
import Spinner from "@shades/ui-web/spinner";
import * as DropdownMenu from "@shades/ui-web/dropdown-menu";
import { DotsHorizontal as DotsHorizontalIcon } from "@shades/ui-web/icons";
import { APPROXIMATE_BLOCKS_PER_DAY } from "../constants/ethereum.js";
import { buildFeed as buildVoterFeed } from "../utils/voters.js";
import {
  useAccount,
  useAccountFetch,
  useAccountProposals,
  useAccountProposalCandidates,
  useAccountSponsoredProposals,
  useActions,
  useAllNounsByAccount,
  useDelegate,
  useDelegateFetch,
  useProposalCandidates,
  useProposals,
} from "../store.js";
import { useWallet } from "../hooks/wallet.js";
import { useDialog } from "../hooks/global-dialogs.js";
import useMatchDesktopLayout from "../hooks/match-desktop-layout.js";
import Layout, { MainContentContainer } from "./layout.js";
import Callout from "./callout.js";
import * as Tabs from "./tabs.js";
import AccountAvatar from "./account-avatar.js";
import { useCurrentDynamicQuorum } from "../hooks/dao-contract.js";
import { SectionedList } from "./browse-screen.js";
import { VotingBar } from "./proposal-screen.js";
import NounPreviewPopoverTrigger from "./noun-preview-popover-trigger.js";

const ActivityFeed = React.lazy(() => import("./activity-feed.js"));

const VOTER_LIST_PAGE_ITEM_COUNT = 20;
const FEED_PAGE_ITEM_COUNT = 30;

const isProduction = process.env.NODE_ENV === "production";

const isDebugSession =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("debug") != null;

const useFeedItems = (accountAddress, { filter } = {}) => {
  const proposals = useProposals({ state: true, propdates: true });
  const candidates = useProposalCandidates({
    includeCanceled: true,
    includePromoted: true,
    includeProposalUpdates: true,
  });

  return React.useMemo(() => {
    const buildFeedItems = () => {
      switch (filter) {
        case "proposals":
          return buildVoterFeed(accountAddress, { proposals });
        case "candidates":
          return buildVoterFeed(accountAddress, { candidates });
        default:
          return buildVoterFeed(accountAddress, { proposals, candidates });
      }
    };

    return arrayUtils.sortBy(
      { value: (i) => i.blockNumber, order: "desc" },
      buildFeedItems(),
    );
  }, [accountAddress, proposals, candidates, filter]);
};

const getDelegateVotes = (delegate) => {
  if (delegate?.votes == null) return null;
  return delegate.votes.reduce(
    (acc, v) => {
      const voteGroup = { 0: "against", 1: "for", 2: "abstain" }[v.support];
      const withReason = v.reason != null;
      return {
        ...acc,
        [voteGroup]: acc[voteGroup] + 1,
        withReason: withReason ? acc.withReason + 1 : acc.withReason,
        totalVotes: acc.totalVotes + 1,
      };
    },
    { for: 0, against: 0, abstain: 0, withReason: 0, totalVotes: 0 },
  );
};

const TruncatedActivityFeed = React.memo(({ voterAddress, filter = "all" }) => {
  const { data: latestBlockNumber } = useBlockNumber({
    watch: true,
    cache: 20_000,
  });

  const { fetchVoterActivity } = useActions();

  const [page, setPage] = React.useState(1);

  const feedItems = useFeedItems(voterAddress, { filter });
  const visibleItems = feedItems.slice(0, FEED_PAGE_ITEM_COUNT * page);

  // Fetch feed items
  useFetch(
    latestBlockNumber == null
      ? null
      : () =>
          fetchVoterActivity(voterAddress, {
            startBlock: latestBlockNumber - BigInt(APPROXIMATE_BLOCKS_PER_DAY),
            endBlock: latestBlockNumber,
          }),
    [latestBlockNumber, fetchVoterActivity],
  );

  if (visibleItems.length === 0)
    return (
      <div
        css={(t) =>
          css({
            textAlign: "center",
            color: t.colors.textDimmed,
          })
        }
      >
        <p>No Activity</p>
      </div>
    );

  return (
    <>
      <ActivityFeed items={visibleItems} />

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

const FeedSidebar = React.memo(({ voterAddress }) => {
  const [filter, setFilter] = useCachedState(
    "voter-screen:activity-filter",
    "all",
  );

  return (
    <React.Suspense fallback={null}>
      <div css={css({ marginTop: "3.2rem" })}>
        <div
          css={css({
            display: "flex",
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

        <TruncatedActivityFeed voterAddress={voterAddress} filter={filter} />
      </div>
    </React.Suspense>
  );
});

const FeedTabContent = React.memo(({ voterAddress }) => {
  const [filter, setFilter] = useCachedState(
    "voter-screen:activity-filter",
    "all",
  );

  return (
    <React.Suspense fallback={null}>
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

        <TruncatedActivityFeed voterAddress={voterAddress} filter={filter} />
      </div>
    </React.Suspense>
  );
});

const VotingPowerCallout = ({ voterAddress }) => {
  const currentQuorum = useCurrentDynamicQuorum();
  const account = useAccount(voterAddress);
  const delegateDisplayName = useAccountDisplayName(account?.delegateId);
  const { data: ensName } = useEnsName({ address: account?.delegateId });

  const delegate = useDelegate(voterAddress);
  const voteCount = delegate?.delegatedVotes ?? 0;
  const votePowerQuorumPercentage =
    currentQuorum == null
      ? null
      : Math.round((voteCount / currentQuorum) * 1000) / 10;

  const hasNouns = account?.nouns.length > 0;
  const hasVotingPower = voteCount > 0;
  const isDelegating =
    hasNouns &&
    account?.delegate != null &&
    voterAddress.toLowerCase() !== account?.delegate.id;

  return (
    <Callout
      css={(t) =>
        css({
          fontSize: t.text.sizes.base,
          marginBottom: "2rem",
          "@media (min-width: 600px)": {
            marginBottom: "3.2rem",
          },
        })
      }
    >
      {hasVotingPower && (
        <p>
          <span css={(t) => css({ fontWeight: t.text.weights.smallHeader })}>
            {voteCount} {voteCount === 1 ? "noun" : "nouns"} represented
          </span>{" "}
          (~{votePowerQuorumPercentage}% of quorum)
        </p>
      )}

      {isDelegating ? (
        <p>
          Delegating votes to{" "}
          <NextLink
            href={`/voters/${ensName ?? account?.delegateId}`}
            css={(t) =>
              css({
                color: "inherit",
                fontWeight: t.text.weights.emphasis,
                textDecoration: "none",
                "@media(hover: hover)": {
                  ":hover": {
                    textDecoration: "underline",
                  },
                },
              })
            }
          >
            {delegateDisplayName}
          </NextLink>
        </p>
      ) : !hasVotingPower ? (
        "No voting power"
      ) : null}
    </Callout>
  );
};

const VoterStatsBar = React.memo(({ voterAddress }) => {
  const delegate = useDelegate(voterAddress);
  const delegateVotes = getDelegateVotes(delegate);

  const formatPercentage = (number, total) => {
    if (Number(number) === 0) return "0%";
    const percentage = (number * 100) / total;
    const isLessThanOne = percentage < 1;
    const hasDecimals = Math.round(percentage) !== percentage;

    return (
      <span
        css={css({
          ":before": {
            content: isLessThanOne ? '"<"' : hasDecimals ? '"~"' : undefined,
          },
        })}
      >
        {isLessThanOne ? "1" : Math.round(percentage)}%
      </span>
    );
  };

  return (
    <div
      css={css({
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        marginBottom: "2rem",
        "@media (min-width: 600px)": {
          marginBottom: "3.2rem",
        },
      })}
    >
      <div
        css={(t) =>
          css({
            display: "flex",
            justifyContent: "space-between",
            fontSize: t.text.sizes.small,
            fontWeight: t.text.weights.emphasis,
            "[data-for]": { color: t.colors.textPositive },
            "[data-against]": { color: t.colors.textNegative },
          })
        }
      >
        <div data-for>For {delegateVotes?.for ?? 0}</div>
        <div data-against>Against {delegateVotes?.against ?? 0}</div>
      </div>
      <VotingBar
        forVotes={delegateVotes?.for ?? 0}
        againstVotes={delegateVotes?.against ?? 0}
        abstainVotes={delegateVotes?.abstain ?? 0}
      />
      <div
        css={(t) =>
          css({
            fontSize: t.text.sizes.small,
            display: "flex",
            justifyContent: "space-between",
            gap: "1.6rem",
            "[data-for], [data-against]": {
              fontWeight: t.text.weights.emphasis,
            },
            "[data-for]": { color: t.colors.textPositive },
            "[data-against]": { color: t.colors.textNegative },
          })
        }
      >
        <div css={css({ whiteSpace: "nowrap" })}>
          {delegateVotes?.abstain != null && (
            <>Abstain {delegateVotes?.abstain}</>
          )}
        </div>
        <div css={css({ textAlign: "right" })}>
          {delegateVotes?.totalVotes != null && (
            <>
              <span>
                Voted on {delegateVotes.totalVotes}{" "}
                {delegateVotes.totalVotes === 1 ? "proposal" : "proposals"}{" "}
              </span>
              <br
                css={css({ "@media(min-width: 380px)": { display: "none" } })}
              />
              <span>
                (
                {formatPercentage(
                  delegateVotes.withReason,
                  delegateVotes.totalVotes,
                )}{" "}
                with reason)
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

const VoterHeader = ({ accountAddress }) => {
  const { address: connectedAccountAddress } = useWallet();
  const connectedAccount = useAccount(connectedAccountAddress);

  const isMe = accountAddress.toLowerCase() === connectedAccountAddress;
  const enableDelegation = !isMe && connectedAccount?.nouns.length > 0;
  const enableImpersonation = !isMe && (!isProduction || isDebugSession);

  const displayName = useAccountDisplayName(accountAddress);
  const truncatedAddress = ethereumUtils.truncateAddress(
    checksumEncodeAddress(accountAddress),
  );

  const allVoterNouns = useAllNounsByAccount(accountAddress);

  const { open: openDelegationDialog } = useDialog("delegation");

  return (
    <div
      css={css({
        userSelect: "text",
        marginBottom: "1.6rem",
        "@media (min-width: 600px)": {
          marginBottom: "2.8rem",
        },
      })}
    >
      <div
        css={css({
          marginBottom: "2.4rem",
          "@media (min-width: 600px)": {
            marginBottom: "2.8rem",
          },
        })}
      >
        <div
          css={css({
            display: "flex",
            gap: "1rem",
          })}
        >
          <div
            css={css({
              flex: 1,
              minWidth: 0,
              display: "flex",
              gap: "1rem",
              alignItems: "center",
            })}
          >
            <h1
              css={(t) =>
                css({
                  color: t.colors.textHeader,
                  fontSize: t.text.sizes.headerLarger,
                  lineHeight: 1.15,
                  "@media(min-width: 600px)": {
                    fontSize: t.text.sizes.huge,
                  },
                })
              }
            >
              {displayName}
            </h1>
            <AccountAvatar
              ensOnly
              address={accountAddress}
              size="2.8rem"
              placeholder={false}
            />
          </div>
          <div style={{ display: "flex", gap: "0.8rem" }}>
            {enableDelegation && (
              <Button
                size="medium"
                onClick={() => {
                  openDelegationDialog({ target: accountAddress });
                }}
              >
                Delegate
              </Button>
            )}
            <DropdownMenu.Root placement="bottom end">
              <DropdownMenu.Trigger asChild>
                <Button
                  size="medium"
                  icon={
                    <DotsHorizontalIcon
                      style={{ width: "2rem", height: "auto" }}
                    />
                  }
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
                    case "copy-account-address":
                      navigator.clipboard.writeText(
                        accountAddress.toLowerCase(),
                      );
                      close();
                      break;

                    case "impersonate-account": {
                      const searchParams = new URLSearchParams(location.search);
                      searchParams.set("impersonate", accountAddress);
                      location.replace(`${location.pathname}?${searchParams}`);
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
                        `https://lilnounsagora.com/delegate/${accountAddress}`,
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
          </div>
        </div>

        {displayName !== truncatedAddress && (
          <div
            css={(t) =>
              css({
                color: t.colors.textDimmed,
                fontSize: t.text.sizes.base,
                marginTop: "0.3rem",
              })
            }
          >
            <a
              href={`https://etherscan.io/address/${accountAddress}`}
              target="_blank"
              rel="noreferrer"
              css={css({
                color: "inherit",
                textDecoration: "none",
                display: "inline-block",
                flexDirection: "column",
                maxHeight: "2.8rem",
                justifyContent: "center",
                "@media(hover: hover)": {
                  ":hover": { textDecoration: "underline" },
                },
              })}
            >
              {truncatedAddress}
            </a>
          </div>
        )}
      </div>

      {allVoterNouns.length > 0 && (
        <div
          css={(t) =>
            css({
              display: "flex",
              gap: "1.6rem",
              flexWrap: "wrap",
              justifyContent: "flex-start",
              "[data-id]": {
                fontSize: t.text.sizes.tiny,
                fontWeight: t.text.weights.numberBadge,
                color: t.colors.textDimmed,
                margin: "0.2rem 0 0",
                textAlign: "center",
              },
            })
          }
        >
          {allVoterNouns.map((n) => (
            <NounPreviewPopoverTrigger
              key={n.id}
              nounId={n.id}
              contextAccount={accountAddress}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const VoterMainSection = ({ voterAddress }) => {
  const isDesktopLayout = useMatchDesktopLayout();

  const [page, setPage] = React.useState(1);
  const delegate = useDelegate(voterAddress);

  const proposals = useAccountProposals(voterAddress);
  const candidates = useAccountProposalCandidates(voterAddress);
  const sponsoredProposals = useAccountSponsoredProposals(voterAddress);

  const [hasFetchedData, setHasFetchedData] = React.useState(
    () => proposals.length > 0,
  );

  const { fetchVoterScreenData } = useActions();

  useFetch(
    () =>
      fetchVoterScreenData(voterAddress, { first: 40 }).then(() => {
        setHasFetchedData(true);
        fetchVoterScreenData(voterAddress, { skip: 40, first: 1000 });
      }),
    [fetchVoterScreenData, voterAddress],
  );

  const proposalsTabTitle =
    delegate && proposals?.length > 0
      ? `Proposals (${proposals?.length})`
      : "Proposals";

  const candidatesTabTitle = candidates?.length
    ? `Candidates (${candidates?.length})`
    : "Candidates";

  const sponsoredTabTitle = sponsoredProposals.length
    ? `Sponsored (${sponsoredProposals.length})`
    : "Sponsored";

  return (
    <>
      <div css={css({ padding: "0 1.6rem" })}>
        <MainContentContainer
          sidebar={
            isDesktopLayout ? (
              <div
                css={css({
                  padding: "2rem 0 3.2rem",
                  "@media (min-width: 600px)": {
                    padding: "6rem 0 8rem",
                  },
                })}
              >
                <VotingPowerCallout voterAddress={voterAddress} />
                <VoterStatsBar voterAddress={voterAddress} />
                <FeedSidebar voterAddress={voterAddress} />
              </div>
            ) : null
          }
        >
          <div
            css={css({
              padding: "1rem 0 3.2rem",
              "@media (min-width: 600px)": {
                padding: "6rem 0 12rem",
              },
            })}
          >
            <VoterHeader accountAddress={voterAddress} />
            {!isDesktopLayout && (
              <>
                <VotingPowerCallout voterAddress={voterAddress} />
                <VoterStatsBar voterAddress={voterAddress} />
              </>
            )}

            <Tabs.Root
              aria-label="Voter sections"
              defaultSelectedKey={isDesktopLayout ? "proposals" : "activity"}
              css={(t) =>
                css({
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  background: t.colors.backgroundPrimary,
                  paddingTop: "0.3rem",
                  "[role=tab]": { fontSize: t.text.sizes.base },
                })
              }
            >
              {!isDesktopLayout && (
                <Tabs.Item key="activity" title="Activity">
                  <FeedTabContent voterAddress={voterAddress} />
                </Tabs.Item>
              )}
              <Tabs.Item key="proposals" title={proposalsTabTitle}>
                <div>
                  {hasFetchedData && proposals.length === 0 && (
                    <Tabs.EmptyPlaceholder
                      title="No proposals"
                      description="This account has not created any proposals"
                      css={css({ padding: "6.4rem 0" })}
                    />
                  )}
                  <SectionedList
                    showPlaceholder={!hasFetchedData && proposals.length === 0}
                    sections={[
                      {
                        items: arrayUtils
                          .sortBy(
                            {
                              value: (p) => Number(p.id),
                              order: "desc",
                            },
                            proposals,
                          )
                          .slice(0, VOTER_LIST_PAGE_ITEM_COUNT * page),
                      },
                    ]}
                    style={{ marginTop: "2rem" }}
                  />
                  {proposals.length > VOTER_LIST_PAGE_ITEM_COUNT * page && (
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
              <Tabs.Item key="candidates" title={candidatesTabTitle}>
                <div>
                  {hasFetchedData && candidates.length === 0 && (
                    <Tabs.EmptyPlaceholder
                      title="No candidates"
                      description="This account has not created any proposal candidates"
                      css={css({ padding: "6.4rem 0" })}
                    />
                  )}
                  <SectionedList
                    showPlaceholder={!hasFetchedData && candidates.length === 0}
                    sections={[
                      {
                        items: arrayUtils
                          .sortBy(
                            {
                              value: (p) => p.lastUpdatedTimestamp,
                              order: "desc",
                            },
                            candidates,
                          )
                          .slice(0, VOTER_LIST_PAGE_ITEM_COUNT * page),
                      },
                    ]}
                    style={{ marginTop: "2rem" }}
                  />
                  {candidates.length > VOTER_LIST_PAGE_ITEM_COUNT * page && (
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
              <Tabs.Item key="sponsored" title={sponsoredTabTitle}>
                <div>
                  {hasFetchedData && sponsoredProposals.length === 0 && (
                    <Tabs.EmptyPlaceholder
                      title="No sponsored proposals"
                      description="This account has not sponsored any proposals"
                      css={css({ padding: "6.4rem 0" })}
                    />
                  )}
                  <SectionedList
                    showPlaceholder={
                      !hasFetchedData && sponsoredProposals.length === 0
                    }
                    sections={[
                      {
                        items: arrayUtils
                          .sortBy(
                            {
                              value: (p) => p.lastUpdatedTimestamp,
                              order: "desc",
                            },
                            sponsoredProposals,
                          )
                          .slice(0, VOTER_LIST_PAGE_ITEM_COUNT * page),
                      },
                    ]}
                    style={{ marginTop: "2rem" }}
                  />
                  {sponsoredProposals.length >
                    VOTER_LIST_PAGE_ITEM_COUNT * page && (
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
          </div>
        </MainContentContainer>
      </div>
    </>
  );
};

const VoterScreen = ({ voterId: rawAddressOrEnsName }) => {
  const addressOrEnsName = decodeURIComponent(rawAddressOrEnsName);

  const { data: ensAddress, isPending: isFetching } = useEnsAddress({
    name: addressOrEnsName,
    query: {
      enabled: addressOrEnsName.includes("."),
    },
  });

  const voterAddress = isAddress(addressOrEnsName)
    ? addressOrEnsName
    : ensAddress;

  const displayName = useAccountDisplayName(voterAddress);

  useDelegateFetch(voterAddress, { fetchInterval: 10_000 });
  useAccountFetch(voterAddress, { fetchInterval: 10_000 });

  return (
    <Layout
      navigationStack={[
        { to: "/voters", label: "Voters", desktopOnly: true },
        { to: `/voters/${rawAddressOrEnsName}`, label: displayName },
      ]}
    >
      {voterAddress != null ? (
        <VoterMainSection voterAddress={voterAddress} />
      ) : (
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            paddingBottom: "10vh",
          }}
        >
          {isFetching ? (
            <Spinner size="2rem" />
          ) : (
            <div>
              <div
                css={(t) =>
                  css({
                    fontSize: t.text.sizes.headerLarger,
                    fontWeight: t.text.weights.header,
                    margin: "0 0 1.6rem",
                    lineHeight: 1.3,
                  })
                }
              >
                Not found
              </div>
              <div
                css={(t) =>
                  css({
                    fontSize: t.text.sizes.large,
                    wordBreak: "break-word",
                    margin: "0 0 4.8rem",
                  })
                }
              >
                Found no voter with id{" "}
                <span css={(t) => css({ fontWeight: t.text.weights.emphasis })}>
                  {rawAddressOrEnsName}
                </span>
                .
              </div>
              <Button
                component={NextLink}
                href="/"
                variant="primary"
                size="large"
              >
                Go back
              </Button>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
};

export default VoterScreen;
