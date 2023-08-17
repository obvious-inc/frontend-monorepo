import React from "react";
import {
  Link as RouterLink,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { css } from "@emotion/react";
import { useAccountDisplayName } from "@shades/common/app";
import { array as arrayUtils } from "@shades/common/utils";
import Avatar from "@shades/ui-web/avatar";
import Input from "@shades/ui-web/input";
import {
  useProposals,
  useProposalCandidates,
  useProposal,
  useProposalCandidate,
} from "../hooks/prechain.js";
import FormattedDate from "./formatted-date.js";
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
        {
          onSelect: () => {
            navigate("/new");
          },
          label: "Propose",
        },
      ]}
    >
      <MainContentContainer>
        <div
          css={css({
            padding: "1rem 1.6rem 3.2rem",
            "@media (min-width: 600px)": {
              padding: "6rem 1.6rem 8rem",
            },
          })}
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
              marginBottom: "1.6rem",
              "@media (min-width: 600px)": {
                marginBottom: "3.2rem",
              },
            })}
          />
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
                  gridTemplateColumns: "auto minmax(0,1fr)",
                  alignItems: "center",
                  gridGap: "1rem",
                },
                ".name": {
                  fontSize: t.text.sizes.large,
                  fontWeight: t.text.weights.header,
                  lineHeight: 1.2,
                },
                ".description": {
                  color: t.colors.textDimmed,
                  fontSize: t.text.sizes.small,
                  lineHeight: 1.35,
                  marginTop: "0.1rem",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
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
  const proposal = useProposal(proposalId);
  const { displayName: authorAccountDisplayName } = useAccountDisplayName(
    proposal.proposer?.id
  );

  return (
    <RouterLink to={`/${proposalId}`}>
      <Avatar
        signature={proposalId}
        signatureLength={3}
        transparent
        size="3.2rem"
      />
      <div>
        <div className="name">{proposal.title}</div>
        <div className="description">
          By{" "}
          <em
            css={(t) =>
              css({ fontWeight: t.text.weights.emphasis, fontStyle: "normal" })
            }
          >
            {authorAccountDisplayName ?? "..."}
          </em>{" "}
          on{" "}
          <FormattedDate
            value={proposal.createdTimestamp}
            day="numeric"
            month="long"
          />
        </div>
      </div>
    </RouterLink>
  );
};

const ProposalCandidateItem = ({ candidateId }) => {
  const candidate = useProposalCandidate(candidateId);
  const { displayName: authorAccountDisplayName } = useAccountDisplayName(
    candidate.proposer
  );

  return (
    <RouterLink to={`/candidates/${candidateId}`}>
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
            {candidate.latestVersion.targetProposalId == null
              ? "Candidate"
              : "Update candidate"}
          </span>
        </div>
      </div>
    </RouterLink>
  );
};

export default ProposalsScreen;
