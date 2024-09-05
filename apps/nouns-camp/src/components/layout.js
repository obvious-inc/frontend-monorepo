import React from "react";
import { css } from "@emotion/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { ErrorBoundary, useMatchMedia } from "@shades/common/react";
import Button from "@shades/ui-web/button";
import * as DropdownMenu from "@shades/ui-web/dropdown-menu";
import {
  CaretDown as CaretDownIcon,
  DotsHorizontal as DotsIcon,
} from "@shades/ui-web/icons";
import { CHAIN_ID } from "../constants/env.js";
import {
  getChain as getSupportedChain,
  isTestnet as isTestnetChain,
} from "../utils/chains.js";
import { useAccount, useDelegate } from "../store.js";
import { useSearchParamToggleState, useNavigate } from "../hooks/navigation.js";
import { useWallet, useWalletAuthentication } from "../hooks/wallet.js";
import { useDialog } from "../hooks/global-dialogs.js";
import { useConnectedFarcasterAccounts } from "../hooks/farcaster.js";
import useAccountDisplayName from "../hooks/account-display-name.js";
import AccountAvatar from "./account-avatar.js";
import LogoSymbol from "./logo-symbol.js";

const TreasuryDialog = React.lazy(() => import("./treasury-dialog.js"));

const Layout = ({
  scrollContainerRef,
  navigationStack = [],
  actions,
  scrollView = true,
  children,
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
  >
    <NavBar navigationStack={navigationStack} actions={actions} />
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

const NavBar = ({ navigationStack, actions: actions_ }) => {
  const actions = actions_ ?? defaultActions;

  const pathname = usePathname();
  const navigate = useNavigate();

  const isDesktop = useMatchMedia("(min-width: 600px)");

  const { open: openAccountDialog } = useDialog("account");
  const { open: openProposalDraftsDialog } = useDialog("proposal-drafts");
  const { open: openDelegationDialog } = useDialog("delegation");
  const { open: openSettingsDialog } = useDialog("settings");
  const { open: openAccountAuthenticationDialog } = useDialog(
    "account-authentication",
  );
  const { open: openFarcasterSetupDialog } = useDialog("farcaster-setup");
  const [isTreasuryDialogOpen, toggleTreasuryDialog] =
    useSearchParamToggleState("treasury", { replace: true, prefetch: "true" });

  const {
    address: connectedWalletAccountAddress,
    chainId: connectedChainId,
    requestAccess: requestWalletAccess,
    disconnect: disconnectWallet,
    switchToTargetChain: switchWalletToTargetChain,
    isAuthenticated: isConnectedWalletAccountAuthenticated,
    isLoading: isLoadingWallet,
  } = useWallet();
  const {
    signIn: signInConnectedWalletAccount,
    signOut: signOutActiveAccountSession,
  } = useWalletAuthentication();
  const connectedFarcasterAccounts = useConnectedFarcasterAccounts();
  const hasVerifiedFarcasterAccount = connectedFarcasterAccounts?.length > 0;
  const hasFarcasterAccountKey =
    hasVerifiedFarcasterAccount &&
    connectedFarcasterAccounts.some((a) => a.hasAccountKey);

  const isTestnet = isTestnetChain(CHAIN_ID);
  const isConnectedToTargetChain = CHAIN_ID === connectedChainId;

  const chain = getSupportedChain(CHAIN_ID);

  const connectedAccount = useAccount(connectedWalletAccountAddress);
  const connectedDelegate = useDelegate(connectedWalletAccountAddress);

  const hasNouns = connectedAccount?.nouns?.length > 0;
  const hasVotingPower = connectedDelegate?.nounsRepresented?.length > 0;

  const connectedAccountDisplayName = useAccountDisplayName(
    connectedWalletAccountAddress,
  );

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
      case "copy-account-address":
        navigator.clipboard.writeText(connectedWalletAccountAddress);
        break;
      case "open-auction":
        window.open("https://lilnouns.wtf", "_blank");
        break;
      case "open-warpcast":
        window.open("https://warpcast.com/~/channel/lilnouns", "_blank");
        break;
      // case "open-changelog":
      //   window.open("https://warpcast.com/~/channel/camp", "_blank");
      //   break;
      case "navigate-to-proposal-listing":
        navigate("/proposals");
        break;
      // case "navigate-to-candidate-listing":
      //   navigate("/candidates");
      //   break;
      case "navigate-to-account-listing":
        navigate("/voters");
        break;
      case "open-settings-dialog":
        openSettingsDialog();
        break;
      case "open-treasury-dialog":
        toggleTreasuryDialog();
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
          await signOutActiveAccountSession();
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
            padding: "1rem 1.6rem",
            "@media (min-width: 600px)": {
              padding: "1rem",
            },
          })}
        >
          {[
            {
              to: "/",
              label: (
                <>
                  <LogoSymbol
                    css={css({
                      display: "inline-block",
                      width: "1.8rem",
                      height: "auto",
                      verticalAlign: "sub",
                      transform: "translateY(0.1rem) scale(1.05)",
                    })}
                    style={{
                      filter: isTestnet ? "invert(1)" : undefined,
                    }}
                  />
                  {(pathname !== "/" || isTestnet) && (
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
                  )}
                </>
              ),
            },
            ...navigationStack,
          ].map((item, index) => (
            <React.Fragment key={item.to}>
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
              <NextLink
                prefetch
                href={item.to}
                data-index={index}
                // data-disabled={pathname === item.to}
                data-desktop-only={item.desktopOnly}
                css={(t) =>
                  css({
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
                      },
                    },
                  })
                }
              >
                {item.label}
              </NextLink>
            </React.Fragment>
          ))}
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
                      style: { marginLeft: "0.9rem", marginRight: "0.4rem" },
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
                        style: { marginLeft: "0.9rem" },
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
                      id: "navigate-to-proposal-listing",
                      label: "Proposals",
                    },
                    // {
                    //   id: "navigate-to-candidate-listing",
                    //   label: "Candidates",
                    // },
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
                      id: "open-auction",
                      label: (
                        <>
                          <span style={{ flex: 1, marginRight: "0.8rem" }}>
                            Nouns auction
                          </span>
                          {"\u2197"}
                        </>
                      ),
                      textValue: "Nouns auction",
                    },
                    {
                      id: "open-warpcast",
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
                      id: "open-changelog",
                      label: (
                        <>
                          <span style={{ flex: 1, marginRight: "0.8rem" }}>
                            Changelog
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
                    items: [daoSection, externalSection, settingsSection],
                    buttonProps: {
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
                        isConnectedWalletAccountAuthenticated && {
                          id: "sign-out",
                          label: "Log out",
                        },
                        {
                          id: "disconnect-wallet",
                          label: "Disconnect wallet",
                        },
                      ].filter(Boolean),
                    },
                  ],
                  buttonProps: {
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
                        <div
                          css={css({
                            "@media(max-width: 600px)": { display: "none" },
                          })}
                        >
                          {connectedAccountDisplayName}
                        </div>
                      )}
                      <AccountAvatar
                        address={connectedWalletAccountAddress}
                        size="2rem"
                      />
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
                  <DropdownMenu.Root key={i} placement="bottom">
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
                ) : (
                  <li key={i} data-desktop-only={a.desktopOnly}>
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

      <ErrorBoundary fallback={null}>
        <React.Suspense fallback={null}>
          <TreasuryDialog
            isOpen={isTreasuryDialogOpen}
            close={toggleTreasuryDialog}
          />
        </React.Suspense>
      </ErrorBoundary>
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

export default Layout;
