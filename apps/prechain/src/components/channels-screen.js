import React from "react";
import { Link as RouterLink } from "react-router-dom";
import { css } from "@emotion/react";
import { useAccountDisplayName } from "@shades/common/app";
import { array as arrayUtils } from "@shades/common/utils";
import Avatar from "@shades/ui-web/avatar";
import Input from "@shades/ui-web/input";
import { useProposals, useProposal } from "../hooks/prechain.js";
import FormattedDate from "./formatted-date.js";
import NavBar from "./nav-bar.js";

const searchProposals = (items, rawQuery) => {
  const query = rawQuery.trim().toLowerCase();

  const filteredItems = items
    .map((i) => ({ ...i, index: i.title.toLowerCase().indexOf(query) }))
    .filter((i) => i.index !== -1);

  return arrayUtils.sortBy(
    { value: (i) => i.index, type: "index" },
    filteredItems
  );
};

const ProposalsScreen = () => {
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query.trim());

  const proposals = useProposals();

  const filteredProposals = React.useMemo(
    () =>
      deferredQuery === ""
        ? proposals
        : searchProposals(proposals, deferredQuery),
    [deferredQuery, proposals]
  );

  return (
    <>
      <div
        css={(t) =>
          css({
            position: "relative",
            zIndex: 0,
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            height: "100%",
            background: t.colors.backgroundPrimary,
          })
        }
      >
        <NavBar>
          <div
            css={(t) =>
              css({
                fontSize: t.text.sizes.header,
                fontWeight: t.text.weights.header,
                color: t.colors.textHeader,
              })
            }
          >
            Proposals
          </div>
        </NavBar>
        <div css={css({ padding: "0 1.5rem 1rem" })}>
          <Input
            placeholder="Search..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
          />
        </div>
        <div
          css={(t) =>
            css({
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              justifyContent: "flex-start",
              color: t.colors.textNormal,
              fontSize: t.text.sizes.large,
              overflowY: "scroll",
              overflowX: "hidden",
            })
          }
        >
          <div style={{ padding: "0 1rem 1rem" }}>
            <ul
              css={(t) =>
                css({
                  listStyle: "none",
                  "li + li": { marginTop: "0.4rem" },
                  a: {
                    textDecoration: "none",
                    padding: "0.8rem 0.6rem",
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
                    "a:hover": { background: t.colors.backgroundModifierHover },
                  },
                })
              }
            >
              {filteredProposals.map((p) => (
                <li key={p.id}>
                  <ProposalItem proposalId={p.id} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

const ProposalItem = ({ proposalId }) => {
  const proposal = useProposal(proposalId);
  const { displayName: authorAccountDisplayName } = useAccountDisplayName(
    proposal.proposer?.id
  );

  return (
    <RouterLink to={`/${proposalId}`}>
      <Avatar signature={proposalId} transparent size="3.2rem" />
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

export default ProposalsScreen;
