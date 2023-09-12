import { css } from "@emotion/react";
import Heading from "./heading.js";
import NavBar from "./navbar";

const ThreadNavBar = () => {
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
          New Thread
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
          >
            <p>Threa description?</p>
          </button>
        </>
      </div>
    </NavBar>
  );
};

export default ThreadNavBar;
