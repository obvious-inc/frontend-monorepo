import { css } from "@emotion/react";
import Heading from "./heading.js";
import NavBar from "./navbar";
import { useSearchParams } from "react-router-dom";
import Button from "@shades/ui-web/button";
import { Cross as CrossIcon } from "@shades/ui-web/icons";
import { useNeynarCast } from "../hooks/neynar.js";

const ThreadNavBar = ({ cast }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const parentHash = cast?.parentHash;
  const parentCast = useNeynarCast(parentHash);

  const threadAuthor = parentCast
    ? parentCast.author?.displayName
    : cast?.author?.displayName;

  const threadText = parentCast ? parentCast.text : cast?.text;
  const threadHash = parentCast ? parentCast.hash : cast?.hash;

  return (
    <NavBar>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          // overflow: "hidden",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Heading
          component="button"
          css={(t) =>
            css({
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              borderRadius: "0.3rem",
              outline: "none",
              "&:focus-visible": { boxShadow: t.shadows.focus },
              "@media (hover: hover)": {
                cursor: "pointer",
                ":hover": { color: t.colors.textNormal },
              },
            })
          }
        >
          {threadAuthor}
        </Heading>

        <>
          <div
            role="separator"
            aria-orientation="vertical"
            css={(t) =>
              css({
                width: "0.1rem",
                height: "1.8rem",
                background: t.colors.borderLight,
                margin: "0 1.1rem",
              })
            }
          />

          <button
            css={(t) =>
              css({
                flex: 1,
                minWidth: 0,
                color: t.colors.textDimmed,
                marginRight: "1.1rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                userSelect: "text",
                maxWidth: "100%",
                borderRadius: "0.3rem",
                outline: "none",
                "&:focus-visible": { boxShadow: t.shadows.focus },
                "@media (hover: hover)": {
                  cursor: "pointer",
                  ":hover": { color: t.colors.textDimmedModifierHover },
                },
              })
            }
            onClick={() => {
              setSearchParams({ cast: threadHash });
            }}
          >
            <p>{threadText}</p>
          </button>

          <Button
            size="small"
            onClick={() => {
              searchParams.delete("cast");
              setSearchParams(searchParams);
            }}
            css={css({ width: "2.8rem", padding: 0 })}
          >
            <CrossIcon
              style={{ width: "1.5rem", height: "auto", margin: "auto" }}
            />
          </Button>
        </>
      </div>
    </NavBar>
  );
};

export default ThreadNavBar;
