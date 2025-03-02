import React from "react";
import NextLink from "next/link";
import { isAddress } from "viem";
import { useEnsAddress } from "wagmi";
import { css } from "@emotion/react";
import {
  array as arrayUtils,
  ethereum as ethereumUtils,
} from "@shades/common/utils";
import { useCachedState } from "@shades/common/app";
import { useFetch } from "@shades/common/react";
import Select from "@shades/ui-web/select";
import Button from "@shades/ui-web/button";
import Spinner from "@shades/ui-web/spinner";
import * as DropdownMenu from "@shades/ui-web/dropdown-menu";
import { DotsHorizontal as DotsHorizontalIcon } from "@shades/ui-web/icons";
import { CHAIN_ID } from "../constants/env.js";
import { APPROXIMATE_BLOCKS_PER_DAY } from "../constants/ethereum.js";
import { resolveAddress as resolveContractAddress } from "@/contracts.js";
import {
  useAccount,
  useAccountFetch,
  useAccountProposals,
  useAccountProposalCandidates,
  useAccountSponsoredProposals,
  useAccountTopics,
  useActions,
  useDelegate,
  useDelegateFetch,
  useAccountFeedItems,
} from "../store.js";
import useBlockNumber from "../hooks/block-number.js";
import { useWallet } from "../hooks/wallet.js";
import { useDialog } from "../hooks/global-dialogs.js";
import { useSearchParams } from "../hooks/navigation.js";
import useMatchDesktopLayout from "../hooks/match-desktop-layout.js";
import useAccountDisplayName from "../hooks/account-display-name.js";
import Layout, { MainContentContainer } from "./layout.js";
import Callout from "./callout.js";
import * as Tabs from "./tabs.js";
import AccountAvatar from "./account-avatar.js";
import { useCurrentDynamicQuorum } from "../hooks/dao-contract.js";
import VotingBar from "./voting-bar.js";
import NounPreviewPopoverTrigger from "./noun-preview-popover-trigger.js";
import ProposalList from "./sectioned-list.js";
import { buildEtherscanLink } from "../utils/etherscan.js";
import { useAccountsWithVerifiedEthAddress as useFarcasterAccountsWithVerifiedEthAddress } from "../hooks/farcaster.js";
import Avatar from "@shades/ui-web/avatar";
import AccountPreviewPopoverTrigger from "./account-preview-popover-trigger.js";

const ActivityFeed = React.lazy(() => import("./activity-feed.js"));

const FEED_PAGE_ITEM_COUNT = 30;

const isProduction = process.env.NODE_ENV === "production";

const isDebugSession =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("debug") != null;

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
  const latestBlockNumber = useBlockNumber({
    watch: true,
    cache: 20_000,
  });

  const { fetchVoterActivity } = useActions();

  const [page, setPage] = React.useState(1);

  const feedItems = useAccountFeedItems(voterAddress, { filter });
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
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get("feed-filter") ?? "all";

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
              { value: "representation", label: "Delegation activity only" },
            ]}
            onChange={(value) => {
              setSearchParams(
                (p) => {
                  const newParams = new URLSearchParams(p);
                  if (value === "all") newParams.delete("feed-filter");
                  else newParams.set("feed-filter", value);
                  return newParams;
                },
                { replace: true },
              );
            }}
            fullWidth={false}
            width="max-content"
            renderTriggerContent={(value) => {
              const filterLabel = {
                all: "Everything",
                proposals: "Proposal activity",
                candidates: "Candidate activity",
                representation: "Delegation activity",
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
              { value: "representation", label: "Delegation activity only" },
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
                representation: "Delegation activity",
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
  const delegate = useDelegate(voterAddress);
  const voteCount = delegate?.delegatedVotes ?? 0;
  const votePowerQuorumPercentage =
    currentQuorum == null
      ? null
      : Math.round((voteCount / currentQuorum) * 1000) / 10;

  const hasNouns = account?.nouns?.length > 0;
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
          <AccountPreviewPopoverTrigger
            showAvatar
            accountAddress={account?.delegateId}
          />
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
            gap: "0.8rem",
            justifyContent: "space-between",
            fontSize: t.text.sizes.small,
            "[data-support]": {
              fontWeight: t.text.weights.emphasis,
            },
            "[data-support=for]": {
              fontWeight: t.text.weights.emphasis,
              color: t.colors.textPositive,
            },
            "[data-support=against]": {
              fontWeight: t.text.weights.emphasis,
              color: t.colors.textNegative,
            },
            "[data-support=abstain]": {
              color:
                t.colorScheme === "dark"
                  ? t.colors.textDimmed
                  : t.colors.textMuted,
            },
          })
        }
      >
        <div data-support="for">For {delegateVotes?.for ?? 0}</div>
        <div>
          {delegateVotes?.abstain > 0 && (
            <>
              <span data-support="abstain">
                Abstain {delegateVotes?.abstain}
              </span>{" "}
              <span css={(t) => css({ color: t.colors.textDimmed })}>
                {"\u00B7"}
              </span>{" "}
            </>
          )}
          <span data-support="against">
            Against {delegateVotes?.against ?? 0}
          </span>
        </div>
      </div>
      <VotingBar
        votes={[
          { support: 0, votes: delegateVotes?.against ?? 0 },
          { support: 1, votes: delegateVotes?.for ?? 0 },
          { support: 2, votes: delegateVotes?.abstain ?? 0 },
        ]}
      />
      <div
        css={(t) =>
          css({
            fontSize: t.text.sizes.small,
            textAlign: "right",
          })
        }
      >
        {delegateVotes?.totalVotes == null ? (
          <>&nbsp;</> // To prevent layout shift
        ) : (
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
  );
});

const VoterHeader = ({ accountAddress }) => {
  const { address: connectedAccountAddress } = useWallet();
  const connectedAccount = useAccount(connectedAccountAddress);

  const account = useAccount(accountAddress);
  const delegate = useDelegate(accountAddress);

  const isMe = accountAddress.toLowerCase() === connectedAccountAddress;
  const enableDelegation = !isMe && connectedAccount?.nouns?.length > 0;
  const enableImpersonation = !isMe && (!isProduction || isDebugSession);

  const displayName_ = useAccountDisplayName(accountAddress);
  const truncatedAddress = ethereumUtils.truncateAddress(accountAddress);
  const matchingContract = resolveContractAddress(accountAddress);

  const displayName =
    matchingContract == null || displayName_ !== truncatedAddress
      ? displayName_
      : matchingContract.name;

  const farcasterAccounts =
    useFarcasterAccountsWithVerifiedEthAddress(accountAddress);

  const representedNouns = delegate?.nounsRepresented ?? [];

  const ownedNouns = account?.nouns ?? [];
  const delegatedRepresentedNouns = representedNouns.filter(
    (n) => n.ownerId !== accountAddress,
  );

  const nouns = [...ownedNouns, ...delegatedRepresentedNouns];

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
                      ...(farcasterAccounts ?? []).map((farcasterAccount) => ({
                        id: `open-warpcast:${farcasterAccount.fid}`,
                        label: (
                          <div>
                            Warpcast
                            <div
                              css={(t) =>
                                css({
                                  marginTop: "0.2rem",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  fontSize: t.text.sizes.small,
                                  color: t.colors.textDimmed,
                                })
                              }
                            >
                              {(() => {
                                const { fid, username, displayName, pfpUrl } =
                                  farcasterAccount;
                                return (
                                  <span
                                    title={[
                                      displayName ?? username ?? `FID ${fid}`,
                                      username != null &&
                                        username !== displayName &&
                                        `(@${username})`,
                                    ]
                                      .filter(Boolean)
                                      .join(" ")}
                                  >
                                    {pfpUrl != null && (
                                      <Avatar
                                        url={pfpUrl}
                                        size="1.2em"
                                        css={css({
                                          display: "inline-block",
                                          marginRight: "0.3em",
                                          verticalAlign: "sub",
                                        })}
                                      />
                                    )}
                                    {displayName ?? username ?? `FID ${fid}`}
                                    {username != null &&
                                      username !== displayName && (
                                        <> (@{username})</>
                                      )}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        ),
                      })),
                      {
                        id: "open-etherscan",
                        label: "Etherscan",
                      },
                      {
                        id: "open-rainbow",
                        label: "Rainbow",
                      },
                    ],
                  },
                ]}
                onAction={(key) => {
                  if (key.startsWith("open-warpcast:")) {
                    const fid = key.split(":")[1];
                    const farcasterAccount = farcasterAccounts.find(
                      (a) => String(a.fid) === fid,
                    );
                    if (farcasterAccount == null) throw new Error();
                    window.open(
                      `https://warpcast.com/${farcasterAccount.username}`,
                      "_blank",
                    );
                    return;
                  }

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
                        buildEtherscanLink(`/address/${accountAddress}`),
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
              href={buildEtherscanLink(`/address/${accountAddress}`)}
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

      {nouns.length > 0 && (
        <div
          css={css({
            display: "flex",
            gap: "1.6rem",
            flexWrap: "wrap",
            justifyContent: "flex-start",
          })}
        >
          {arrayUtils
            .sortBy(
              { value: (n) => n.ownerId === accountAddress },
              { value: (n) => parseInt(n.id), order: "asc" },
              nouns,
            )
            .map((n) => (
              <NounPreviewPopoverTrigger
                key={n.id}
                nounId={n.id}
                contextAccount={accountAddress}
                variant="portrait"
                size="4rem"
              />
            ))}
        </div>
      )}
    </div>
  );
};

const VoterMainSection = ({ voterAddress }) => {
  const isDesktopLayout = useMatchDesktopLayout();

  const delegate = useDelegate(voterAddress);

  const proposals = useAccountProposals(voterAddress);
  const candidates = useAccountProposalCandidates(voterAddress, {
    includeTopics: false,
  });
  const sponsoredProposals = useAccountSponsoredProposals(voterAddress);
  const topics = useAccountTopics(voterAddress);

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

  const topicsTabTitle = topics?.length
    ? `Topics (${topics?.length})`
    : "Topics";

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
                  <div style={{ marginTop: "2rem" }}>
                    <ProposalList
                      forcePlaceholder={
                        !hasFetchedData && proposals.length === 0
                      }
                      items={arrayUtils.sortBy(
                        {
                          value: (p) => Number(p.id),
                          order: "desc",
                        },
                        proposals,
                      )}
                    />
                  </div>
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
                  <div style={{ marginTop: "2rem" }}>
                    <ProposalList
                      forcePlaceholder={
                        !hasFetchedData && candidates.length === 0
                      }
                      items={arrayUtils.sortBy(
                        {
                          value: (p) => p.lastUpdatedTimestamp,
                          order: "desc",
                        },
                        candidates,
                      )}
                    />
                  </div>
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
                  <div style={{ marginTop: "2rem" }}>
                    <ProposalList
                      forcePlaceholder={
                        !hasFetchedData && sponsoredProposals.length === 0
                      }
                      items={arrayUtils.sortBy(
                        {
                          value: (p) => p.lastUpdatedTimestamp,
                          order: "desc",
                        },
                        sponsoredProposals,
                      )}
                    />
                  </div>
                </div>
              </Tabs.Item>
              <Tabs.Item key="topics" title={topicsTabTitle}>
                <div>
                  {hasFetchedData && topics.length === 0 && (
                    <Tabs.EmptyPlaceholder
                      title="No topics"
                      description="This account has not created any topics"
                      css={css({ padding: "6.4rem 0" })}
                    />
                  )}
                  <div style={{ marginTop: "2rem" }}>
                    <ProposalList
                      forcePlaceholder={!hasFetchedData && topics.length === 0}
                      items={arrayUtils.sortBy(
                        {
                          value: (p) => p.lastUpdatedTimestamp,
                          order: "desc",
                        },
                        topics,
                      )}
                    />
                  </div>
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
    chainId: CHAIN_ID,
    query: {
      enabled: addressOrEnsName.includes("."),
    },
  });

  const voterAddress = (
    isAddress(addressOrEnsName) ? addressOrEnsName : ensAddress
  )?.toLowerCase();

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
