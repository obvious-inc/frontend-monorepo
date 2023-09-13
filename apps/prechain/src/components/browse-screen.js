import React from "react";
import {
  Link as RouterLink,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { css, useTheme } from "@emotion/react";
import { useAccount } from "wagmi";
import { useAccountDisplayName } from "@shades/common/app";
import {
  array as arrayUtils,
  message as messageUtils,
} from "@shades/common/utils";
import { Noggles as NogglesIcon } from "@shades/ui-web/icons";
import Avatar from "@shades/ui-web/avatar";
import Input from "@shades/ui-web/input";
import Button from "@shades/ui-web/button";
import {
  useProposal,
  useProposals,
  isFinalProposalState,
  useProposalThreshold,
} from "../hooks/dao.js";
import {
  useProposalCandidates,
  useProposalCandidate,
  useProposalCandidateVotingPower,
} from "../hooks/prechain.js";
import useApproximateBlockTimestampCalculator from "../hooks/approximate-block-timestamp-calculator.js";
import {
  useCollection as useDrafts,
  useSingleItem as useDraft,
} from "../hooks/channel-drafts.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import { Layout, MainContentContainer } from "./proposal-screen.js";

const searchProposals = (items, rawQuery) => {
  const query = rawQuery.trim().toLowerCase();

  const filteredItems = items
    .map((i) => {
      const title = i.title ?? i.latestVersion?.content.title ?? i.name;
      return { ...i, index: title.toLowerCase().indexOf(query) };
    })
    .filter((i) => i.index !== -1);

  return arrayUtils.sortBy(
    { value: (i) => i.index, type: "index" },
    filteredItems
  );
};

const ProposalsScreen = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const deferredQuery = React.useDeferredValue(query.trim());

  const proposals = useProposals();
  const proposalCandidates = useProposalCandidates();
  const { items: proposalDrafts } = useDrafts();

  const filteredItems = React.useMemo(() => {
    const filteredProposalDrafts = proposalDrafts.filter(
      (d) =>
        d.name.trim() !== "" || !messageUtils.isEmpty(d.body, { trim: true })
    );

    const items = [
      ...filteredProposalDrafts,
      ...proposalCandidates,
      ...proposals,
    ];

    return deferredQuery === "" ? items : searchProposals(items, deferredQuery);
  }, [deferredQuery, proposals, proposalCandidates, proposalDrafts]);

  const groupedItemsByName = arrayUtils.groupBy((i) => {
    if (i.proposerId == null) return "drafts";
    // Candidates
    if (i.slug != null) return "ongoing";

    if (isFinalProposalState(i.state)) return "past";

    return "ongoing";
  }, filteredItems);

  return (
    <Layout>
      <MainContentContainer>
        <div
          css={css({
            padding: "1rem 1.6rem 3.2rem",
            "@media (min-width: 600px)": {
              padding: "8rem 1.6rem",
            },
          })}
        >
          <div
            css={(t) =>
              css({
                background: t.colors.backgroundPrimary,
                position: "sticky",
                top: 0,
                zIndex: 1,
                display: "flex",
                alignItems: "center",
                gap: "1.6rem",
                paddingTop: "0.3rem", // To offset the focus box shadow
                marginBottom: "1.6rem",
                "@media (min-width: 600px)": {
                  marginBottom: "3.2rem",
                },
              })
            }
          >
            <Input
              placeholder="Search..."
              value={query}
              onChange={(e) => {
                // Clear search from path if query is empty
                if (e.target.value.trim() === "") {
                  setSearchParams({});
                  return;
                }

                setSearchParams({ q: e.target.value });
              }}
              css={css({
                flex: 1,
                minWidth: 0,
                padding: "0.9rem 1.2rem",
              })}
            />

            {searchParams.get("beta") != null && (
              <Button
                onClick={() => {
                  navigate("/new");
                }}
              >
                New proposal
              </Button>
            )}
          </div>

          <ul
            css={(t) => {
              const hoverColor = t.colors.backgroundTertiary;
              return css({
                listStyle: "none",
                "li + li": { marginTop: "2.4rem" },
                ul: { listStyle: "none" },
                "[data-group] li + li": { marginTop: "1.6rem" },
                "[data-group-title]": {
                  position: "sticky",
                  top: "4.35rem",
                  padding: "0.5rem 0",
                  background: t.colors.backgroundPrimary,
                  textTransform: "uppercase",
                  fontSize: t.text.sizes.small,
                  fontWeight: t.text.weights.emphasis,
                  color: t.colors.textMuted,
                },
                a: {
                  textDecoration: "none",
                  padding: "0.8rem 0",
                  color: t.colors.textNormal,
                  borderRadius: "0.5rem",
                },
                "[data-title]": {
                  fontSize: t.text.sizes.large,
                  fontWeight: t.text.weights.emphasis,
                  lineHeight: 1.25,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                },
                "[data-small]": {
                  color: t.colors.textDimmed,
                  fontSize: t.text.sizes.small,
                  lineHeight: 1.4,
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
                // Mobile-only
                "@media(max-width: 800px)": {
                  "[data-desktop-only]": {
                    display: "none",
                  },
                },
                // Desktop-only
                "@media(min-width: 800px)": {
                  "[data-mobile-only]": {
                    display: "none",
                  },
                  "[data-group] li + li": { marginTop: "0.4rem" },
                  a: {
                    display: "grid",
                    alignItems: "center",
                    gridTemplateColumns: "auto minmax(0,1fr)",
                    gridGap: "1rem",
                  },
                  "[data-title]": {
                    whiteSpace: "default",
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
          >
            {["drafts", "ongoing", "past"]
              .map((groupName) => ({
                name: groupName,
                items: groupedItemsByName[groupName],
              }))
              .filter(({ items }) => items != null && items.length !== 0)
              .map(({ name: groupName, items }) => {
                const getSortedItems = () => {
                  // Keep order from search result
                  if (deferredQuery !== "") return items;

                  switch (groupName) {
                    case "drafts":
                      return arrayUtils.sortBy(
                        { value: (i) => Number(i.id), order: "desc" },
                        items
                      );

                    case "past":
                      return arrayUtils.sortBy(
                        {
                          value: (i) => Number(i.startBlock),
                          order: "desc",
                        },
                        items
                      );

                    case "ongoing":
                      return arrayUtils.sortBy(
                        // First the active ones
                        (i) =>
                          ["active", "objection-period"].includes(i.state)
                            ? Number(i.objectionPeriodEndBlock ?? i.endBlock)
                            : Infinity,
                        // The the ones that hasn’t started yet
                        (i) =>
                          ["updatable", "pending"].includes(i.state)
                            ? Number(i.startBlock)
                            : Infinity,
                        // Then the succeeded but not yet executed
                        {
                          value: (i) =>
                            i.slug != null
                              ? 0
                              : Number(i.objectionPeriodEndBlock ?? i.endBlock),
                          order: "desc",
                        },
                        // And last the candidates
                        { value: (i) => i.lastUpdatedTimestamp, order: "desc" },
                        items
                      );
                  }
                };
                return (
                  <li data-group key={groupName}>
                    <div data-group-title>
                      {groupName === "ongoing" ? "Current" : groupName}
                    </div>
                    <ul>
                      {getSortedItems().map((i) => (
                        <li key={i.id}>
                          {i.slug != null ? (
                            <ProposalCandidateItem candidateId={i.id} />
                          ) : i.startBlock != null ? (
                            <ProposalItem proposalId={i.id} />
                          ) : (
                            <ProposalDraftItem draftId={i.id} />
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
          </ul>
        </div>
      </MainContentContainer>
    </Layout>
  );
};

const ProposalItem = ({ proposalId }) => {
  const theme = useTheme();
  const proposal = useProposal(proposalId);
  const { displayName: authorAccountDisplayName } = useAccountDisplayName(
    proposal.proposer?.id
  );

  const isDimmed =
    proposal.state != null && ["canceled", "expired"].includes(proposal.state);

  const tagWithStatusText = <PropTagWithStatusText proposalId={proposalId} />;

  return (
    <RouterLink to={`/${proposalId}`} data-dimmed={isDimmed}>
      <Avatar
        signature={proposalId}
        signatureLength={3}
        size="3.2rem"
        background={isDimmed ? theme.colors.backgroundModifierHover : undefined}
        data-desktop-only
      />
      <div
        css={css({
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto",
          gridGap: "1.6rem",
          alignItems: "center",
        })}
      >
        <div>
          <div data-small>
            Prop {proposalId} by{" "}
            <em
              css={(t) =>
                css({
                  fontWeight: t.text.weights.emphasis,
                  fontStyle: "normal",
                })
              }
            >
              {authorAccountDisplayName ?? "..."}
            </em>
          </div>
          <div data-title>{proposal.title}</div>
          <div data-small data-mobile-only css={css({ marginTop: "0.2rem" })}>
            <PropStatusText proposalId={proposalId} />
          </div>
        </div>
        <div data-small>{tagWithStatusText}</div>
      </div>
    </RouterLink>
  );
};

const PropStatusText = ({ proposalId }) => {
  const proposal = useProposal(proposalId);

  const calculateBlockTimestamp = useApproximateBlockTimestampCalculator();

  const startDate = calculateBlockTimestamp(proposal.startBlock);
  const endDate = calculateBlockTimestamp(proposal.endBlock);
  const objectionPeriodEndDate = calculateBlockTimestamp(
    proposal.objectionPeriodEndBlock
  );

  switch (proposal.state) {
    case "updatable":
    case "pending":
      return (
        <>
          Starts{" "}
          <FormattedDateWithTooltip
            relativeDayThreshold={5}
            capitalize={false}
            value={startDate}
            day="numeric"
            month="long"
          />
        </>
      );

    case "active":
      return (
        <>
          <div
            css={(t) =>
              css({
                display: "inline-flex",
                '[role="separator"]:before': {
                  content: '",\u{00a0}"',
                },
                "@media(min-width: 800px)": {
                  flexDirection: "row-reverse",
                  '[role="separator"]:before': {
                    content: '"|"',
                    color: t.colors.borderLight,
                    margin: "0 1rem",
                  },
                  "[data-description]::first-letter": {
                    textTransform: "uppercase",
                  },
                },
              })
            }
          >
            <span data-votes>
              {proposal.forVotes} For {"-"} {proposal.againstVotes} Against
            </span>
            <span role="separator" aria-orientation="vertical" />
            <span data-description>
              voting ends{" "}
              <FormattedDateWithTooltip
                relativeDayThreshold={5}
                capitalize={false}
                value={endDate}
                day="numeric"
                month="long"
              />
            </span>
          </div>
        </>
      );

    case "objection-period":
      return (
        <>
          Objection period ends{" "}
          <FormattedDateWithTooltip
            relativeDayThreshold={5}
            capitalize={false}
            value={objectionPeriodEndDate}
            day="numeric"
            month="long"
          />
        </>
      );

    case "queued":
      return "Queued for execution";

    case "canceled":
    case "expired":
    case "defeated":
    case "vetoed":
    case "succeeded":
    case "executed":
      return null;

    default:
      return null;
  }
};

const PropTagWithStatusText = ({ proposalId }) => {
  const statusText = <PropStatusText proposalId={proposalId} />;

  return (
    <div
      css={css({
        display: "flex",
        alignItems: "center",
        gap: "1.6rem",
        textAlign: "right",
      })}
    >
      {statusText != null && (
        <div
          css={css({
            "@media(max-width: 800px)": {
              display: "none",
            },
          })}
        >
          {statusText}
        </div>
      )}
      <PropStatusTag proposalId={proposalId} />
    </div>
  );
};

const PropStatusTag = ({ proposalId }) => {
  const proposal = useProposal(proposalId);

  switch (proposal.state) {
    case "updatable":
    case "pending":
      return <Tag size="large">Pending</Tag>;

    case "active":
      return (
        <Tag variant="active" size="large">
          Ongoing
        </Tag>
      );

    case "objection-period":
      return (
        <Tag variant="warning" size="large">
          Objection period
        </Tag>
      );

    case "canceled":
    case "expired":
      return <Tag size="large">{proposal.state}</Tag>;

    case "defeated":
    case "vetoed":
      return (
        <Tag variant="error" size="large">
          {proposal.state}
        </Tag>
      );

    case "succeeded":
    case "executed":
      return (
        <Tag variant="success" size="large">
          {proposal.state}
        </Tag>
      );

    case "queued":
      return (
        <Tag variant="success" size="large">
          Succeeded
        </Tag>
      );

    default:
      return null;
  }
};

const ProposalCandidateItem = ({ candidateId }) => {
  const candidate = useProposalCandidate(candidateId);
  const { displayName: authorAccountDisplayName } = useAccountDisplayName(
    candidate.proposer
  );
  const votingPower = useProposalCandidateVotingPower(candidateId);
  const proposalThreshold = useProposalThreshold();
  const isCanceled = candidate.canceledTimestamp != null;

  const statusText =
    votingPower > proposalThreshold ? (
      <>Sponsor threshold met</>
    ) : (
      <>
        {votingPower} / {proposalThreshold + 1}
        <NogglesIcon
          style={{
            display: "inline-flex",
            width: "1.7rem",
            height: "auto",
            position: "relative",
            top: "-0.1rem",
            marginLeft: "0.5rem",
          }}
        />
      </>
    );

  return (
    <RouterLink to={`/candidates/${encodeURIComponent(candidateId)}`}>
      <Avatar
        signature={candidate.slug}
        signatureLength={2}
        size="3.2rem"
        data-desktop-only
      />
      <div
        css={css({
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto",
          gridGap: "1.6rem",
          alignItems: "center",
        })}
      >
        <div>
          <div data-small>
            Candidate by{" "}
            <em
              css={(t) =>
                css({
                  fontWeight: t.text.weights.emphasis,
                  fontStyle: "normal",
                })
              }
            >
              {authorAccountDisplayName ?? "..."}
            </em>
          </div>
          <div data-title>{candidate.latestVersion.content.title}</div>
          <div data-mobile-only data-small css={css({ marginTop: "0.2rem" })}>
            {statusText}
          </div>
        </div>
        <div
          data-small
          css={css({ display: "flex", gap: "1.6rem", alignItems: "center" })}
        >
          <div data-desktop-only>{statusText}</div>
          <Tag variant={isCanceled ? "error" : "special"} size="large">
            {isCanceled
              ? "Canceled candidate"
              : candidate.latestVersion.targetProposalId != null
              ? "Update candidate"
              : "Candidate"}
          </Tag>
        </div>
      </div>
    </RouterLink>
  );
};

const ProposalDraftItem = ({ draftId }) => {
  const [draft] = useDraft(draftId);
  const { address: connectedAccountAddress } = useAccount();
  const { displayName: authorAccountDisplayName } = useAccountDisplayName(
    connectedAccountAddress
  );

  return (
    <RouterLink to={`/new/${draftId}`}>
      <Avatar
        signature={draft.name || "Untitled draft"}
        signatureLength={2}
        size="3.2rem"
        data-desktop-only
      />
      <div
        css={css({
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) auto",
          gridGap: "1.6rem",
          alignItems: "center",
        })}
      >
        <div>
          <div data-small>
            By{" "}
            <em
              css={(t) =>
                css({
                  fontWeight: t.text.weights.emphasis,
                  fontStyle: "normal",
                })
              }
            >
              {authorAccountDisplayName ?? "..."}
            </em>
          </div>
          <div data-title>{draft.name || "Untitled draft"}</div>
        </div>
        <Tag size="large">Draft</Tag>
      </div>
    </RouterLink>
  );
};

export const Tag = ({ variant, size = "normal", ...props }) => (
  <span
    data-variant={variant}
    data-size={size}
    css={(t) =>
      css({
        display: "inline-flex",
        background: t.colors.backgroundModifierHover,
        color: t.colors.textDimmed,
        fontSize: t.text.sizes.tiny,
        fontWeight: "400",
        textTransform: "uppercase",
        padding: "0.1rem 0.3rem",
        borderRadius: "0.2rem",
        lineHeight: 1.2,
        '&[data-size="large"]': { padding: "0.3rem 0.5rem" },
        '&[data-variant="active"]': {
          color: t.colors.textPrimary,
          background: "#deedfd",
        },
        '&[data-variant="success"]': {
          color: "#097045",
          background: "#e0f1e1",
        },
        '&[data-variant="error"]': {
          color: t.colors.textNegative,
          background: "#fbe9e9",
        },
        '&[data-variant="special"]': {
          color: "#8d519d",
          background: "#f2dff7",
        },
      })
    }
    {...props}
  />
);

export default ProposalsScreen;
