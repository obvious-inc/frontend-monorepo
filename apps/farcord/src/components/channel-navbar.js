import { css } from "@emotion/react";
import { useFarcasterChannel } from "../hooks/farcord";
import Avatar from "@shades/ui-web/avatar";
import Heading from "./heading.js";
import NavBar from "./navbar";

const ChannelNavBar = ({ channelId }) => {
  const channel = useFarcasterChannel(channelId);
  if (!channel) return null;

  let channelLink = channel?.parentUrl;

  return (
    <NavBar>
      {channel.imageUrl != null && (
        <a
          href={channel.imageLarge}
          rel="noreferrer"
          target="_blank"
          css={(t) =>
            css({
              borderRadius: "50%",
              outline: "none",
              ":focus-visible": {
                boxShadow: `0 0 0 0.2rem ${t.colors.primary}`,
              },
            })
          }
          style={{ marginRight: "1.1rem" }}
        >
          <Avatar url={channel.imageUrl} size="2.4rem" />
        </a>
      )}

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
          component="a"
          href={channelLink}
          target="_blank"
          rel="noreferrer"
          css={(t) =>
            css({
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              borderRadius: "0.3rem",
              outline: "none",
              textDecoration: "none",
              "&:focus-visible": { boxShadow: t.shadows.focus },
              "@media (hover: hover)": {
                cursor: "pointer",
                ":hover": { color: t.colors.textNormal },
              },
            })
          }
        >
          {channel.name}
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

          <div
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
                  // cursor: "pointer",
                  ":hover": { color: t.colors.textDimmedModifierHover },
                },
              })
            }
          >
            <p>{channel.description}</p>
          </div>
        </>
      </div>
    </NavBar>
  );
};

export default ChannelNavBar;
