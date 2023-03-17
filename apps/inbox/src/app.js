import isToday from "date-fns/isToday";
import isYesterday from "date-fns/isYesterday";
import Pusher from "pusher-js";
import React from "react";
import { ThemeProvider, css } from "@emotion/react";
import { useDateFormatter } from "react-aria";
import {
  WagmiConfig,
  createClient as createWagmiClient,
  configureChains as configureWagmiChains,
  useEnsAvatar as useWagmiEnsAvatar,
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
  useAuth,
  useMe,
  useChannel,
  useChannelMembers,
  useMemberChannels,
  useChannelMessages,
  useEnsAvatar,
  useUserWithWalletAddress,
} from "@shades/common/app";
import {
  useWallet,
  useWalletLogin,
  WalletLoginProvider,
} from "@shades/common/wallet";
import theme from "@shades/design-system/theme";
import {
  Provider as SidebarProvider,
  Layout as SidebarLayout,
} from "@shades/design-system/sidebar-layout";
import Button from "@shades/design-system/button";
import Avatar from "@shades/design-system/avatar";

const { reverse } = arrayUtils;
const { truncateAddress } = ethereumUtils;

const FormattedDate = ({ value, ...options }) => {
  const formatter = useDateFormatter(options);
  return formatter.format(value);
};

const usePlaceholderAvatar = (
  walletAddress,
  { enabled = true, transparent = false } = {}
) => {
  const [generatedPlaceholderAvatarUrl, setGeneratedPlaceholderAvatarUrl] =
    React.useState(null);

  React.useEffect(() => {
    if (!enabled || walletAddress == null) return;
    import("@shades/common/nouns").then((module) =>
      module
        .generatePlaceholderAvatarDataUri(walletAddress, { transparent })
        .then((url) => {
          setGeneratedPlaceholderAvatarUrl(url);
        })
    );
  }, [enabled, transparent, walletAddress]);

  return generatedPlaceholderAvatarUrl;
};

const UserAvatar = React.forwardRef(
  ({ walletAddress, highRes, transparent, ...props }, ref) => {
    const user = useUserWithWalletAddress(walletAddress);
    const userCustomAvatarUrl =
      user?.profilePicture?.[highRes ? "large" : "small"];
    const cachedEnsAvatarUrl = useEnsAvatar(walletAddress);

    const { data: fetchedEnsAvatarUrl, isLoading: isLoadingEnsAvatar } =
      useWagmiEnsAvatar({
        addressOrName: walletAddress,
        enabled: userCustomAvatarUrl == null && cachedEnsAvatarUrl == null,
      });

    const ensAvatarUrl = fetchedEnsAvatarUrl ?? cachedEnsAvatarUrl;

    const enablePlaceholder =
      userCustomAvatarUrl == null && ensAvatarUrl == null;

    const placeholderAvatarUrl = usePlaceholderAvatar(walletAddress, {
      enabled: enablePlaceholder,
      transparent,
    });

    const isLoadingPlaceholder =
      enablePlaceholder && placeholderAvatarUrl == null;

    const imageUrl =
      userCustomAvatarUrl ?? ensAvatarUrl ?? placeholderAvatarUrl;

    return (
      <Avatar
        ref={ref}
        url={imageUrl}
        isLoading={isLoadingEnsAvatar || isLoadingPlaceholder}
        signature={user?.displayName ?? user?.walletAddress.slice(2)}
        {...props}
      />
    );
  }
);

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
            top: i === 0 ? "3px" : 0,
            left: i === 0 ? "3px" : 0,
            width: "calc(100% - 3px)",
            height: "calc(100% - 3px)",
            boxShadow: i !== 0 ? `1px 1px 0 0px rgb(0 0 0 / 30%)` : undefined,
          })}
        />
      ))}
    </div>
  );
};

const Inbox = () => {
  const channels = useMemberChannels();

  return (
    <div
      css={(theme) => css`
        position: relative;
        z-index: 0;
        flex: 1;
        min-width: min(30.6rem, 100vw);
        background: ${theme.colors.backgroundPrimary};
        display: flex;
        flex-direction: column;
        height: 100%;
      `}
    >
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
              justifyContent: "flex-end",
              alignItems: "stretch",
              minHeight: "100%",
            })}
          >
            {channels.map((c) => (
              <ChannelItem key={c.id} id={c.id} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ChannelItem = ({ id }) => {
  const me = useMe();
  const channel = useChannel(id, { readStates: true, name: true });
  const members = useChannelMembers(id);
  const messages = useChannelMessages(id);

  const membersExcludingMe = members.filter(
    (m) => m.walletAddress !== me.walletAddress && m.walletAddress != null
  );

  const message = messages[0];

  return (
    <a
      href={`https://app.newshades.xyz/channels/${id}`}
      css={(t) =>
        css({
          color: "inherit",
          textDecoration: "none",
          padding: "1.5rem 2rem",
          borderBottom: "0.1rem solid",
          borderColor: t.colors.borderLight,
          ":hover": { background: "rgb(255 255 255 / 2%)" },
        })
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "18rem minmax(0,1fr) auto",
          alignItems: "center",
          gridGap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <ChannelMembersAvatar id={id} size="2.2rem" />
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
                marginLeft: "0.7rem",
              })
            }
          >
            {membersExcludingMe.length > 3
              ? `${members.length} participants`
              : membersExcludingMe
                  .map((u) => u.displayName ?? truncateAddress(u.walletAddress))
                  .join(", ")}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            css={(t) =>
              css({
                marginRight: "1rem",
                color: channel.hasUnread ? undefined : t.colors.textDimmed,
              })
            }
          >
            {channel.name}
          </div>

          <div
            css={(t) =>
              css({
                fontSize: t.fontSizes.small,
                color: t.colors.textDimmed,
                flex: 1,
                minWidth: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              })
            }
          >
            {message != null && (
              <>
                {message.author != null && <>{message.author.displayName}: </>}
                {message.stringContent}
              </>
            )}
          </div>
        </div>
        <div
          css={(t) =>
            css({ fontSize: t.fontSizes.small, color: t.colors.textDimmed })
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
    </a>
  );
};

const Layout = ({ children }) => {
  const me = useMe();

  if (me == null) return null;

  return (
    <SidebarLayout
      header={({ toggle: toggleMenu }) => (
        <button
          css={(theme) =>
            css({
              width: "100%",
              display: "grid",
              gridTemplateColumns: "auto minmax(0,1fr) auto",
              gridGap: "0.8rem",
              alignItems: "center",
              padding: "0.2rem 1.4rem",
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
              width: "2.2rem",
              height: "2.2rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: "1px",
            })}
          >
            <div
              style={{
                userSelect: "none",
                display: "flex",
                alignCtems: "center",
                justifyContent: "center",
                height: "2rem",
                width: "2rem",
                marginTop: "1px",
              }}
            >
              <div
                css={(t) =>
                  css({
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: t.colors.backgroundModifierHover,
                    overflow: "hidden",
                  })
                }
              >
                <img
                  src={me.profilePicture?.small}
                  style={{ display: "block", height: "100%", width: "100%" }}
                />
              </div>
            </div>
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
              {me.walletAddress}
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
            {toggleMenu != null && (
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
                {/* <DoubleChevronLeftIcon */}
                {/*   css={css({ */}
                {/*     position: "relative", */}
                {/*     right: "1px", */}
                {/*     width: "1.6rem", */}
                {/*     height: "1.6rem", */}
                {/*   })} */}
                {/* /> */}
              </div>
            )}
          </div>
        </button>
      )}
      sidebarContent={
        <>
          <div style={{ height: "1.5rem" }} />
          <div
            css={css({
              display: "flex",
              alignItems: "center",
              padding: "0 1.4rem",
            })}
          >
            <input
              readOnly
              value="Search..."
              css={(t) =>
                css({
                  outline: "none",
                  color: t.colors.textDimmed,
                  background: t.colors.backgroundModifierHover,
                  fontSize: t.fontSizes.default,
                  border: 0,
                  padding: "0.5rem 1.1rem",
                  borderRadius: "0.5rem",
                  width: "100%",
                })
              }
            />
          </div>
          <div style={{ height: "2rem" }} />
          <ListItem compact={false} title="Inbox" />
          <ListItem compact={false} title="Drafts" />
          <ListItem compact={false} title="Sent" />
          <ListItem compact={false} title="Starred" />
        </>
      }
      sidebarBottomContent={({ toggle: toggleMenu }) => (
        <button
          css={(theme) =>
            css({
              transition: "background 20ms ease-in",
              cursor: "pointer",
              boxShadow: "rgba(255, 255, 255, 0.094) 0 -1px 0",
              outline: "none",
              ":hover": {
                background: theme.colors.backgroundModifierHover,
              },
              ":focus-visible": {
                boxShadow: `0 0 0 0.2rem ${theme.colors.primary} inset`,
              },
            })
          }
          onClick={() => {
            toggleMenu();
          }}
        >
          <div
            css={css({
              display: "flex",
              alignItems: "center",
              width: "100%",
              padding: "0.2rem 1rem",
              height: "4.5rem",
            })}
          >
            <div
              css={css({
                width: "2.2rem",
                height: "2.2rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "0.8rem",
              })}
            >
              <svg
                viewBox="0 0 16 16"
                css={(theme) =>
                  css({
                    width: "1.6rem",
                    height: "1.6rem",
                    display: "block",
                    fill: theme.colors.textDimmed,
                  })
                }
              >
                <path d="M7.977 14.963c.407 0 .747-.324.747-.723V8.72h5.362c.399 0 .74-.34.74-.747a.746.746 0 00-.74-.738H8.724V1.706c0-.398-.34-.722-.747-.722a.732.732 0 00-.739.722v5.529h-5.37a.746.746 0 00-.74.738c0 .407.341.747.74.747h5.37v5.52c0 .399.332.723.739.723z" />
              </svg>
            </div>
            <div
              css={(theme) =>
                css({
                  flex: "1 1 auto",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: theme.colors.textDimmed,
                  fontSize: "1.4rem",
                  fontWeight: "500",
                })
              }
            >
              New Message
            </div>
          </div>
        </button>
      )}
    >
      {children}
    </SidebarLayout>
  );
};

const ListItem = ({
  component: Component = "button",
  compact = true,
  indendationLevel = 0,
  title,
  disabled,
  ...props
}) => (
  <div
    css={(theme) => css`
      padding: 0 ${theme.mainMenu.containerHorizontalPadding};

      &:not(:last-of-type) {
        margin-bottom: ${theme.mainMenu.itemDistance};
      }
      & > * {
        display: flex;
        align-items: center;
        width: 100%;
        border: 0;
        font-size: ${theme.fontSizes.default};
        font-weight: ${theme.mainMenu.itemTextWeight};
        text-align: left;
        background: transparent;
        border-radius: ${theme.mainMenu.itemBorderRadius};
        cursor: pointer;
        outline: none;
        color: ${disabled
          ? theme.mainMenu.itemTextColorDisabled
          : theme.mainMenu.itemTextColor};
        padding: 0.2rem ${theme.mainMenu.itemHorizontalPadding};
        padding-left: calc(
          ${theme.mainMenu.itemHorizontalPadding} + ${indendationLevel} * 2.2rem
        );
        text-decoration: none;
        line-height: 1.3;
        height: ${theme.mainMenu.itemHeight};
        margin: 0.1rem 0;
        pointer-events: ${disabled ? "none" : "all"};
      }
      & > *.active {
        background: ${theme.colors.backgroundModifierSelected};
      }
      & > *:not(.active):hover {
        background: ${theme.colors.backgroundModifierHover};
      }
      & > *.active {
        color: ${theme.colors.textNormal};
      }
      & > *:focus-visible {
        box-shadow: 0 0 0 0.2rem ${theme.colors.primary};
      }
    `}
  >
    <Component {...props}>
      <div
        css={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "2.2rem",
          height: "1.8rem",
          marginRight: compact ? "0.4rem" : "0.8rem",
        })}
      >
        <div
          css={(theme) =>
            css({
              color: disabled
                ? "rgb(255 255 255 / 22%)"
                : theme.colors.textMuted,
              background: theme.colors.backgroundModifierHover,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "2rem",
              height: "2rem",
            })
          }
        >
          {/* {icon} */}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {title}
      </div>
    </Component>
  </div>
);

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

const App = () => {
  const { login } = useAuth();
  return (
    <WagmiConfig client={wagmiClient}>
      <ServerConnectionProvider
        Pusher={Pusher}
        pusherKey={process.env.PUSHER_KEY}
      >
        <WalletLoginProvider authenticate={login}>
          <ThemeProvider theme={theme}>
            <SidebarProvider initialIsOpen={false}>
              <RequireAuth>
                <Layout>
                  <Inbox />
                </Layout>
              </RequireAuth>
            </SidebarProvider>
          </ThemeProvider>
        </WalletLoginProvider>
      </ServerConnectionProvider>
    </WagmiConfig>
  );
};

export default App;
