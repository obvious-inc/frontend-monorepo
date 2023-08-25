import React from "react";
import {
  Link as RouterLink,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { css, useTheme } from "@emotion/react";
import { useBlockNumber } from "wagmi";
import { useAccountDisplayName } from "@shades/common/app";
import { array as arrayUtils } from "@shades/common/utils";
import Avatar from "@shades/ui-web/avatar";
import AccountAvatar from "@shades/ui-web/account-avatar";
import Input from "@shades/ui-web/input";
import Button from "@shades/ui-web/button";
import {
  useProposals,
  useProposalCandidates,
  useProposal,
  useProposalState,
  useProposalCandidate,
} from "../hooks/prechain.js";
import useApproximateBlockTimestampCalculator from "../hooks/approximate-block-timestamp-calculator.js";
import { useWallet } from "../hooks/wallet.js";
import FormattedDateWithTooltip from "./formatted-date-with-tooltip.js";
import { Layout, MainContentContainer } from "./proposal-screen.js";

const searchProposals = (items, rawQuery) => {
  const query = rawQuery.trim().toLowerCase();

  const filteredItems = items
    .map((i) => {
      const title = i.title ?? i.latestVersion?.content.title;
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
  const {
    address: connectedAccountAddress,
    requestAccess: requestWalletAccess,
  } = useWallet();
  const { displayName: connectedAccountDisplayName } = useAccountDisplayName(
    connectedAccountAddress
  );
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const deferredQuery = React.useDeferredValue(query.trim());

  const proposals = useProposals();
  const proposalCandidates = useProposalCandidates();

  const filteredItems = React.useMemo(() => {
    const items = [...proposalCandidates, ...proposals];

    return deferredQuery === ""
      ? arrayUtils.sortBy(
          { value: (i) => i.lastUpdatedTimestamp, order: "desc" },
          items
        )
      : searchProposals(items, deferredQuery);
  }, [deferredQuery, proposals, proposalCandidates]);

  return (
    <Layout
      // navigationStack={[{ to: "/", label: "Proposals" }]}
      actions={[
        connectedAccountAddress == null
          ? { onSelect: requestWalletAccess, label: "Connect Wallet" }
          : {
              onSelect: () => {},
              label: (
                <div
                  css={css({
                    display: "flex",
                    alignItems: "center",
                    gap: "0.8rem",
                  })}
                >
                  <div>{connectedAccountDisplayName}</div>
                  <AccountAvatar
                    address={connectedAccountAddress}
                    size="2rem"
                  />
                </div>
              ),
            },
      ]}
    >
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
                display: "flex",
                alignItems: "center",
                gap: "1.6rem",
                "@media (min-width: 600px)": {
                  marginBottom: "4.8rem",
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
              })}
            />

            <Button
              onClick={() => {
                navigate("/new");
              }}
            >
              New proposal
            </Button>
          </div>

          <ul
            css={(t) => {
              const hoverColor = t.colors.backgroundTertiary;
              return css({
                listStyle: "none",
                "li + li": { marginTop: "0.4rem" },
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
                  fontWeight: t.text.weights.header,
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
            {filteredItems.map((i) => (
              <li key={i.id}>
                {i.slug == null ? (
                  <ProposalItem proposalId={i.id} />
                ) : (
                  <ProposalCandidateItem candidateId={i.id} />
                )}
              </li>
            ))}
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

  const state = useProposalState(proposalId);

  const isDimmed =
    state != null &&
    ["cancelled", "expired", "defeated", "vetoed", "executed"].includes(state);

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

  const { data: latestBlockNumber } = useBlockNumber();
  const calculateBlockTimestamp = useApproximateBlockTimestampCalculator();

  const startDate = calculateBlockTimestamp(proposal.startBlock);
  const endDate = calculateBlockTimestamp(proposal.endBlock);
  const objectionPeriodEndDate = calculateBlockTimestamp(
    proposal.objectionPeriodEndBlock
  );

  //   if (status === ProposalState.PENDING || status === ProposalState.ACTIVE) {
  //     if (!blockNumber) {
  //       return ProposalState.UNDETERMINED;
  //     }
  //     if (isDaoGteV3 && proposal.updatePeriodEndBlock && blockNumber <= parseInt(proposal.updatePeriodEndBlock)) {
  //       return ProposalState.UPDATABLE;
  //     }

  //     if (blockNumber <= parseInt(proposal.startBlock)) {
  //       return ProposalState.PENDING;
  //     }

  //     if (
  //       isDaoGteV3 &&
  //       blockNumber > +proposal.endBlock &&
  //       parseInt(proposal.objectionPeriodEndBlock) > 0 &&
  //       blockNumber <= parseInt(proposal.objectionPeriodEndBlock)
  //     ) {
  //       return ProposalState.OBJECTION_PERIOD;
  //     }

  //     // if past endblock, but onchain status hasn't been changed
  //     if (
  //       blockNumber > parseInt(proposal.endBlock) &&
  //       blockNumber > parseInt(proposal.objectionPeriodEndBlock)
  //     ) {
  //       const forVotes = new BigNumber(proposal.forVotes);
  //       if (forVotes.lte(proposal.againstVotes) || forVotes.lt(proposal.quorumVotes)) {
  //         return ProposalState.DEFEATED;
  //       }
  //       if (!proposal.executionETA) {
  //         return ProposalState.SUCCEEDED;
  //       }
  //     }
  //     return ProposalState.ACTIVE;
  //   }

  switch (proposal.status) {
    case "PENDING":
    case "ACTIVE": {
      if (latestBlockNumber == null || startDate == null || endDate == null)
        return null;

      if (latestBlockNumber <= parseInt(proposal.startBlock))
        return (
          <>
            Starts{" "}
            <FormattedDateWithTooltip
              capitalize={false}
              value={startDate}
              day="numeric"
              month="long"
            />
          </>
        );

      if (
        parseInt(proposal.objectionPeriodEndBlock) > 0 &&
        latestBlockNumber <= parseInt(proposal.objectionPeriodEndBlock)
      )
        return (
          <>
            Objection period ends{" "}
            <FormattedDateWithTooltip
              capitalize={false}
              value={objectionPeriodEndDate}
              day="numeric"
              month="long"
            />
          </>
        );

      if (latestBlockNumber <= parseInt(proposal.endBlock))
        return (
          <>
            Voting ends{" "}
            <FormattedDateWithTooltip
              capitalize={false}
              value={endDate}
              day="numeric"
              month="long"
            />
          </>
        );

      if (
        proposal.forVotes <= proposal.againstVotes ||
        proposal.forVotes < proposal.quorumVotes
      )
        return "Defeated";

      // if (!proposal.executionETA) {
      //   return ProposalState.SUCCEEDED;
      // }

      return "Succeeded";
    }

    case "VETOED":
      return "Vetoed";
    case "CANCELLED":
      return "Cancelled";
    case "QUEUED":
      return "Queued";
    case "EXECUTED":
      return "Executed";

    default:
      return (
        <>
          Proposed{" "}
          <FormattedDateWithTooltip
            capitalize={false}
            value={proposal.createdTimestamp}
            day="numeric"
            month="long"
          />
        </>
      );
    // throw new Error();
  }
};

const ProposalCandidateItem = ({ candidateId }) => {
  const candidate = useProposalCandidate(candidateId);
  const { displayName: authorAccountDisplayName } = useAccountDisplayName(
    candidate.proposer
  );

  return (
    <RouterLink to={`/candidates/${encodeURIComponent(candidateId)}`}>
      <Avatar
        signature={candidate.slug}
        signatureLength={2}
        transparent
        size="3.2rem"
      />
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
              ? "Canceled candidarte"
              : candidate.latestVersion.targetProposalId != null
              ? "Update candidate"
              : "Candidate"}
          </Tag>
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
