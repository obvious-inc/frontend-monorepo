import React from "react";
import { Triangle as TriangleIcon } from "@shades/ui-web/icons";
import { css } from "@emotion/react";
import { NavLink, Outlet, useSearchParams } from "react-router-dom";
import { useFarcasterChannels } from "../hooks/farcord";
import { Layout as SidebarLayout } from "@shades/ui-web/sidebar-layout";
import { ErrorBoundary } from "@shades/common/react";
import Avatar from "@shades/ui-web/avatar";
import FarcasterProfile from "./farcaster-profile";

import { useFollowedChannels } from "../hooks/warpcast";
import useSigner from "./signer";
import Dialog from "@shades/ui-web/dialog";
import AuthDialog from "./auth-dialog";
import useFarcasterAccount from "./farcaster-account";

const DEFAULT_TRUNCATED_COUNT = 10;

const ListItem = React.forwardRef(
  (
    {
      component: Component = "button",
      expandable,
      expanded,
      size,
      compact = true,
      onToggleExpanded,
      indendationLevel = 0,
      icon,
      title,
      subtitle,
      disabled,
      ...props
    },
    ref
  ) => {
    const iconSize = size === "large" ? "3rem" : "2rem";
    return (
      <div className="list-item">
        <Component
          ref={ref}
          disabled={Component === "button" ? disabled : undefined}
          style={{
            "--indentation-level": indendationLevel,
            pointerEvents:
              Component !== "button" && disabled ? "none" : undefined,
            color: disabled ? `var(--disabled-color)` : undefined,
            height: size === "large" ? "4.4rem" : "var(--item-height)",
          }}
          {...props}
        >
          {expandable && (
            <div
              css={css({
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "2.2rem",
                height: "2.2rem",
              })}
              style={{ marginRight: icon == null ? "0.4rem" : 0 }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  onToggleExpanded();
                }}
                css={(t) =>
                  css({
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "2rem",
                    height: "2rem",
                    color: t.colors.textMuted,
                    borderRadius: "0.3rem",
                    transition: "background 20ms ease-in",
                    ":hover": {
                      background: t.colors.backgroundModifierHover,
                    },
                  })
                }
              >
                <TriangleIcon
                  style={{
                    transition: "transform 200ms ease-out",
                    transform: `rotate(${expanded ? "180deg" : "90deg"})`,
                    width: "0.963rem",
                  }}
                />
              </div>
            </div>
          )}
          {icon != null && (
            <div
              className="icon-container"
              style={{
                marginRight:
                  size === "large"
                    ? "0.88888888rem"
                    : compact
                    ? "0.4rem"
                    : "0.8rem",
                width: `calc(${iconSize} + 0.2rem)`,
              }}
            >
              <div
                style={{
                  color: disabled ? "rgb(255 255 255 / 22%)" : undefined,
                  width: iconSize,
                  height: iconSize,
                }}
              >
                {icon}
              </div>
            </div>
          )}
          <div className="title-container">
            {title}
            {subtitle != null && (
              <div className="subtitle-container">{subtitle}</div>
            )}
          </div>
        </Component>
      </div>
    );
  }
);

export const ChannelItem = ({ channel, expandable }) => {
  const link = `/channels/${channel.id || channel.key}`;

  return (
    <ListItem
      expandable={expandable}
      component={NavLink}
      to={link}
      className={({ isActive }) => (isActive ? "active" : "")}
      title={
        <div
          className="title"
          css={css({
            overflow: "hidden",
            textOverflow: "ellipsis",
          })}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gridGap: "0.4rem",
          }}
        >
          <p>{channel.name}</p>
          <p
            css={(t) =>
              css({ color: t.colors.textMuted, fontSize: t.fontSizes.tiny })
            }
          >
            {channel.followerCount}
          </p>
        </div>
      }
      subtitle={<div>{channel.description}</div>}
      icon={
        <span>
          <Avatar url={channel.imageUrl} />
        </span>
      }
      size={channel.description ? "large" : "normal"}
    />
  );
};

export const FeedItem = () => {
  const link = `/feed`;

  return (
    <ListItem
      component={NavLink}
      to={link}
      className={({ isActive }) => (isActive ? "active" : "")}
      title={
        <div
          className="title"
          css={css({
            overflow: "hidden",
            textOverflow: "ellipsis",
          })}
        >
          Feed
        </div>
      }
      size="normal"
    />
  );
};

const CollapsibleSection = ({
  title,
  expanded,
  truncatedCount = 0,
  onToggleExpanded,
  onToggleTruncated,
  children,
}) => (
  <section style={{ marginBottom: expanded ? "1.8rem" : 0 }}>
    <div
      css={(t) =>
        css({
          margin: "0.6rem 0 0.2rem",
          padding: `0 0.8rem 0 calc( ${t.mainMenu.itemHorizontalPadding} + ${t.mainMenu.containerHorizontalPadding})`,
          minHeight: "2.4rem",
          display: "grid",
          alignItems: "center",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gridGap: "1rem",
        })
      }
    >
      <button
        onClick={onToggleExpanded}
        css={(theme) =>
          css({
            lineHeight: 1,
            padding: "0.2rem 0.4rem",
            marginLeft: "-0.4rem",
            color: "rgb(255 255 255 / 28.2%)",
            transition: "background 20ms ease-in, color 100ms ease-out",
            borderRadius: "0.3rem",
            cursor: "pointer",
            justifySelf: "flex-start",
            outline: "none",
            ":hover": {
              color: "rgb(255 255 255 / 56.5%)",
              background: theme.colors.backgroundModifierHover,
            },
            ":focus-visible": {
              color: "rgb(255 255 255 / 56.5%)",
              boxShadow: `0 0 0 0.2rem ${theme.colors.primary} inset`,
            },
          })
        }
      >
        <SmallText>{title}</SmallText>
      </button>
    </div>

    {expanded && (
      <>
        {children}
        {truncatedCount > 0 && (
          <ListItem
            component="button"
            onClick={onToggleTruncated}
            title={
              <SmallText css={css({ padding: "0 0.4rem" })}>
                {truncatedCount} more...
              </SmallText>
            }
          />
        )}
      </>
    )}
  </section>
);

const SmallText = ({ component: Component = "div", ...props }) => (
  <Component
    css={(t) =>
      css({
        fontSize: t.text.sizes.small,
        fontWeight: t.text.weights.emphasis,
        lineHeight: 1,
        color: t.colors.textMutedAlpha,
      })
    }
    {...props}
  />
);

export const MainLayout = ({ children }) => {
  const { fid } = useFarcasterAccount();
  const followedChannels = useFollowedChannels(fid);

  const farcasterChannels = useFarcasterChannels();

  const [remainingChannels, setRemainingChannels] = React.useState([]);

  const [allChannelsExpanded, setAllChannelsExpanded] = React.useState(true);
  const [visibleAllChannels, setVisibleAllChannels] = React.useState([]);
  const [searchParams, setSearchParams] = useSearchParams();

  const isDialogOpen = searchParams.get("auth-dialog") != null;

  const closeDialog = React.useCallback(() => {
    setSearchParams((params) => {
      const newParams = new URLSearchParams(params);
      newParams.delete("auth-dialog");
      newParams.delete("provider");
      return newParams;
    });
  }, [setSearchParams]);

  React.useEffect(() => {
    const followedChannelsIds = followedChannels?.map((c) => c.key);
    setRemainingChannels(
      farcasterChannels.filter(
        (channel) => !followedChannelsIds?.includes(channel.id)
      )
    );

    setVisibleAllChannels(farcasterChannels.slice(0, DEFAULT_TRUNCATED_COUNT));
  }, [farcasterChannels, followedChannels]);

  return (
    <>
      <SidebarLayout
        sidebarContent={
          <div
            css={(t) =>
              css({
                "--item-height": t.mainMenu.itemHeight,
                "--disabled-color": t.mainMenu.itemTextColorDisabled,
                ".list-item": {
                  padding: `0 ${t.mainMenu.containerHorizontalPadding}`,
                  "&:not(:last-of-type)": {
                    marginBottom: t.mainMenu.itemDistance,
                  },
                  "& > *": {
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    border: 0,
                    fontSize: t.fontSizes.default,
                    fontWeight: t.mainMenu.itemTextWeight,
                    textAlign: "left",
                    background: "transparent",
                    borderRadius: t.mainMenu.itemBorderRadius,
                    outline: "none",
                    color: t.mainMenu.itemTextColor,
                    padding: `0.2rem ${t.mainMenu.itemHorizontalPadding}`,
                    paddingLeft: `calc(${t.mainMenu.itemHorizontalPadding} + var(--indentation-level) * 2.2rem)`,
                    textDecoration: "none",
                    lineHeight: 1.3,
                    margin: "0.1rem 0",
                    "&.active": {
                      color: t.colors.textNormal,
                      background: t.colors.backgroundModifierHover,
                    },
                    ".icon-container": {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "1.8rem",
                    },
                    ".icon-container > *": {
                      color: t.colors.textMuted,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    },
                    ".title-container": {
                      flex: 1,
                      minWidth: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                    ".subtitle-container": {
                      color: t.colors.textMuted,
                      fontSize: t.text.sizes.small,
                      fontWeight: t.text.weights.normal,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                    "@media (hover: hover)": {
                      ":not(:disabled)": {
                        cursor: "pointer",
                      },
                      ":not(:disabled,&.active):hover": {
                        background: t.colors.backgroundModifierHover,
                      },
                    },
                    ":focus-visible": {
                      boxShadow: t.shadows.focus,
                    },
                  },
                },
              })
            }
          >
            <div
              style={{
                height: "2rem",
              }}
            />

            <FarcasterProfile />

            <div
              style={{
                height: "2rem",
              }}
            />

            <FeedItem />

            {fid && (
              <>
                <div
                  style={{
                    height: "2rem",
                  }}
                />
                <CollapsibleSection
                  key="star"
                  title="Followed Channels"
                  expanded={true}
                >
                  {followedChannels?.map((c) => (
                    <ChannelItem key={`star-${c.key}`} channel={c} />
                  ))}
                </CollapsibleSection>
              </>
            )}

            <div
              style={{
                height: "2rem",
              }}
            />

            <CollapsibleSection
              key="fc"
              title="All Channels"
              expanded={allChannelsExpanded}
              truncatedCount={
                remainingChannels.length - visibleAllChannels.length
              }
              onToggleExpanded={() =>
                setAllChannelsExpanded(!allChannelsExpanded)
              }
              onToggleTruncated={() => setVisibleAllChannels(remainingChannels)}
            >
              {visibleAllChannels.map((c) => (
                <ChannelItem key={`fc-${c.id}`} channel={c} />
              ))}
            </CollapsibleSection>
          </div>
        }
      >
        {children}
        {isDialogOpen && (
          <Dialog
            isOpen={isDialogOpen}
            onRequestClose={closeDialog}
            width="76rem"
          >
            {({ titleProps }) => (
              <ErrorBoundary
                fallback={() => {
                  // window.location.reload();
                }}
              >
                <React.Suspense fallback={null}>
                  <AuthDialog titleProps={titleProps} dismiss={closeDialog} />
                </React.Suspense>
              </ErrorBoundary>
            )}
          </Dialog>
        )}
        <ErrorBoundary fallback={() => window.location.reload()}>
          <React.Suspense fallback={null}>
            <Outlet />
          </React.Suspense>
        </ErrorBoundary>
      </SidebarLayout>
    </>
  );
};
