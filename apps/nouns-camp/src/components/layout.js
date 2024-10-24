import React from "react";
import { css, keyframes } from "@emotion/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useMatchMedia } from "@shades/common/react";
import Button from "@shades/ui-web/button";
import * as DropdownMenu from "@shades/ui-web/dropdown-menu";
import {
  CaretDown as CaretDownIcon,
  DotsHorizontal as DotsIcon,
} from "@shades/ui-web/icons";
import { CHAIN_ID } from "@/constants/env";
import {
  getChain as getSupportedChain,
  isTestnet as isTestnetChain,
} from "@/utils/chains";
import { useAccount, useAccountStreams, useDelegate } from "@/store";
import { useNavigate } from "@/hooks/navigation";
import { useWallet, useWalletAuthentication } from "@/hooks/wallet";
import {
  useState as useSessionState,
  useActions as useSessionActions,
} from "@/session-provider";
import { useDialog } from "@/hooks/global-dialogs";
import { useConnectedFarcasterAccounts } from "@/hooks/farcaster";
import useAccountDisplayName from "@/hooks/account-display-name";
import {
  useAuctionData,
  useLazySeed,
  useNounImageDataUri,
} from "@/components/auction-dialog";
import AccountAvatar from "@/components/account-avatar";
import LogoSymbol from "@/components/logo-symbol";

const flipAnimation = keyframes({
  "0%,52%,100%": {
    transform: "rotate3d(1,1,1,0deg)",
  },
  "2%, 50%": {
    transform: "rotate3d(0.4,1,0,180deg)",
  },
});

const Layout = ({
  scrollContainerRef,
  navigationStack = [],
  actions,
  scrollView = true,
  hideAuction = false,
  children,
  ...props
}) => (
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
    {...props}
  >
    <NavBar
      navigationStack={navigationStack}
      actions={actions}
      hideAuction={hideAuction}
    />
    <div
      css={css({
        position: "relative",
        flex: 1,
        display: "flex",
        minHeight: 0,
        minWidth: 0,
      })}
    >
      {scrollView ? (
        <div
          ref={scrollContainerRef}
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
            {children}
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  </div>
);

const defaultActions = [
  {
    label: "Propose",
    buttonProps: {
      component: NextLink,
      href: "/new",
      prefetch: true,
    },
    desktopOnly: true,
  },
];

const NavBar = ({
  navigationStack,
  actions: actions_,
  hideAuction = false,
}) => {
  let actions = actions_ ?? defaultActions;
  const pathname = usePathname();
  const navigate = useNavigate();

  const isDesktop = useMatchMedia("(min-width: 600px)");

  const { open: openAuctionDialog, preload: preloadAuctionDialog } =
    useDialog("auction");
  const { open: openTreasuryDialog } = useDialog("treasury");
  const { open: openAccountDialog } = useDialog("account");
  const { open: openProposalDraftsDialog } = useDialog("proposal-drafts");
  const { open: openDelegationDialog } = useDialog("delegation");
  const { open: openStreamsDialog } = useDialog("streams");
  const { open: openSettingsDialog } = useDialog("settings");
  const { open: openAccountAuthenticationDialog } = useDialog(
    "account-authentication",
  );
  const { open: openFarcasterSetupDialog } = useDialog("farcaster-setup");

  const { auction } = useAuctionData();
  const auctionProgress = (() => {
    if (auction == null) return 0;
    const now = Date.now();
    const start = auction.startTimestamp.getTime();
    const end = auction.endTimestamp.getTime();
    const duration = end - start;
    const elapsed = Math.max(0, now - start);
    return elapsed / duration;
  })();

  const {
    address: connectedWalletAccountAddress,
    chainId: connectedChainId,
    requestAccess: requestWalletAccess,
    disconnect: disconnectWallet,
    switchToTargetChain: switchWalletToTargetChain,
    isAuthenticated: isConnectedWalletAccountAuthenticated,
    isLoading: isLoadingWallet,
  } = useWallet();
  const { signIn: signInConnectedWalletAccount } = useWalletAuthentication();
  const { address: loggedInAccountAddress } = useSessionState();
  const { destroy: signOut } = useSessionActions();
  const connectedFarcasterAccounts = useConnectedFarcasterAccounts();
  const hasVerifiedFarcasterAccount = connectedFarcasterAccounts?.length > 0;
  const hasFarcasterAccountKey =
    hasVerifiedFarcasterAccount &&
    connectedFarcasterAccounts.some((a) => a.hasAccountKey);

  const userAccountAddress =
    connectedWalletAccountAddress ?? loggedInAccountAddress;

  const isTestnet = isTestnetChain(CHAIN_ID);
  const isConnectedToTargetChain = CHAIN_ID === connectedChainId;

  const chain = getSupportedChain(CHAIN_ID);

  const userAccount = useAccount(userAccountAddress);
  const userDelegate = useDelegate(userAccountAddress);

  const hasNouns = userAccount?.nouns?.length > 0;
  const hasVotingPower = userDelegate?.nounsRepresented?.length > 0;

  const userAccountDisplayName = useAccountDisplayName(userAccountAddress);

  const hasStreams =
    useAccountStreams(connectedWalletAccountAddress).length > 0;

  if (!hideAuction) {
    actions = [
      ...actions,
      {
        key: "auction-dialog",
        component: "button",
        onSelect: () => {
          openAuctionDialog();
        },
        buttonProps: {
          style: {
            "--progress": auctionProgress,
          },
          css: (t) =>
            css({
              display: "flex",
              marginLeft: "0.4rem",
              marginRight: "0.8rem",
              borderRadius: "0.6rem",
              position: "relative",
              overflow: "visible",
              ".noun-image": {
                background: t.colors.backgroundModifierNormal,
              },
              ".progress-outline": {
                position: "absolute",
                top: "50%",
                left: "50%",
                width: "calc(100% + 0.4rem)",
                height: "calc(100% + 0.4rem)",
                transform: "translateX(-50%) translateY(-50%)",
                pointerEvents: "none",
              },
              ".progress-outline rect": {
                fill: "none",
                // stroke: t.colors.borderNormal,
                stroke: t.colors.primaryTransparentStrong,
                strokeWidth: 2,
                strokeDasharray:
                  "calc(var(--progress) * 100) calc((1 - var(--progress)) * 100)",
                strokeDashoffset: "-9",
                transition: "stroke-dashoffset 1s linear, stroke 0.1s ease-out",
              },
              "@media(hover: hover)": {
                cursor: "pointer",
                ":not([disabled]):hover": {
                  background: "none",
                  ".progress-outline rect": {
                    stroke: t.colors.primary,
                  },
                },
              },
            }),
          icon: (
            <>
              <AuctionNounImage
                className="noun-image"
                style={{
                  display: "block",
                  width: "2.4rem",
                  height: "2.4rem",
                  borderRadius: "0.3rem",
                }}
              />
              <svg className="progress-outline" viewBox="0 0 32 32">
                <rect
                  width="30"
                  height="30"
                  rx="6"
                  x="1"
                  y="1"
                  pathLength="99"
                />
              </svg>
            </>
          ),
        },
      },
    ];
  }

  const visibleActions = isDesktop
    ? actions
    : actions.filter((a) => !a.desktopOnly);

  const handleDropDownAction = async (key) => {
    switch (key) {
      case "open-account-dialog":
        openAccountDialog();
        break;
      case "open-proposal-drafts-dialog":
        openProposalDraftsDialog();
        break;
      case "open-delegation-dialog":
        openDelegationDialog();
        break;
      case "open-streams-dialog":
        openStreamsDialog();
        break;
      case "copy-account-address":
        navigator.clipboard.writeText(userAccountAddress);
        break;
      case "open-warpcast":
        window.open("https://warpcast.com/~/channel/nouns", "_blank");
        break;
      case "open-camp-changelog":
        window.open("https://warpcast.com/~/channel/camp", "_blank");
        break;
      case "open-camp-github":
        window.open(
          "https://github.com/obvious-inc/frontend-monorepo/tree/main/apps/nouns-camp",
          "_blank",
        );
        break;
      case "navigate-to-auction":
        navigate("/auction");
        break;
      case "navigate-to-proposal-listing":
        navigate("/proposals");
        break;
      case "navigate-to-candidate-listing":
        navigate("/candidates");
        break;
      case "navigate-to-account-listing":
        navigate("/voters");
        break;
      case "open-settings-dialog":
        openSettingsDialog();
        break;
      case "open-treasury-dialog":
        openTreasuryDialog();
        break;
      case "setup-farcaster":
        openFarcasterSetupDialog();
        break;
      case "sign-in": {
        try {
          openAccountAuthenticationDialog();
          await signInConnectedWalletAccount();
          // TODO alert success
        } catch (e) {
          console.error(e);
          alert("Ops, seems like something went wrong!");
        }
        break;
      }
      case "sign-out": {
        try {
          await signOut();
          alert("You have been logged out");
        } catch (e) {
          console.error(e);
          alert("Ops, seems like something went wrong!");
        }
        break;
      }
      case "disconnect-wallet":
        disconnectWallet();
        break;
    }
  };

  React.useEffect(() => {
    if (!hideAuction) preloadAuctionDialog();
  }, [hideAuction, preloadAuctionDialog]);

  return (
    <>
      <div
        css={(t) =>
          css({
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            whiteSpace: "nowrap",
            minHeight: t.navBarHeight, // "4.7rem",
            "@media (max-width: 599px)": {
              '[data-desktop-only="true"]': {
                display: "none",
              },
            },
          })
        }
      >
        <div
          css={css({
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: "0.2rem",
            overflow: "hidden",
            padding: "1rem 1.6rem 1rem 1.3rem",
            "@media (min-width: 600px)": {
              padding: "1rem",
            },
          })}
        >
          {[
            (() => {
              const logo = (
                <LogoSymbol
                  css={css({
                    display: "inline-block",
                    width: "1.8rem",
                    height: "auto",
                    backfaceVisibility: "hidden",
                  })}
                  style={{
                    filter: isTestnet ? "invert(1)" : undefined,
                  }}
                />
              );

              if (pathname !== "/")
                return {
                  to: "/",
                  label: (
                    <>
                      {logo}
                      <span
                        css={css({
                          display: "none",
                          "@media(min-width: 600px)": {
                            display: "inline",
                            marginLeft: "0.6rem",
                          },
                        })}
                      >
                        {isTestnet ? chain.name : "Camp"}
                      </span>
                    </>
                  ),
                };

              return {
                key: "root-logo",
                component: "div",
                props: {
                  style: {
                    pointerEvents: "none",
                    height: "2.8rem",
                    minWidth: "2.8rem",
                    paddingBlock: 0,
                    perspective: "200vmax",
                  },
                },
                label: (
                  <>
                    <div
                      css={css({
                        position: "relative",
                        display: "inline-flex",
                        alignItems: "center",
                        width: "1.8rem",
                        height: "1.8rem",
                        animation: `${flipAnimation} 24s linear 12s infinite`,
                        transition: "0.25s transform ease-out",
                        transformStyle: "preserve-3d",
                        svg: { display: "block" },
                      })}
                    >
                      {logo}
                      <div
                        css={css({
                          position: "absolute",
                          top: "50%",
                          left: "50%",
                          backfaceVisibility: "hidden",
                          transform:
                            "translateX(-50%) translateY(-50%) rotate3d(0.4,1,0,180deg)",
                          width: "2.4rem",
                          height: "2.4rem",
                          svg: {
                            display: "block",
                            width: "100%",
                            height: "100%",
                            borderRadius: "0.3rem",
                          },
                        })}
                      >
                        <NoggleImage />
                      </div>
                    </div>
                    {isTestnet && (
                      <span
                        css={css({
                          display: "none",
                          "@media(min-width: 600px)": {
                            display: "inline",
                            marginLeft: "0.6rem",
                          },
                        })}
                      >
                        {chain.name}
                      </span>
                    )}
                  </>
                ),
              };
            })(),
            ...navigationStack,
          ].map((item, index) => {
            const [Component, componentProps] =
              item.component != null
                ? [item.component, item.props]
                : [
                    NextLink,
                    {
                      prefetch: true,
                      href: item.to,
                    },
                  ];
            return (
              <React.Fragment key={item.key ?? item.to}>
                {index > 0 && (
                  <span
                    data-index={index}
                    data-desktop-only={item.desktopOnly}
                    css={(t) =>
                      css({
                        color: t.colors.textMuted,
                        fontSize: t.text.sizes.base,
                      })
                    }
                  >
                    {"/"}
                  </span>
                )}
                <Component
                  {...componentProps}
                  data-index={index}
                  // data-disabled={pathname === item.to}
                  data-desktop-only={item.desktopOnly}
                  css={(t) =>
                    css({
                      display: "inline-flex",
                      alignItems: "center",
                      height: "2.8rem",
                      minWidth: "2.8rem",

                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontSize: t.fontSizes.base,
                      color: t.colors.textNormal,
                      padding: "0.3rem 0.5rem",
                      borderRadius: "0.4rem",
                      textDecoration: "none",
                      '&[data-index="0"]': { minWidth: "max-content" },
                      '&[data-disabled="true"]': { pointerEvents: "none" },
                      "@media(hover: hover)": {
                        cursor: "pointer",
                        ":hover": {
                          background: t.colors.backgroundModifierHover,
                          // ".flippable-container": {
                          //   animation: "none",
                          //   transform: "rotate3d(0.4,1,0,180deg)",
                          // },
                        },
                      },
                    })
                  }
                >
                  {item.label}
                </Component>
              </React.Fragment>
            );
          })}
        </div>
        <div
          css={(t) =>
            css({
              fontSize: t.text.sizes.base,
              padding: "0 1.6rem 0 0",
              ul: {
                display: "grid",
                gridAutoFlow: "column",
                gridGap: "0.3rem",
                alignItems: "center",
              },
              li: { listStyle: "none" },
              '[role="separator"]': {
                width: "0.1rem",
                background: t.colors.borderLight,
                height: "1.6rem",
                margin: "0 0.4rem",
              },
              "@media (min-width: 600px)": {
                padding: "0 1rem",
              },
            })
          }
        >
          <ul>
            {[
              ...actions,
              visibleActions.length > 0 && { type: "separator" },
              connectedWalletAccountAddress == null
                ? {
                    onSelect: () => {
                      requestWalletAccess();
                    },
                    buttonProps: {
                      variant: "default",
                      isLoading: requestWalletAccess == null || isLoadingWallet,
                      disabled: requestWalletAccess == null || isLoadingWallet,
                      style: { marginLeft: "0.8rem", marginRight: "0.4rem" },
                    },
                    label: (
                      <>
                        Connect<span data-desktop-only> Wallet</span>
                      </>
                    ),
                  }
                : !isConnectedToTargetChain
                  ? {
                      onSelect: () => {
                        switchWalletToTargetChain();
                      },
                      buttonProps: {
                        variant: "default",
                        isLoading: isLoadingWallet,
                        disabled:
                          switchWalletToTargetChain == null || isLoadingWallet,
                        style: { marginLeft: "0.8rem" },
                      },
                      label: `Switch to ${CHAIN_ID === 1 ? "Mainnet" : chain.name}`,
                    }
                  : null,
              (() => {
                const daoSection = {
                  id: "dao",
                  title: "DAO",
                  children: [
                    {
                      id: "navigate-to-auction",
                      label: "Auction",
                    },
                    {
                      id: "navigate-to-proposal-listing",
                      label: "Proposals",
                    },
                    {
                      id: "navigate-to-candidate-listing",
                      label: "Candidates",
                    },
                    {
                      id: "navigate-to-account-listing",
                      label: "Voters",
                    },
                    { id: "open-treasury-dialog", label: "Treasury" },
                  ],
                };
                const externalSection = {
                  id: "external",
                  title: "External",
                  children: [
                    {
                      id: "open-warpcast",
                      textValue: "Farcaster",
                      label: (
                        <>
                          <span style={{ flex: 1, marginRight: "0.8rem" }}>
                            Farcaster
                          </span>
                          {"\u2197"}
                        </>
                      ),
                    },
                  ],
                };
                const settingsSection = {
                  id: "settings",
                  title: "Camp",
                  children: [
                    { id: "open-settings-dialog", label: "Settings" },
                    {
                      id: "open-camp-changelog",
                      textValue: "Changelog",
                      label: (
                        <>
                          <span style={{ flex: 1, marginRight: "0.8rem" }}>
                            Changelog
                          </span>
                          {"\u2197"}
                        </>
                      ),
                    },
                    {
                      id: "open-camp-github",
                      textValue: "Github",
                      label: (
                        <>
                          <span style={{ flex: 1, marginRight: "0.8rem" }}>
                            GitHub
                          </span>
                          {"\u2197"}
                        </>
                      ),
                    },
                  ],
                };

                if (connectedWalletAccountAddress == null)
                  return {
                    type: "dropdown",
                    items: [
                      daoSection,
                      externalSection,
                      settingsSection,
                      loggedInAccountAddress != null && {
                        id: "disconnect",
                        children: [{ id: "sign-out", label: "Log out" }],
                      },
                    ].filter(Boolean),
                    buttonProps: {
                      style: { display: "flex" },
                      icon: (
                        <DotsIcon style={{ width: "1.8rem", height: "auto" }} />
                      ),
                    },
                  };

                return {
                  type: "dropdown",
                  items: [
                    {
                      id: "connected-account",
                      title: "You",
                      children: [
                        {
                          id: "open-account-dialog",
                          label: "Account",
                        },
                        (hasNouns || hasVotingPower) && {
                          id: "open-delegation-dialog",
                          label: "Manage delegation",
                        },
                        hasStreams && {
                          id: "open-streams-dialog",
                          label: "Streams",
                        },
                        {
                          id: "open-proposal-drafts-dialog",
                          label: "Proposal drafts",
                        },
                        !hasVerifiedFarcasterAccount
                          ? null
                          : !hasFarcasterAccountKey
                            ? {
                                id: "setup-farcaster",
                                label: "Setup Farcaster",
                              }
                            : !isConnectedWalletAccountAuthenticated
                              ? {
                                  id: "sign-in",
                                  label: "Authenticate account",
                                }
                              : null,
                      ].filter(Boolean),
                    },
                    daoSection,
                    externalSection,
                    settingsSection,
                    {
                      id: "disconnect",
                      children: [
                        loggedInAccountAddress != null && {
                          id: "sign-out",
                          label: "Log out",
                        },
                        connectedWalletAccountAddress != null && {
                          id: "disconnect-wallet",
                          label: "Disconnect wallet",
                        },
                      ].filter(Boolean),
                    },
                  ],
                  buttonProps: {
                    css: css({
                      display: "flex",
                      "@media(max-width: 600px)": {
                        paddingInline: "0.4rem",
                        marginLeft: "0.3rem",
                        ".account-display-name": { display: "none" },
                      },
                    }),
                    iconRight: (
                      <CaretDownIcon
                        style={{ width: "0.9rem", height: "auto" }}
                      />
                    ),
                  },
                  label: (
                    <div
                      css={css({
                        display: "flex",
                        alignItems: "center",
                        gap: "0.8rem",
                      })}
                    >
                      {pathname === "/" && (
                        <div className="account-display-name">
                          {userAccountDisplayName}
                        </div>
                      )}
                      <AccountAvatar address={userAccountAddress} size="2rem" />
                    </div>
                  ),
                };
              })(),
            ]
              .filter(Boolean)
              .map((a, i) =>
                a.type === "separator" ? (
                  <li key={i} role="separator" aria-orientation="vertical" />
                ) : a.type === "dropdown" ? (
                  <li key={a.key ?? i} data-desktop-only={a.desktopOnly}>
                    <DropdownMenu.Root placement="bottom">
                      <DropdownMenu.Trigger asChild>
                        <Button
                          variant={a.buttonVariant ?? "transparent"}
                          size="small"
                          {...a.buttonProps}
                        >
                          {a.label}
                        </Button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Content
                        css={css({
                          width: "min-content",
                          minWidth: "min-content",
                          maxWidth: "calc(100vw - 2rem)",
                        })}
                        items={a.items}
                        onAction={handleDropDownAction}
                      >
                        {(item) => (
                          <DropdownMenu.Section
                            title={item.title}
                            items={item.children}
                          >
                            {(item) => (
                              <DropdownMenu.Item
                                primary={item.primary}
                                textValue={item.textValue}
                              >
                                {item.label}
                              </DropdownMenu.Item>
                            )}
                          </DropdownMenu.Section>
                        )}
                      </DropdownMenu.Content>
                    </DropdownMenu.Root>
                  </li>
                ) : (
                  <li key={a.key ?? i} data-desktop-only={a.desktopOnly}>
                    <Button
                      variant={a.buttonVariant ?? "transparent"}
                      size="small"
                      onClick={a.onSelect}
                      {...a.buttonProps}
                    >
                      {a.label}
                    </Button>
                  </li>
                ),
              )}
          </ul>
        </div>
      </div>
    </>
  );
};

export const MainContentContainer = ({
  sidebar = null,
  narrow = false,
  containerHeight,
  sidebarWidth,
  children,
  ...props
}) => (
  <div
    css={css({
      "@media (min-width: 600px)": {
        margin: "0 auto",
        maxWidth: "100%",
        width: "var(--width)",
        padding: "0 4rem",
      },
      "@media (min-width: 1152px)": {
        padding: "0 8rem",
      },
    })}
    style={{
      "--width": narrow ? "92rem" : "134rem",
    }}
    {...props}
  >
    {sidebar == null ? (
      children
    ) : (
      <div
        css={(t) =>
          css({
            "@media (min-width: 1152px)": {
              display: "grid",
              gridTemplateColumns: `minmax(0, 1fr) var(--sidebar-width, ${t.sidebarWidth})`,
              gridGap: "10rem",
              "[data-sidebar-content]": {
                position: "sticky",
                top: 0,
                maxHeight: `var(--container-height, calc(100vh - ${t.navBarHeight}))`,
                overflow: "auto",
                // Prevents the scrollbar from overlapping the content
                margin: "0 -2rem",
                padding: "0 2rem",
              },
            },
          })
        }
        style={{
          "--container-height": containerHeight,
          "--sidebar-width": sidebarWidth,
        }}
      >
        <div>{children}</div>
        <div>
          <div data-sidebar-content>{sidebar}</div>
        </div>
      </div>
    )}
  </div>
);

const AuctionNounImage = (props) => {
  const { auction } = useAuctionData();
  const seed = useLazySeed(auction?.nounId);
  const imageDataUri = useNounImageDataUri(seed);
  if (imageDataUri == null) return null;
  return <img src={imageDataUri} {...props} />;
};

const NoggleImage = () => (
  <svg
    fill="none"
    width="160"
    height="60"
    shapeRendering="crispEdges"
    viewBox="0 0 160 60"
  >
    <g fill="#d53c5e">
      <path d="m90 0h-60v10h60z" />
      <path d="m160 0h-60v10h60z" />
      <path d="m40 10h-10v10h10z" />
    </g>
    <path d="m60 10h-20v10h20z" fill="#fff" />
    <path d="m80 10h-20v10h20z" fill="#000" />
    <path d="m90 10h-10v10h10z" fill="#d53c5e" />
    <path d="m110 10h-10v10h10z" fill="#d53c5e" />
    <path d="m130 10h-20v10h20z" fill="#fff" />
    <path d="m150 10h-20v10h20z" fill="#000" />
    <path d="m160 10h-10v10h10z" fill="#d53c5e" />
    <path d="m40 20h-40v10h40z" fill="#d53c5e" />
    <path d="m60 20h-20v10h20z" fill="#fff" />
    <path d="m80 20h-20v10h20z" fill="#000" />
    <path d="m110 20h-30v10h30z" fill="#d53c5e" />
    <path d="m130 20h-20v10h20z" fill="#fff" />
    <path d="m150 20h-20v10h20z" fill="#000" />
    <path d="m160 20h-10v10h10z" fill="#d53c5e" />
    <path d="m10 30h-10v10h10z" fill="#d53c5e" />
    <path d="m40 30h-10v10h10z" fill="#d53c5e" />
    <path d="m60 30h-20v10h20z" fill="#fff" />
    <path d="m80 30h-20v10h20z" fill="#000" />
    <path d="m90 30h-10v10h10z" fill="#d53c5e" />
    <path d="m110 30h-10v10h10z" fill="#d53c5e" />
    <path d="m130 30h-20v10h20z" fill="#fff" />
    <path d="m150 30h-20v10h20z" fill="#000" />
    <path d="m160 30h-10v10h10z" fill="#d53c5e" />
    <path d="m10 40h-10v10h10z" fill="#d53c5e" />
    <path d="m40 40h-10v10h10z" fill="#d53c5e" />
    <path d="m60 40h-20v10h20z" fill="#fff" />
    <path d="m80 40h-20v10h20z" fill="#000" />
    <path d="m90 40h-10v10h10z" fill="#d53c5e" />
    <path d="m110 40h-10v10h10z" fill="#d53c5e" />
    <path d="m130 40h-20v10h20z" fill="#fff" />
    <path d="m150 40h-20v10h20z" fill="#000" />
    <path d="m160 40h-10v10h10z" fill="#d53c5e" />
    <path d="m90 50h-60v10h60z" fill="#d53c5e" />
    <path d="m160 50h-60v10h60z" fill="#d53c5e" />
  </svg>
);

export default Layout;
