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
                "[data-group] li + li": { marginTop: "0.4rem" },
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
                  display: "grid",
                  gridTemplateColumns: "auto minmax(0,1fr) auto",
                  alignItems: "center",
                  gridGap: "1rem",
                },
                ".name": {
                  fontSize: t.text.sizes.large,
                  fontWeight: t.text.weights.emphasis,
                  lineHeight: 1.2,
                },
                ".description, .status": {
                  color: t.colors.textDimmed,
                  fontSize: t.text.sizes.small,
                  lineHeight: 1.35,
                  marginTop: "0.1rem",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                },
                ".status": { textAlign: "right" },
                '[data-dimmed="true"]': {
                  color: t.colors.textMuted,
                  ".description, .status": {
                    color: t.colors.textMuted,
                  },
                },
                "@media(hover: hover)": {
                  "a:hover": {
                    // background: t.colors.backgroundModifierHover,
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
                    <div data-group-title>{groupName}</div>
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
    proposal.state != null &&
    ["canceled", "expired", "defeated", "vetoed"].includes(proposal.state);

  return (
    <RouterLink to={`/${proposalId}`} data-dimmed={isDimmed}>
      <Avatar
        signature={proposalId}
        signatureLength={3}
        size="3.2rem"
        background={isDimmed ? theme.colors.backgroundModifierHover : undefined}
      />
      <div>
        <div className="name">{proposal.title}</div>
        <div className="description">
          Prop {proposalId} by{" "}
          <em
            css={(t) =>
              css({ fontWeight: t.text.weights.emphasis, fontStyle: "normal" })
            }
          >
            {authorAccountDisplayName ?? "..."}
          </em>
          {/* on{" "} */}
          {/* <FormattedDate */}
          {/*   value={proposal.createdTimestamp} */}
          {/*   day="numeric" */}
          {/*   month="long" */}
          {/* /> */}
          {/* <Tag>{proposal.status}</Tag> */}
        </div>
      </div>
      <div className="status">
        <PropStatusText proposalId={proposalId} />
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
          Voting ends{" "}
          <FormattedDateWithTooltip
            relativeDayThreshold={5}
            capitalize={false}
            value={endDate}
            day="numeric"
            month="long"
          />
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

    case "defeated":
    case "vetoed":
    case "canceled":
    case "expired":
      return (
        <Tag css={(t) => css({ color: t.colors.textNegative })}>
          {proposal.state}
        </Tag>
      );

    case "succeeded":
    case "queued":
    case "executed":
      return (
        <Tag css={(t) => css({ color: t.colors.textPositive })}>
          {proposal.state}
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

  return (
    <RouterLink to={`/candidates/${encodeURIComponent(candidateId)}`}>
      <Avatar signature={candidate.slug} signatureLength={2} size="3.2rem" />
      <div>
        <div className="name">{candidate.latestVersion.content.title}</div>
        <div className="description">
          By{" "}
          <em
            css={(t) =>
              css({ fontWeight: t.text.weights.emphasis, fontStyle: "normal" })
            }
          >
            {authorAccountDisplayName ?? "..."}
          </em>
          <Tag>
            {candidate.canceledTimestamp != null
              ? "Canceled candidate"
              : candidate.latestVersion.targetProposalId != null
              ? "Update candidate"
              : "Candidate"}
          </Tag>
        </div>
      </div>
      {votingPower > proposalThreshold ? (
        <Tag>Sponsor threshold met</Tag>
      ) : (
        <div className="status">
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
        </div>
      )}
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
      />
      <div>
        <div className="name">{draft.name || "Untitled draft"}</div>
        <div className="description">
          By{" "}
          <em
            css={(t) =>
              css({ fontWeight: t.text.weights.emphasis, fontStyle: "normal" })
            }
          >
            {authorAccountDisplayName ?? "..."}
          </em>
          <Tag>Draft</Tag>
        </div>
      </div>
      <div />
    </RouterLink>
  );
};

export const Tag = ({ children }) => (
  <span
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
        marginLeft: "0.6rem",
        lineHeight: 1.2,
      })
    }
  >
    {children}
  </span>
);

export default ProposalsScreen;
