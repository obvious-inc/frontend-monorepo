import isToday from "date-fns/isToday";
import isYesterday from "date-fns/isYesterday";
import Pusher from "pusher-js";
import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  NavLink,
  Outlet,
} from "react-router-dom";
import { ThemeProvider, useTheme, css } from "@emotion/react";
import {
  WagmiConfig,
  createClient as createWagmiClient,
  configureChains as configureWagmiChains,
} from "wagmi";
import { mainnet as mainnetChain } from "wagmi/chains";
import { infuraProvider } from "wagmi/providers/infura";
import { publicProvider } from "wagmi/providers/public";
import { InjectedConnector } from "wagmi/connectors/injected";
import { WalletConnectConnector } from "wagmi/connectors/walletConnect";
import {
  array as arrayUtils,
  ethereum as ethereumUtils,
} from "@shades/common/utils";
import {
  ServerConnectionProvider,
  useActions,
  useAuth,
  useMe,
  useChannel,
  useChannelMembers,
  useMemberChannels,
  useMessage,
  useSortedChannelMessageIds,
  useHasFetchedUserChannels,
} from "@shades/common/app";
import {
  useWallet,
  useWalletLogin,
  WalletLoginProvider,
} from "@shades/common/wallet";
import theme from "@shades/ui-web/theme";
import {
  Provider as SidebarProvider,
  Layout as SidebarLayout,
} from "@shades/ui-web/sidebar-layout";
import Button from "@shades/ui-web/button";
import Avatar from "@shades/ui-web/avatar";
import {
  DoubleChevronLeft as DoubleChevronLeftIcon,
  Checkmark as CheckmarkIcon,
  DotsHorizontal as DotsHorizontalIcon,
} from "@shades/ui-web/icons";
import NewMessageDialog from "./components/new-messaage-dialog.js";
import MainHeader from "./components/main-header.js";
import HeaderItem from "./components/header-item.js";
import FormattedDate from "./components/formatted-date.js";
import UserAvatar from "./components/user-avatar.js";
import IconButton from "./components/icon-button.js";

const Channel = React.lazy(() => import("./components/channel.js"));

const { reverse } = arrayUtils;
const { truncateAddress } = ethereumUtils;

const ChannelMembersAvatar = ({ id, ...props }) => {
  const me = useMe();
  const memberUsers = useChannelMembers(id);
  const memberUsersExcludingMe = memberUsers.filter(
    (u) => u.id !== me.id && u.walletAddress != null
  );
  const isFetchingMembers = memberUsersExcludingMe.some(
    (m) => m.walletAddress == null
  );

  if (isFetchingMembers) return <Avatar {...props} />;

  if (memberUsersExcludingMe.length <= 1) {
    const member = memberUsersExcludingMe[0] ?? memberUsers[0];
    return <UserAvatar walletAddress={member.walletAddress} {...props} />;
  }

  const avatarOffset = `calc(${props.size} / 5)`;
  const avatarSize = `calc(100% - ${props.size} / 5)`;

  return (
    <div
      style={{
        width: props.size,
        height: props.size,
        position: "relative",
      }}
    >
      {reverse(memberUsersExcludingMe.slice(0, 2)).map((user, i) => (
        <UserAvatar
          key={user.walletAddress}
          walletAddress={user.walletAddress}
          {...props}
          css={css({
            position: "absolute",
            top: i === 0 ? avatarOffset : 0,
            left: i === 0 ? avatarOffset : 0,
            width: avatarSize,
            height: avatarSize,
            filter: i === 0 ? "brightness(0.8)" : undefined,
            // boxShadow: i !== 0 ? `1px 1px 0 0px rgb(0 0 0 / 30%)` : undefined,
          })}
        />
      ))}
    </div>
  );
};

const EmptyChannelList = ({ children }) => (
  <div
    css={(t) =>
      css({
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: t.colors.textDimmed,
      })
    }
  >
    <div>{children}</div>
  </div>
);

const Inbox = () => {
  const filter = React.useCallback((c) => c.hasUnread, []);
  return <InboxChannelList filter={filter} emptyFallback="No new messages" />;
};

const Archive = () => {
  const filter = React.useCallback((c) => !c.hasUnread, []);
  return (
    <InboxChannelList filter={filter} emptyFallback="No archived messages" />
  );
};

const InboxLayout = () => {
  const [showNewMessageDialog, setShowNewMessageDialog] = React.useState(false);
  const channels = useMemberChannels({ readStates: true });
  const unreadCount = channels.filter((c) => c.hasUnread).length;

  return (
    <>
      <div
        css={(t) =>
          css({
            position: "relative",
            zIndex: 0,
            flex: 1,
            minWidth: "min(30.6rem, 100vw)",
            background: t.colors.backgroundPrimary,
            display: "flex",
            flexDirection: "column",
            height: "100%",
          })
        }
      >
        <MainHeader sidebarToggle>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              alignItems: "center",
            }}
          >
            <HeaderItem
              component={NavLink}
              to="/"
              label="Inbox"
              count={unreadCount}
            />
            <HeaderItem component={NavLink} to="/archive" label="Archive" />
          </div>
          <div
            css={(t) =>
              css({
                display: "grid",
                gridAutoColumns: "auto",
                gridAutoFlow: "column",
                gridGap: "2rem",
                alignItems: "center",
                color: t.colors.textNormal,
              })
            }
          >
            {/* <MagnificationGlassIcon */}
            {/*   css={(t) => */}
            {/*     css({ */}
            {/*       width: "1.6rem", */}
            {/*       height: "auto", */}
            {/*       color: t.colors.textDimmed, */}
            {/*     }) */}
            {/*   } */}
            {/* /> */}
            <svg
              viewBox="0 0 17 17"
              style={{
                display: "block",
                width: "1.6rem",
                height: "auto",
              }}
            >
              <path
                d="M6.78027 13.6729C8.24805 13.6729 9.60156 13.1982 10.709 12.4072L14.875 16.5732C15.0684 16.7666 15.3232 16.8633 15.5957 16.8633C16.167 16.8633 16.5713 16.4238 16.5713 15.8613C16.5713 15.5977 16.4834 15.3516 16.29 15.1582L12.1504 11.0098C13.0205 9.86719 13.5391 8.45215 13.5391 6.91406C13.5391 3.19629 10.498 0.155273 6.78027 0.155273C3.0625 0.155273 0.0214844 3.19629 0.0214844 6.91406C0.0214844 10.6318 3.0625 13.6729 6.78027 13.6729ZM6.78027 12.2139C3.87988 12.2139 1.48047 9.81445 1.48047 6.91406C1.48047 4.01367 3.87988 1.61426 6.78027 1.61426C9.68066 1.61426 12.0801 4.01367 12.0801 6.91406C12.0801 9.81445 9.68066 12.2139 6.78027 12.2139Z"
                fill="currentColor"
              />
            </svg>
            <Button
              variant="primary"
              size="small"
              onClick={() => {
                setShowNewMessageDialog(true);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                width: "3.4rem",
                height: "3.4rem",
                borderRadius: "50%",
              }}
            >
              <ComposeIcon
                style={{
                  display: "block",
                  width: "2.1rem",
                  height: "auto",
                  margin: "auto",
                }}
              />
            </Button>
          </div>
        </MainHeader>
        <Outlet />
      </div>

      <NewMessageDialog
        isOpen={showNewMessageDialog}
        close={() => {
          setShowNewMessageDialog(false);
        }}
      />
    </>
  );
};

const InboxChannelList = ({ filter, emptyFallback }) => {
  const hasFetchedChannels = useHasFetchedUserChannels();
  const channels = useMemberChannels({ readStates: true });

  const channelIds = React.useMemo(
    () => channels.filter(filter).map((c) => c.id),
    [channels, filter]
  );

  if (hasFetchedChannels && channelIds.length === 0)
    return <EmptyChannelList>{emptyFallback}</EmptyChannelList>;

  return (
    <div
      css={css({
        position: "relative",
        flex: 1,
        display: "flex",
        minHeight: 0,
        minWidth: 0,
      })}
    >
      <div
        css={css({
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflowY: "scroll",
          overflowX: "hidden",
          minHeight: 0,
          flex: 1,
          overflowAnchor: "none",
        })}
      >
        <div
          css={css({
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "stretch",
            minHeight: "100%",
          })}
        >
          {channelIds.map((id) => (
            <ChannelItem key={id} id={id} />
          ))}
        </div>
      </div>
    </div>
  );
};

const ChannelItem = ({ id }) => {
  const theme = useTheme();

  const { fetchMessages, markChannelRead } = useActions();
  const me = useMe();
  const channel = useChannel(id, { readStates: true, name: true });
  const members = useChannelMembers(id);
  const messageIds = useSortedChannelMessageIds(id);
  const message = useMessage(messageIds.slice(-1)[0]);

  const membersExcludingMe = members.filter(
    (m) => m.walletAddress !== me.walletAddress && m.walletAddress != null
  );

  React.useEffect(() => {
    fetchMessages(id, { limit: 1 });
  }, [fetchMessages, id]);

  return (
    <div
      css={() => {
        const hoverColor = "hsl(0 100% 100% / 6%)";
        return css({
          ":after": {
            content: '""',
            display: "block",
            width: "100%",
            // width: "calc(100% - 4rem)",
            // borderBottom: "0.1rem solid",
            // borderColor: t.colors.borderLight,
            height: "1px",
            background: `linear-gradient(90deg, transparent 0%, ${hoverColor} 20%, ${hoverColor} 80%, transparent 100%)`,
          },
        });
      }}
    >
      <Link
        to={`/c/${id}`}
        css={() => {
          const hoverColor = "hsl(0 100% 100% / 2%)";
          return css({
            display: "block",
            color: "inherit",
            textDecoration: "none",
            padding: "1rem 2rem",
            ":hover": {
              background: `linear-gradient(90deg, transparent 0%, ${hoverColor} 20%, ${hoverColor} 80%, transparent 100%)`,
            },
            "@media (hover: hover)": {
              ".hover-actions": { display: "none" },
              ":hover .hover-actions": { display: "grid" },
            },
          });
        }}
      >
        <div
          css={css({
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) 6rem",
            alignItems: "center",
            gridGap: "1rem",
            ".sender": { display: "none" },
            "@media (min-width: 600px)": {
              gridTemplateColumns: "21rem minmax(0,1fr) 6rem",
              ".sender": { display: "flex" },
            },
          })}
        >
          <div className="sender" style={{ alignItems: "center" }}>
            <ChannelMembersAvatar
              id={id}
              size="2.6rem"
              background={theme.colors.backgroundTertiary}
            />
            <div
              css={(t) =>
                css({
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  flex: 1,
                  minWidth: 0,
                  fontSize: t.fontSizes.default,
                  color: t.colors.textDimmed,
                  marginLeft: "1rem",
                })
              }
            >
              {membersExcludingMe.length > 3
                ? `${members.length} participants`
                : membersExcludingMe
                    .map(
                      (u) => u.displayName ?? truncateAddress(u.walletAddress)
                    )
                    .join(", ")}
            </div>
          </div>
          <div
            css={(t) =>
              css({
                display: "flex",
                alignItems: "center",
                fontSize: t.fontSizes.large,
              })
            }
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                css={(t) =>
                  css({
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontWeight: channel.hasUnread ? "500" : undefined,
                    color: channel.hasUnread
                      ? t.colors.textNormal
                      : t.colors.textDimmed,
                  })
                }
              >
                {channel.name}
              </span>
              <div
                css={(t) =>
                  css({
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: t.colors.textMuted,
                    fontSize: t.fontSizes.default,
                  })
                }
              >
                {message?.author?.displayName != null && (
                  <>{message.author.displayName}: </>
                )}
                {message?.stringContent || "..."}
              </div>
            </div>
            <div
              className="hover-actions"
              css={css({
                display: "grid",
                gridAutoColumns: "auto",
                gridAutoFlow: "column",
                gridGap: "0.8rem",
                marginLeft: "1rem",
              })}
            >
              {channel.hasUnread && (
                <IconButton
                  component="div"
                  role="button"
                  onClick={(e) => {
                    e.preventDefault();
                    markChannelRead(id);
                  }}
                >
                  <CheckmarkIcon
                    css={(t) =>
                      css({
                        width: "1.3rem",
                        height: "auto",
                        color: t.colors.textDimmed,
                      })
                    }
                  />
                </IconButton>
              )}
              <IconButton
                component="div"
                role="button"
                onClick={(e) => {
                  e.preventDefault();
                }}
              >
                <DotsHorizontalIcon
                  css={(t) =>
                    css({
                      width: "2rem",
                      height: "auto",
                      color: t.colors.textDimmed,
                    })
                  }
                />
              </IconButton>
            </div>
          </div>
          <div
            css={(t) =>
              css({
                textAlign: "right",
                fontSize: t.fontSizes.small,
                color: t.colors.textMuted,
              })
            }
          >
            {message &&
              (isToday(new Date(message.createdAt)) ? (
                <FormattedDate
                  value={new Date(message.createdAt)}
                  hour="numeric"
                  minute="numeric"
                />
              ) : isYesterday(new Date(message.createdAt)) ? (
                "Yesterday"
              ) : (
                <FormattedDate
                  value={new Date(message.createdAt)}
                  month="short"
                  day="numeric"
                />
              ))}
          </div>
        </div>
      </Link>
    </div>
  );
};

const RootLayout = () => {
  const me = useMe();
  const theme = useTheme();

  if (me == null) return null;

  return (
    <SidebarLayout
      headerHeight={theme.mainHeader.height}
      header={({
        toggle: toggleMenu,
        isFloating: isMenuFloating,
        isCollapsed: isMenuCollapsed,
        isHoveringSidebar: isHoveringMenu,
      }) => (
        <button
          css={(theme) =>
            css({
              width: "100%",
              display: "grid",
              gridTemplateColumns: "auto minmax(0,1fr) auto",
              gridGap: "1rem",
              alignItems: "center",
              padding: "0.2rem 2rem",
              height: "100%",
              cursor: "pointer",
              transition: "20ms ease-in",
              outline: "none",
              ":hover": {
                background: theme.colors.backgroundModifierHover,
              },
              ":focus-visible": {
                boxShadow: `0 0 0 0.2rem ${theme.colors.primary} inset`,
              },
            })
          }
        >
          <div
            css={css({
              width: "3rem",
              height: "3rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <UserAvatar
              walletAddress={me.walletAddress}
              size="3rem"
              background={theme.colors.backgroundModifierHover}
            />
          </div>
          <div>
            <div
              css={(theme) =>
                css({
                  color: theme.colors.textNormal,
                  fontSize: theme.fontSizes.default,
                  fontWeight: theme.text.weights.header,
                  lineHeight: "2rem",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                })
              }
            >
              {me.displayName}
            </div>
            <div
              css={(theme) =>
                css({
                  color: theme.colors.textDimmed,
                  fontSize: theme.fontSizes.small,
                  fontWeight: "400",
                  lineHeight: "1.2rem",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                })
              }
            >
              {truncateAddress(me.walletAddress)}
            </div>
          </div>
          <div css={css({ display: "flex", alignItems: "center" })}>
            <div css={css({ width: "1.2rem", height: "1.2rem" })}>
              <svg
                viewBox="-1 -1 9 11"
                style={{ width: "100%", height: "100%" }}
                css={(theme) =>
                  css({ display: "block", fill: theme.colors.textMuted })
                }
              >
                <path d="M 3.5 0L 3.98809 -0.569442L 3.5 -0.987808L 3.01191 -0.569442L 3.5 0ZM 3.5 9L 3.01191 9.56944L 3.5 9.98781L 3.98809 9.56944L 3.5 9ZM 0.488094 3.56944L 3.98809 0.569442L 3.01191 -0.569442L -0.488094 2.43056L 0.488094 3.56944ZM 3.01191 0.569442L 6.51191 3.56944L 7.48809 2.43056L 3.98809 -0.569442L 3.01191 0.569442ZM -0.488094 6.56944L 3.01191 9.56944L 3.98809 8.43056L 0.488094 5.43056L -0.488094 6.56944ZM 3.98809 9.56944L 7.48809 6.56944L 6.51191 5.43056L 3.01191 8.43056L 3.98809 9.56944Z" />
              </svg>
            </div>
            {(isMenuFloating || (!isMenuCollapsed && isHoveringMenu)) && (
              <div
                role="button"
                tabIndex={0}
                onPointerDown={(e) => {
                  e.preventDefault();
                  toggleMenu();
                }}
                css={(t) =>
                  css({
                    width: "2.4rem",
                    height: "2.4rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: "0.7rem",
                    marginRight: "-0.4rem",
                    borderRadius: "0.3rem",
                    color: t.colors.textMuted,
                    ":hover": {
                      color: t.colors.textNormal,
                      background: t.colors.backgroundModifierHover,
                    },
                  })
                }
              >
                <DoubleChevronLeftIcon
                  css={css({
                    position: "relative",
                    right: "1px",
                    width: "1.6rem",
                    height: "1.6rem",
                  })}
                />
              </div>
            )}
          </div>
        </button>
      )}
    >
      <Outlet />
    </SidebarLayout>
  );
};

// const ListItem = ({
//   component: Component = "button",
//   compact = true,
//   indendationLevel = 0,
//   title,
//   disabled,
//   ...props
// }) => (
//   <div
//     css={(theme) => css`
//       padding: 0 ${theme.mainMenu.containerHorizontalPadding};

//       &:not(:last-of-type) {
//         margin-bottom: ${theme.mainMenu.itemDistance};
//       }
//       & > * {
//         display: flex;
//         align-items: center;
//         width: 100%;
//         border: 0;
//         font-size: ${theme.fontSizes.default};
//         font-weight: ${theme.mainMenu.itemTextWeight};
//         text-align: left;
//         background: transparent;
//         border-radius: ${theme.mainMenu.itemBorderRadius};
//         cursor: pointer;
//         outline: none;
//         color: ${disabled
//           ? theme.mainMenu.itemTextColorDisabled
//           : theme.mainMenu.itemTextColor};
//         padding: 0.2rem ${theme.mainMenu.itemHorizontalPadding};
//         padding-left: calc(
//           ${theme.mainMenu.itemHorizontalPadding} + ${indendationLevel} * 2.2rem
//         );
//         text-decoration: none;
//         line-height: 1.3;
//         height: ${theme.mainMenu.itemHeight};
//         margin: 0.1rem 0;
//         pointer-events: ${disabled ? "none" : "all"};
//       }
//       & > *.active {
//         background: ${theme.colors.backgroundModifierSelected};
//       }
//       & > *:not(.active):hover {
//         background: ${theme.colors.backgroundModifierHover};
//       }
//       & > *.active {
//         color: ${theme.colors.textNormal};
//       }
//       & > *:focus-visible {
//         box-shadow: 0 0 0 0.2rem ${theme.colors.primary};
//       }
//     `}
//   >
//     <Component {...props}>
//       <div
//         css={css({
//           display: "flex",
//           alignItems: "center",
//           justifyContent: "center",
//           width: "2.2rem",
//           height: "1.8rem",
//           marginRight: compact ? "0.4rem" : "0.8rem",
//         })}
//       >
//         <div
//           css={(theme) =>
//             css({
//               color: disabled
//                 ? "rgb(255 255 255 / 22%)"
//                 : theme.colors.textMuted,
//               background: theme.colors.backgroundModifierHover,
//               borderRadius: "50%",
//               display: "flex",
//               alignItems: "center",
//               justifyContent: "center",
//               width: "2rem",
//               height: "2rem",
//             })
//           }
//         >
//           {/* {icon} */}
//         </div>
//       </div>
//       <div
//         style={{
//           flex: 1,
//           minWidth: 0,
//           whiteSpace: "nowrap",
//           overflow: "hidden",
//           textOverflow: "ellipsis",
//         }}
//       >
//         {title}
//       </div>
//     </Component>
//   </div>
// );

const LoginScreen = () => {
  const {
    connect: connectWallet,
    cancel: cancelWalletConnectionAttempt,
    canConnect: canConnectWallet,
    accountAddress,
    isConnecting,
  } = useWallet();

  const { login, status: loginStatus } = useWalletLogin();

  return (
    <div
      css={(t) =>
        css({
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: t.colors.textDimmed,
        })
      }
    >
      <div>
        {accountAddress == null && isConnecting ? (
          <>
            <div style={{ textAlign: "center" }}>
              Requesting wallet address...
            </div>
            <Button
              onClick={cancelWalletConnectionAttempt}
              style={{ display: "block", margin: "2rem auto 0" }}
            >
              Cancel
            </Button>
          </>
        ) : loginStatus === "requesting-signature" ? (
          <>Requesting signature from {truncateAddress(accountAddress)}</>
        ) : loginStatus === "requesting-access-token" ? (
          <>Logging in...</>
        ) : (
          <>
            {accountAddress == null ? (
              <Button
                variant="primary"
                disabled={!canConnectWallet}
                onClick={connectWallet}
              >
                Connect wallet
              </Button>
            ) : (
              <>
                <div style={{ marginBottom: "2rem", textAlign: "center" }}>
                  Connected as {truncateAddress(accountAddress)}
                </div>
                <Button
                  variant="primary"
                  onClick={() => {
                    login(accountAddress);
                  }}
                >
                  Verify with wallet signature
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const ComposeIcon = (props) => (
  <svg viewBox="0 0 64 64" {...props}>
    <path
      fillRule="evenodd"
      d="M52.47 16.78v0c-.3.29-.77.29-1.07 0l-4.2-4.18v0c-.3-.3-.3-.77-.01-1.06 0-.01 0-.01 0-.01l2.89-2.89h0c.87-.88 2.3-.88 3.18 0l2.06 2.06v-.001c.87.87.87 2.28 0 3.16 -.01 0-.01 0-.01 0Zm-22.72 21.7l-5.05 1.51v0c-.3.08-.62-.08-.7-.38 -.04-.11-.04-.22-.001-.33l1.51-5.06v0c.28-.96.8-1.82 1.5-2.52l17.5-17.52v-.001c.29-.3.76-.3 1.06 0l4.18 4.19v0c.29.29.29.76 0 1.061L32.23 36.94v0c-.71.7-1.57 1.22-2.53 1.5ZM52 29.01v17 0c-.01 3.31-2.69 5.99-6 6H18v0c-3.32-.01-6-2.69-6-6.01V17.99v0c0-3.32 2.68-6 6-6.01h17v0c1.1 0 2 .89 2 2 0 1.1-.9 2-2.01 2h-17v0c-1.11 0-2 .89-2 2v28 0c0 1.1.89 1.99 2 2h28 0c1.1-.01 1.99-.9 2-2.01V28.96v0c0-1.11.89-2 2-2 1.1 0 2 .89 2 2Z"
      fill="currentColor"
    />
  </svg>
);

const RequireAuth = ({ children }) => {
  const { status: authStatus } = useAuth();

  if (authStatus === "not-authenticated") return <LoginScreen />;

  if (authStatus !== "authenticated") return null; // Spinner

  return children;
};

const { chains, provider } = configureWagmiChains(
  [mainnetChain],
  [infuraProvider({ apiKey: process.env.INFURA_PROJECT_ID }), publicProvider()]
);

const wagmiClient = createWagmiClient({
  autoConnect: true,
  provider,
  connectors: [
    new InjectedConnector({ chains }),
    new WalletConnectConnector({
      chains,
      options: { qrcode: true },
    }),
  ],
});

const customTheme = {
  ...theme,
  mainHeader: {
    ...theme.mainHeader,
    height: "6.2rem",
  },
};

const App = () => {
  const { login } = useAuth();
  return (
    <BrowserRouter>
      <WagmiConfig client={wagmiClient}>
        <ServerConnectionProvider
          Pusher={Pusher}
          pusherKey={process.env.PUSHER_KEY}
        >
          <WalletLoginProvider authenticate={login}>
            <ThemeProvider theme={customTheme}>
              <SidebarProvider initialIsOpen={false}>
                <RequireAuth>
                  <Routes>
                    <Route path="/" element={<RootLayout />}>
                      <Route element={<InboxLayout />}>
                        <Route index element={<Inbox />} />
                        <Route path="/archive" element={<Archive />} />
                      </Route>
                      <Route path="/c/:channelId" element={<Channel />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </RequireAuth>
              </SidebarProvider>
            </ThemeProvider>
          </WalletLoginProvider>
        </ServerConnectionProvider>
      </WagmiConfig>
    </BrowserRouter>
  );
};

export default App;
