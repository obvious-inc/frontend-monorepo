import { css } from "@emotion/react";
import { useNeynarCast } from "../hooks/neynar";
import Avatar from "@shades/ui-web/avatar";
import RichText from "./rich-text";

const ReplyTargetCast = ({ castHash, layout, onClickMessage }) => {
  const cast = useNeynarCast(castHash);

  return (
    <div
      css={(t) =>
        css({
          position: "relative",
          ":before": {
            display: "var(--path-display)",
            content: '""',
            position: "absolute",
            right: "calc(100% - 5rem + 0.5rem)",
            top: "calc(50% - 1px)",
            width: "2.7rem",
            height: "1.2rem",
            border: "0.2rem solid",
            borderColor: t.colors.borderLight,
            borderRight: 0,
            borderBottom: 0,
            borderTopLeftRadius: "0.4rem",
          },
        })
      }
      style={{
        "--path-display": layout === "bubbles" ? "none" : "block",
        paddingLeft: layout !== "bubbles" ? "5rem" : undefined,
        marginBottom: layout === "bubbles" ? 0 : "0.5rem",
      }}
    >
      <div
        css={css({
          display: "grid",
          gridTemplateColumns: "1.4rem minmax(0,1fr)",
          alignItems: "center",
          gridGap: "0.5rem",
        })}
      >
        <Avatar
          url={cast?.author?.pfp_url || cast?.author?.pfp.url}
          size="1.4rem"
        />
        <div
          css={(t) =>
            css({
              fontSize: "1.3rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              color: t.colors.textDimmed,
            })
          }
        >
          {cast?.deleted ? (
            <span
              css={(t) =>
                css({ fontStyle: "italic", color: t.colors.textMuted })
              }
            >
              Cast deleted
            </span>
          ) : (
            <>
              {cast?.author?.display_name || cast?.author?.displayName}
              {": "}
              <span
                role="button"
                tabIndex={0}
                onClick={onClickMessage}
                css={(theme) =>
                  css({
                    "@media(hover: hover)": {
                      cursor: "pointer",
                      ":hover": { color: theme.colors.textNormal },
                    },
                  })
                }
              >
                <RichText inline blocks={cast?.richText ?? []} />
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReplyTargetCast;
