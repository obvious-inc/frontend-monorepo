import React from "react";
import { css } from "@emotion/react";
import Button from "@shades/ui-web/button";
import * as Tooltip from "@shades/ui-web/tooltip";
import * as Popover from "@shades/ui-web/popover";
import InlineButton from "@shades/ui-web/inline-button";
import Avatar from "@shades/ui-web/avatar";
import RichText from "./rich-text";
import {
  AddUser as AddUserIcon,
  RemoveUser as RemoveUserIcon,
} from "@shades/ui-web/icons";
import { followUser, unfollowUser, useIsFollower } from "../hooks/hub";
import useSigner from "./signer";
import useFarcasterAccount from "./farcaster-account";
import { useUserByFid } from "../hooks/channel";

const AccountPreviewPopoverTrigger = React.forwardRef(
  (
    {
      fid,
      username,
      variant: buttonVariant = "link",
      popoverPlacement = "top",
      accountActions = [],
      children,
      ...props
    },
    triggerRef
  ) => {
    const user = useUserByFid(fid);
    if (fid == null && user == null) return null;

    const disabled = user?.deleted;

    return (
      <Popover.Root placement={popoverPlacement} {...props}>
        <Popover.Trigger asChild disabled={disabled}>
          {children ?? (
            <InlineButton
              ref={triggerRef}
              variant={buttonVariant}
              {...props}
              disabled={props.disabled ?? disabled}
              css={css({ userSelect: "text", fontWeight: "unset" })}
            >
              @{username ?? user?.username}
            </InlineButton>
          )}
        </Popover.Trigger>
        <Popover.Content>
          <AccountPreview fid={fid} actions={accountActions} />
        </Popover.Content>
      </Popover.Root>
    );
  }
);

const AccountPreview = React.forwardRef(({ fid, actions = [] }, ref) => {
  const user = useUserByFid(fid);
  const { fid: mainFid } = useFarcasterAccount();
  const { signer } = useSigner();

  const followsUser = useIsFollower({ fid: mainFid, fidToCheck: fid });
  const [followed, setFollowed] = React.useState(false);

  const displayName = user?.displayName;

  const handleFollowClick = async () => {
    if (!followed) {
      return await followUser({
        fid: mainFid,
        signer,
        fidToFollow: fid,
      }).then(() => {
        setFollowed(true);
      });
    } else {
      return await unfollowUser({
        fid: mainFid,
        signer,
        fidToUnfollow: fid,
      }).then(() => {
        setFollowed(false);
      });
    }
  };

  React.useEffect(() => {
    if (followsUser == null) return;
    setFollowed(followsUser);
  }, [followsUser]);

  if (user == null) return null;

  return (
    <div
      ref={ref}
      css={css({
        width: "30rem",
        minWidth: 0,
        borderRadius: "0.4rem",
        overflow: "hidden",
      })}
    >
      <div style={{ display: "flex", alignItems: "center", padding: "1.2rem" }}>
        <Avatar
          url={user?.pfpUrl}
          size="4rem"
          style={{ marginRight: "1.2rem" }}
        />
        <div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2
              css={(t) =>
                css({
                  color: t.colors.header,
                  fontSize: t.text.sizes.large,
                  fontWeight: t.text.weights.smallHeader,
                  lineHeight: 1.2,
                })
              }
            >
              {displayName}
            </h2>
          </div>
          <div
            css={(t) =>
              css({
                fontSize: t.text.sizes.small,
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: t.colors.textDimmed,
              })
            }
          >
            <Tooltip.Root>
              <Tooltip.Trigger asChild>
                <a
                  href={`https://warpcast.com/${user.username}`}
                  rel="noreferrer"
                  target="_blank"
                  css={css({
                    color: "inherit",
                    textDecoration: "none",
                    "@media(hover: hover)": {
                      ":hover": { textDecoration: "underline" },
                    },
                  })}
                >
                  {user.username} ({user.fid})
                </a>
              </Tooltip.Trigger>
              <Tooltip.Content portal={false} side="top" sideOffset={4}>
                <div>
                  Click to see user on{" "}
                  <span css={(t) => css({ color: t.colors.link })}>
                    warpcast.com
                  </span>
                </div>
              </Tooltip.Content>
            </Tooltip.Root>
          </div>
        </div>
        {mainFid && fid != mainFid && (
          <div style={{ justifySelf: "end", paddingLeft: "2rem" }}>
            {followed ? (
              <Button
                size="small"
                align="right"
                icon={<RemoveUserIcon style={{ width: "1.6rem" }} />}
                onClick={handleFollowClick}
              >
                Unfollow
              </Button>
            ) : (
              <Button
                size="small"
                align="right"
                icon={<AddUserIcon style={{ width: "1.6rem" }} />}
                onClick={handleFollowClick}
              >
                Follow
              </Button>
            )}
          </div>
        )}
      </div>

      <div style={{ margin: "1rem 2rem" }}>
        <div
          css={(t) =>
            css({ fontSize: t.text.sizes.small, wordBreak: "break-word" })
          }
        >
          <RichText inline blocks={user.bioBlocks ?? []} />
        </div>
        <div
          css={(t) =>
            css({
              marginTop: "2rem",
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0,1fr))",
              gridGap: "1.2rem",
              fontSize: t.text.sizes.small,
            })
          }
        >
          <div>
            <p style={{ fontWeight: "bold" }}>Following</p>
            <p>{user.followingCount}</p>
          </div>
          <div>
            <p style={{ fontWeight: "bold" }}>Followers</p>
            <p>{user.followerCount}</p>
          </div>
        </div>
      </div>

      {actions.length > 0 && (
        <div
          css={(t) =>
            css({
              padding: "1.2rem",
              borderTop: "0.1rem solid",
              borderColor: t.colors.borderLighter,
            })
          }
        >
          {actions.length > 0 && (
            <div
              css={css({
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                gridGap: "1.2rem",
              })}
              style={{
                marginTop: user.description == null ? undefined : "1.2rem",
              }}
            >
              {actions.map((a, i) => (
                <Button
                  key={i}
                  size="small"
                  onClick={a.onSelect}
                  style={{ whiteSpace: "nowrap", textOverflow: "ellipsis" }}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default AccountPreviewPopoverTrigger;
