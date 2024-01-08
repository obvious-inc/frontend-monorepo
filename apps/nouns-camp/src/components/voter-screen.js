import React from "react";
import { isAddress } from "viem";
import { useBlockNumber, useEnsAddress } from "wagmi";
import { useParams, Link as RouterLink } from "react-router-dom";
import { css } from "@emotion/react";
import { useFetch } from "@shades/common/react";
import { APPROXIMATE_BLOCKS_PER_DAY } from "../constants/ethereum.js";
import { buildFeed as buildVoterFeed } from "../utils/voters.js";
import {
  useAccount,
  useAccountFetch,
  useAccountProposalCandidates,
  useActions,
  useAllNounsByAccount,
  useDelegate,
  useDelegateFetch,
  useProposalCandidates,
  useProposals,
  useProposalsSponsoredByAccount,
} from "../store.js";
import MetaTags_ from "./meta-tags.js";
import Layout, { MainContentContainer } from "./layout.js";
import Callout from "./callout.js";
import * as Tabs from "./tabs.js";
import ActivityFeed_ from "./activity-feed.js";
import { useAccountDisplayName, useCachedState } from "@shades/common/app";
import AccountAvatar from "./account-avatar.js";
import Select from "@shades/ui-web/select";
import { useCurrentDynamicQuorum } from "../hooks/dao-contract.js";
import { SectionedList } from "./browse-screen.js";
import Button from "@shades/ui-web/button";
import Spinner from "@shades/ui-web/spinner";
import useMatchDesktopLayout from "../hooks/match-desktop-layout.js";
import { VotingBar } from "./proposal-screen.js";
import { array as arrayUtils } from "@shades/common/utils";
import NounPreviewPopoverTrigger from "./noun-preview-popover-trigger.js";

const VOTER_LIST_PAGE_ITEM_COUNT = 20;
const FEED_PAGE_ITEM_COUNT = 30;

const useFeedItems = (accountAddress, { filter } = {}) => {
  const proposals = useProposals({ state: true, propdates: true });
  const candidates = useProposalCandidates({
    includeCanceled: true,
    includePromoted: true,
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
      buildFeedItems()
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
    { for: 0, against: 0, abstain: 0, withReason: 0, totalVotes: 0 }
  );
};

const ActivityFeed = React.memo(({ voterAddress, filter = "all" }) => {
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
          }).then(() => {}),
    [latestBlockNumber, fetchVoterActivity]
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
      <ActivityFeed_ items={visibleItems} />

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

const FeedSidebar = React.memo(({ visible = true, voterAddress }) => {
  const [filter, setFilter] = useCachedState(
    "voter-screen:activity-filter",
    "all"
  );
  if (!visible) return null;

  return (
    <div css={css({ marginTop: "3.2rem" })}>
      <div
        css={css({
          height: "4.05rem",
          display: "flex",
          alignItems: "center",
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

      <ActivityFeed voterAddress={voterAddress} filter={filter} />
    </div>
  );
});

const FeedTabContent = React.memo(({ visible, voterAddress }) => {
  const [filter, setFilter] = useCachedState(
    "voter-screen:activity-filter",
    "all"
  );

  if (!visible) return null;

  return (
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

      <ActivityFeed voterAddress={voterAddress} filter={filter} />
    </div>
  );
});

const VotingPowerCallout = ({ voterAddress }) => {
  const currentQuorum = useCurrentDynamicQuorum();
  const account = useAccount(voterAddress);
  const { displayName: delegateDisplayName, ensName } = useAccountDisplayName(
    account?.delegateId
  );

  const delegate = useDelegate(voterAddress);
  const voteCount = delegate?.delegatedVotes ?? 0;
  const votePowerQuorumPercentage =
    currentQuorum == null
      ? null
      : Math.round((voteCount / currentQuorum) * 1000) / 10;

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
      {voteCount === 0 && account?.delegate ? (
        <div>
          Delegating votes to{" "}
          <RouterLink
            to={`/campers/${ensName ?? account?.delegateId}`}
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
          </RouterLink>
        </div>
      ) : (
        <>
          {voteCount === 0 ? (
            "No voting power"
          ) : (
            <>
              <span
                css={(t) => css({ fontWeight: t.text.weights.smallHeader })}
              >
                {voteCount} {voteCount === 1 ? "noun" : "nouns"} represented
              </span>{" "}
              (~{votePowerQuorumPercentage}% of quorum)
            </>
          )}
        </>
      )}
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
                  delegateVotes.totalVotes
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

const VoterHeader = ({ voterAddress }) => {
  const { displayName, truncatedAddress } = useAccountDisplayName(voterAddress);

  const allVoterNouns = useAllNounsByAccount(voterAddress);

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
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          columnGap: "1rem",
          alignItems: "center",
          marginBottom: "0.3rem",
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
          address={voterAddress}
          size="2.5rem"
          placeholder={false}
        />
      </div>
      <div
        css={(t) =>
          css({
            color: t.colors.textDimmed,
            fontSize: t.text.sizes.base,
            marginBottom: "2.4rem",
            "@media (min-width: 600px)": {
              marginBottom: "2.8rem",
            },
          })
        }
      >
        <a
          href={`https://etherscan.io/address/${voterAddress}`}
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
              contextAccount={voterAddress}
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

  const filteredProposals = (delegate?.proposals ?? []).filter(Boolean);
  const voterCandidates = useAccountProposalCandidates(voterAddress);
  const sponsoredProposals = useProposalsSponsoredByAccount(voterAddress);

  const { fetchVoterScreenData } = useActions();

  useFetch(
    () =>
      fetchVoterScreenData(voterAddress, { first: 40 }).then(() => {
        fetchVoterScreenData(voterAddress, { skip: 40, first: 1000 });
      }),
    [(fetchVoterScreenData, voterAddress)]
  );

  const proposalsTabTitle =
    delegate && filteredProposals?.length > 0
      ? `Proposals (${filteredProposals?.length})`
      : "Proposals";

  const candidatesTabTitle = voterCandidates?.length
    ? `Candidates (${voterCandidates?.length})`
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
                <FeedSidebar align="right" voterAddress={voterAddress} />
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
            <VoterHeader voterAddress={voterAddress} />
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
                  <FeedTabContent voterAddress={voterAddress} visible={true} />
                </Tabs.Item>
              )}
              <Tabs.Item key="proposals" title={proposalsTabTitle}>
                <div>
                  {delegate && filteredProposals.length === 0 && (
                    <Tabs.EmptyPlaceholder
                      title="No proposals"
                      description="This account has not created any proposals"
                      css={css({ padding: "6.4rem 0" })}
                    />
                  )}
                  <SectionedList
                    showPlaceholder={!delegate}
                    sections={[
                      {
                        items: filteredProposals.slice(
                          0,
                          VOTER_LIST_PAGE_ITEM_COUNT * page
                        ),
                      },
                    ]}
                    style={{ marginTop: "2rem" }}
                  />
                  {filteredProposals.length >
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
              <Tabs.Item key="candidates" title={candidatesTabTitle}>
                <div>
                  {delegate && voterCandidates.length === 0 && (
                    <Tabs.EmptyPlaceholder
                      title="No candidates"
                      description="This account has not created any proposal candidates"
                      css={css({ padding: "6.4rem 0" })}
                    />
                  )}
                  <SectionedList
                    showPlaceholder={!delegate}
                    sections={[
                      {
                        items: voterCandidates.slice(
                          0,
                          VOTER_LIST_PAGE_ITEM_COUNT * page
                        ),
                      },
                    ]}
                    style={{ marginTop: "2rem" }}
                  />
                  {voterCandidates.length >
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
              <Tabs.Item key="sponsored" title={sponsoredTabTitle}>
                <div>
                  {delegate && sponsoredProposals.length === 0 && (
                    <Tabs.EmptyPlaceholder
                      title="No sponsored proposals"
                      description="This account has not sponsored any proposals"
                      css={css({ padding: "6.4rem 0" })}
                    />
                  )}
                  <SectionedList
                    showPlaceholder={!delegate}
                    sections={[
                      {
                        items: sponsoredProposals.slice(
                          0,
                          VOTER_LIST_PAGE_ITEM_COUNT * page
                        ),
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

const VoterScreen = () => {
  const { voterId } = useParams();

  const { data: ensAddress, isFetching } = useEnsAddress({
    name: voterId.trim(),
    enabled: voterId.includes("."),
  });

  const voterAddress = isAddress(voterId.trim()) ? voterId.trim() : ensAddress;

  const { displayName, truncatedAddress, ensName } =
    useAccountDisplayName(voterAddress);

  const scrollContainerRef = React.useRef();

  useDelegateFetch(voterAddress);
  useAccountFetch(voterAddress);

  return (
    <>
      <MetaTags voterId={voterId} voterAddress={voterAddress} />
      <Layout
        scrollContainerRef={scrollContainerRef}
        navigationStack={[
          {
            to: `/campers/${voterId} `,
            label: (
              <>
                {displayName} {ensName && `(${truncatedAddress})`}
              </>
            ),
          },
        ]}
      >
        {voterAddress ? (
          <VoterMainSection
            voterAddress={voterAddress}
            scrollContainerRef={scrollContainerRef}
          />
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
                  <span
                    css={(t) => css({ fontWeight: t.text.weights.emphasis })}
                  >
                    {voterId}
                  </span>
                  .
                </div>
                <Button
                  component={RouterLink}
                  to="/"
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
    </>
  );
};

const MetaTags = ({ voterId, voterAddress }) => {
  const { displayName, truncatedAddress, address } =
    useAccountDisplayName(voterAddress);

  const title =
    address == null
      ? ""
      : displayName == null
      ? `${truncatedAddress}`
      : `${displayName} (${truncatedAddress})`;

  return <MetaTags_ title={title} canonicalPathname={`/voter/${voterId}`} />;
};

export default VoterScreen;
