import React from "react";
import { css } from "@emotion/react";
import Button from "@shades/ui-web/button";
import * as Tooltip from "@shades/ui-web/tooltip";
import * as Popover from "@shades/ui-web/popover";
import InlineButton from "@shades/ui-web/inline-button";
import { useNeynarUser } from "../hooks/neynar";
import Avatar from "@shades/ui-web/avatar";

const AccountPreviewPopoverTrigger = React.forwardRef(
  (
    {
      fid,
      variant: buttonVariant = "link",
      popoverPlacement = "top",
      accountActions = [],
      children,
      ...props
    },
    triggerRef
  ) => {
    const { user } = useNeynarUser(fid);
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
              css={css({ userSelect: "text" })}
            >
              (@{user?.username})
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
  const { user } = useNeynarUser(fid);
  const displayName = user?.displayName;
  if (user == null) return null;

  const bio = user?.profile?.bio?.text;

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
      <div style={{ display: "flex", padding: "1.2rem" }}>
        <Avatar
          url={user?.pfp_url || user?.pfp.url}
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
      </div>

      <div style={{ margin: "1rem 2rem" }}>
        <div
          css={(t) =>
            css({ fontSize: t.text.sizes.small, wordBreak: "break-word" })
          }
        >
          {bio}
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

      {(actions.length > 0 || user.description != null) && (
        <div
          css={(t) =>
            css({
              padding: "1.2rem",
              borderTop: "0.1rem solid",
              borderColor: t.colors.borderLighter,
            })
          }
        >
          {user.description != null && (
            <div css={(t) => css({ fontSize: t.text.sizes.base })}>
              {user.description}
            </div>
          )}

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
