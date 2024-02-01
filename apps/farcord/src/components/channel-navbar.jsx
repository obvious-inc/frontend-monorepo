import { css } from "@emotion/react";
import { useFarcasterChannel } from "../hooks/farcord";
import Avatar from "@shades/ui-web/avatar";
import Heading from "./heading";
import NavBar from "./navbar";
import {
  Star as StarIcon,
  StrokedStar as StrokedStarIcon,
} from "@shades/ui-web/icons";
import useFarcasterAccount from "./farcaster-account";
import useSigner from "./signer";
import { useChannelCacheContext, useIsChannelFollowed } from "../hooks/channel";
import React from "react";

const ChannelNavBar = ({ channelId, name, description }) => {
  const channel = useFarcasterChannel(channelId);
  const { fid } = useFarcasterAccount();
  const { broadcasted } = useSigner();
  const isChannelFollowed = useIsChannelFollowed(channelId);
  const {
    actions: { followChannel, unfollowChannel },
  } = useChannelCacheContext();

  let channelLink = channel?.parentUrl;

  const isFarcordChannel = channelLink == "https://farcord.com";

  React.useEffect(() => {
    if (channel && isFarcordChannel && fid && !isChannelFollowed) {
      followChannel({ fid, channel });
    }
  }, [channel, isFarcordChannel, fid, followChannel, isChannelFollowed]);

  const renderRightColumn = () => {
    return (
      <div>
        <button
          onClick={() => {
            const tryFollowChannel = async () => {
              if (!broadcasted) {
                alert("You need to connect your account to follow channels.");
                return;
              }

              if (isChannelFollowed) {
                await unfollowChannel({ fid, channel });
                return;
              }

              await followChannel({ fid, channel });
            };

            tryFollowChannel();
          }}
          css={(t) =>
            css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "0.3rem",
              width: "3.3rem",
              height: "2.8rem",
              padding: 0,
              transition: "background 20ms ease-in",
              outline: "none",
              ":focus-visible": {
                boxShadow: `0 0 0 0.2rem ${t.colors.primary}`,
              },
              "@media(hover: hover)": {
                cursor: "pointer",
                ":hover": {
                  background: t.colors.backgroundModifierHover,
                },
              },
            })
          }
        >
          {isChannelFollowed ? (
            <StarIcon css={(t) => css({ color: t.colors.backgroundYellow })} />
          ) : (
            <StrokedStarIcon />
          )}
        </button>
      </div>
    );
  };

  return (
    <NavBar>
      {channel?.imageUrl != null && (
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
          {name}
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
            <p>{description}</p>
          </div>

          {channel && !isFarcordChannel && renderRightColumn()}
        </>
      </div>
    </NavBar>
  );
};

export default ChannelNavBar;
