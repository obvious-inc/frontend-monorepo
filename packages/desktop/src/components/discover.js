import React from "react";
import { css } from "@emotion/react";
import { useNavigate } from "react-router";
import { Link } from "react-router-dom";
import { useAppScope, arrayUtils } from "@shades/common";
import Button from "./button";

const { sort } = arrayUtils;

const Discover = () => {
  const { state, actions } = useAppScope();
  const servers = state.selectServers();

  const navigate = useNavigate();

  React.useEffect(() => {
    actions.fetchServers();
  }, [actions]);

  if (servers.length === 0) return null;

  return (
    <div
      css={(theme) =>
        css({
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          background: theme.colors.backgroundTertiary,
          padding: "6rem 2rem",
          overflow: "auto",
          overflowWrap: "break-word",
        })
      }
    >
      <div style={{ minWidth: 0 }}>
        <h1
          css={(theme) =>
            css({
              color: theme.colors.textHeader,
              fontSize: "1.9rem",
              margin: "0 0 1.5rem",
              lineHeight: 1.2,
            })
          }
        >
          Discover public towns
        </h1>

        {sort((s1, s2) => {
          if (s1.member_count > s2.member_count) return -1;
          if (s1.member_count < s2.member_count) return 1;
          return 0;
        }, servers).map((s) => {
          const renderLink = s.isMember;
          const ContainerComponent = renderLink ? Link : "div";
          const baseProps = renderLink
            ? { to: `/channels/${s.id}` }
            : undefined;
          return (
            <li
              key={s.id}
              css={css({
                listStyle: "none",
                padding: 0,
                ":not(:last-of-type)": {
                  marginBottom: "1.2rem",
                },
              })}
            >
              <ContainerComponent
                {...baseProps}
                css={(theme) =>
                  css({
                    display: "block",
                    background: theme.colors.backgroundSecondary,
                    padding: "1.5rem",
                    width: "46rem",
                    maxWidth: "100%",
                    borderRadius: "0.8rem",
                    transition: "0.2s all ease-out",
                    textDecoration: "none",
                    color: "inherit",
                    ":hover": {
                      background: theme.colors.backgroundPrimary,
                      transform: "translateY(-1px)",
                      boxShadow: theme.shadows.elevationHigh,
                    },
                    h2: {
                      color: theme.colors.textHeader,
                      fontSize: "1.6rem",
                      lineHeight: 1.3,
                      margin: "0 0 0.6rem",
                    },
                    ".description, .member-count": {
                      fontSize: theme.fontSizes.tiny,
                      color: theme.colors.textDimmed,
                      lineHeight: 1.3,
                    },
                    ".description": {
                      fontSize: theme.fontSizes.small,
                    },
                    ".member-count": {
                      fontSize: theme.fontSizes.tiny,
                    },
                  })
                }
              >
                <h2>{s.name}</h2>
                <div className="description">
                  {s.description || "No description"}
                </div>
                <div
                  css={css({
                    display: "grid",
                    gridTemplateColumns: "minmax(0,1fr) auto",
                    gridGap: "2rem",
                    alignItems: "flex-end",
                  })}
                >
                  <div className="member-count" style={{ marginTop: "1.5rem" }}>
                    {s.member_count}{" "}
                    {s.member_count === 1 ? "member" : "members"}{" "}
                  </div>
                  {!renderLink && (
                    <Button
                      variant="primary"
                      size="small"
                      onClick={() => {
                        actions.joinServer(s.id).then(
                          () => {
                            navigate(`/channels/${s.id}`);
                          },
                          () => {
                            alert("That didn’t work out at all.");
                          }
                        );
                      }}
                    >
                      Join town
                    </Button>
                  )}
                </div>
              </ContainerComponent>
            </li>
          );
        })}
      </div>
    </div>
  );
};
export default Discover;
