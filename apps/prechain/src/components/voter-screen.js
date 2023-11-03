import React from "react";
import { isAddress } from "viem";
import { useEnsAddress } from "wagmi";
import { useParams, Link as RouterLink } from "react-router-dom";
import { css } from "@emotion/react";
import { useMatchMedia, useFetch } from "@shades/common/react";
import { buildFeed as buildVoterFeed } from "../utils/voters.js";
import {
  useAccountProposalCandidates,
  useActions,
  useDelegate,
  useDelegateFetch,
} from "../store.js";
import MetaTags_ from "./meta-tags.js";
import Layout, { MainContentContainer } from "./layout.js";
import Callout from "./callout.js";
import * as Tabs from "./tabs.js";
import ActivityFeed from "./activity-feed.js";
import { useAccountDisplayName } from "@shades/common/app";
import AccountAvatar from "./account-avatar.js";
import NounAvatar from "./noun-avatar.js";
import Select from "@shades/ui-web/select";
import { useCurrentDynamicQuorum } from "../hooks/dao-contract.js";
import { SectionedList } from "./browse-screen.js";
import Button from "@shades/ui-web/button";

const VOTER_LIST_PAGE_ITEM_COUNT = 20;

const useFeedItems = (voterAddress) => {
  const delegate = useDelegate(voterAddress);

  return React.useMemo(() => buildVoterFeed(delegate), [delegate]);
};

const FeedSidebar = React.memo(({ visible = true, voterAddress }) => {
  const [sorting, setSorting] = React.useState("recent");

  const feedItems = useFeedItems(voterAddress);

  if (!visible) return null;

  return (
    <div css={css({ paddingTop: "2rem" })}>
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
          aria-label="Feed sorting"
          value={sorting}
          options={[{ value: "recent", label: "Recent" }]}
          onChange={(value) => {
            setSorting(value);
          }}
          fullWidth={false}
          align="right"
          width="max-content"
          renderTriggerContent={(value) => {
            const sortLabel = {
              recent: "Recent",
            }[value];
            return (
              <>
                Sort:{" "}
                <em
                  css={(t) =>
                    css({
                      fontStyle: "normal",
                      fontWeight: t.text.weights.emphasis,
                    })
                  }
                >
                  {sortLabel}
                </em>
              </>
            );
          }}
        />
      </div>

      {feedItems.length !== 0 && (
        <div style={{ marginTop: "3.2rem" }}>
          <ActivityFeed items={feedItems} />
        </div>
      )}
    </div>
  );
});

const VotingPowerCallout = ({ voterAddress }) => {
  const currentQuorum = useCurrentDynamicQuorum();

  const delegate = useDelegate(voterAddress);
  const nounsRepresented = delegate?.nounsRepresented ?? [];

  const voteCount = nounsRepresented.length;
  const votePowerQuorumPercentage =
    currentQuorum == null
      ? null
      : Math.round((voteCount / currentQuorum) * 1000) / 10;

  return (
    <Callout css={(t) => css({ fontSize: t.text.sizes.base })}>
      <span css={(t) => css({ fontWeight: t.text.weights.smallHeader })}>
        {voteCount} {voteCount === 1 ? "noun" : "nouns"} represented
      </span>{" "}
      {voteCount !== 0 && (
        <>
          {votePowerQuorumPercentage == null ? (
            <div style={{ paddingTop: "0.3rem" }}>
              <div
                css={(t) =>
                  css({
                    height: "1.8rem",
                    width: "11rem",
                    background: t.colors.backgroundModifierHover,
                    borderRadius: "0.3rem",
                  })
                }
              />
            </div>
          ) : (
            <span>(~{votePowerQuorumPercentage}% of quorum)</span>
          )}
        </>
      )}
    </Callout>
  );
};

const VoterHeader = ({ voterAddress }) => {
  const { displayName, truncatedAddress, ensName } =
    useAccountDisplayName(voterAddress);

  const delegate = useDelegate(voterAddress);

  return (
    <div css={css({ userSelect: "text", marginBottom: "2.8rem" })}>
      <div
        css={css({
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          columnGap: "1rem",
          alignItems: "center",
          marginBottom: !ensName ? "2.4rem" : "unset",
        })}
      >
        <h1
          css={(t) =>
            css({
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
      {ensName && (
        <div
          css={(t) =>
            css({
              color: t.colors.textDimmed,
              fontSize: t.text.sizes.base,
              marginBottom: "2.4rem",
            })
          }
        >
          {truncatedAddress}
        </div>
      )}

      {delegate?.nounsRepresented.length > 0 && (
        <Callout css={(t) => css({ fontSize: t.text.sizes.base })}>
          <div
            css={(t) =>
              css({
                display: "flex",
                gap: "1.2rem",
                flexWrap: "wrap",
                justifyContent: "flex-start",
                "[data-id]": {
                  fontSize: t.text.sizes.tiny,
                  color: t.colors.textDimmed,
                  margin: "0.2rem 0 0",
                  textAlign: "center",
                },
              })
            }
          >
            {delegate.nounsRepresented.map((n) => (
              <div key={n.id}>
                <NounAvatar id={n.id} seed={n.seed} size="3.2rem" />
                <div data-id>{n.id}</div>
              </div>
            ))}
          </div>
        </Callout>
      )}
    </div>
  );
};

const VoterMainSection = ({ voterAddress }) => {
  const isDesktopLayout = useMatchMedia("(min-width: 952px)");

  const [page, setPage] = React.useState(1);
  const delegate = useDelegate(voterAddress);

  const filteredProposals = delegate?.proposals ?? [];
  const voterCandidates = useAccountProposalCandidates(voterAddress);

  const { fetchVoterScreenData } = useActions();

  useFetch(
    () =>
      Promise.all([
        fetchVoterScreenData(voterAddress, { first: 40 }),
        fetchVoterScreenData(voterAddress, { skip: 40, first: 1000 }),
      ]),
    [fetchVoterScreenData, voterAddress]
  );

  return (
    <>
      <div css={css({ padding: "0 1.6rem" })}>
        <MainContentContainer
          sidebar={
            isDesktopLayout ? (
              <div
                css={css({
                  padding: "1rem 0 3.2rem",
                  "@media (min-width: 600px)": {
                    padding: "6rem 0 8rem",
                  },
                })}
              >
                <VotingPowerCallout voterAddress={voterAddress} />

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

            <Tabs.Root
              aria-label="Voter sections"
              defaultSelectedKey="proposals"
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
              <Tabs.Item key="proposals" title="Proposals">
                <div
                  css={css({
                    paddingTop: "2.4rem",
                    "@media (min-width: 600px)": {
                      paddingTop: "2.8rem",
                    },
                  })}
                >
                  <SectionedList
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
              <Tabs.Item key="candidates" title="Candidates">
                <div
                  css={css({
                    paddingTop: "2.4rem",
                    "@media (min-width: 600px)": {
                      paddingTop: "2.8rem",
                    },
                  })}
                >
                  <SectionedList
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
            </Tabs.Root>
          </div>
        </MainContentContainer>
      </div>
    </>
  );
};

const VoterScreen = () => {
  const { voterId } = useParams();

  const { data: ensAddress } = useEnsAddress({
    name: voterId.trim(),
    enabled: voterId.trim().split(".").slice(-1)[0] === "eth",
  });

  const voterAddress = isAddress(voterId.trim()) ? voterId.trim() : ensAddress;

  const { displayName, truncatedAddress, ensName } =
    useAccountDisplayName(voterAddress);

  const scrollContainerRef = React.useRef();

  useDelegateFetch(voterAddress);

  return (
    <>
      <MetaTags voterId={voterId} voterAddress={voterAddress} />
      <Layout
        scrollContainerRef={scrollContainerRef}
        navigationStack={[
          {
            to: `/voter/${voterId} `,
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
