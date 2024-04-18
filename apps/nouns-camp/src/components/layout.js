import React from "react";
import { css } from "@emotion/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useAccountDisplayName } from "@shades/common/ethereum-react";
import { ErrorBoundary, useMatchMedia } from "@shades/common/react";
import Button from "@shades/ui-web/button";
import * as DropdownMenu from "@shades/ui-web/dropdown-menu";
import {
  CaretDown as CaretDownIcon,
  DotsHorizontal as DotsIcon,
} from "@shades/ui-web/icons";
import { useAccount, useDelegate } from "../store.js";
import { useSearchParamToggleState, useNavigate } from "../hooks/navigation.js";
import { useWallet } from "../hooks/wallet.js";
import { useDialog } from "../hooks/global-dialogs.js";
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
    label: "Voters",
    buttonProps: {
      component: NextLink,
      href: "/voters",
      prefetch: true,
    },
    desktopOnly: true,
  },
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
  const { open: openDelegationDialog } = useDialog("delegation");
  const { open: openSettingsDialog } = useDialog("settings");
  const [isTreasuryDialogOpen, toggleTreasuryDialog] =
    useSearchParamToggleState("treasury", { replace: true, prefetch: "true" });

  const {
    address: connectedWalletAccountAddress,
    requestAccess: requestWalletAccess,
    disconnect: disconnectWallet,
    switchToMainnet: switchWalletToMainnet,
    isUnsupportedChain,
    isTestnet,
    isLoading: isLoadingWallet,
    chain,
  } = useWallet();

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

  const handleDropDownAction = (key) => {
    switch (key) {
      case "open-account-dialog":
        openAccountDialog();
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
      case "navigate-to-accounts-listing":
        navigate("/voters");
        break;
      case "open-settings-dialog":
        openSettingsDialog();
        break;
      case "open-treasury-dialog":
        toggleTreasuryDialog();
        break;
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
                      filter:
                        isTestnet || isUnsupportedChain
                          ? "invert(1)"
                          : undefined,
                    }}
                  />
                  {(pathname !== "/" || isTestnet || isUnsupportedChain) && (
                    <span
                      css={css({
                        display: "none",
                        "@media(min-width: 600px)": {
                          display: "inline",
                          marginLeft: "0.6rem",
                        },
                      })}
                    >
                      {isUnsupportedChain
                        ? "Unsupported chain"
                        : isTestnet
                          ? chain?.name
                          : "Camp"}
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
                data-disabled={pathname === item.to}
                data-desktop-only={item.desktopOnly}
                css={(t) =>
                  css({
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontSize: t.fontSizes.base,
                    color: t.colors.textNormal,
                    padding: "0.3rem 0.5rem",
                    borderRadius: "0.2rem",
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
                : isUnsupportedChain
                  ? {
                      onSelect: () => {
                        switchWalletToMainnet();
                      },
                      buttonProps: {
                        variant: "default",
                        isLoading: isLoadingWallet,
                        disabled:
                          switchWalletToMainnet == null || isLoadingWallet,
                        style: { marginLeft: "0.9rem" },
                      },
                      label: "Switch to Mainnet",
                    }
                  : null,
              connectedWalletAccountAddress == null
                ? {
                    type: "dropdown",
                    items: [
                      {
                        id: "dao",
                        children: [
                          {
                            id: "open-auction",
                            label: (
                              <>
                                <span
                                  style={{ flex: 1, marginRight: "0.8rem" }}
                                >
                                  Auction
                                </span>{" "}
                                {"\u2197"}
                              </>
                            ),
                            textValue: "Auction",
                          },
                          {
                            id: "navigate-to-accounts-listing",
                            label: "Voters",
                          },
                          { id: "open-treasury-dialog", label: "Treasury" },
                        ],
                      },
                      {
                        id: "settings",
                        children: [
                          { id: "open-settings-dialog", label: "Settings" },
                        ],
                      },
                    ],
                    buttonProps: {
                      icon: (
                        <DotsIcon style={{ width: "1.8rem", height: "auto" }} />
                      ),
                    },
                  }
                : {
                    type: "dropdown",
                    items: [
                      {
                        id: "main",
                        children: [
                          {
                            id: "open-account-dialog",
                            label: "Account",
                          },
                          (hasNouns || hasVotingPower) && {
                            id: "open-delegation-dialog",
                            label: "Manage delegation",
                          },
                        ].filter(Boolean),
                      },
                      {
                        id: "dao",
                        children: [
                          {
                            id: "open-auction",
                            label: (
                              <>
                                <span
                                  style={{ flex: 1, marginRight: "0.8rem" }}
                                >
                                  Auction
                                </span>{" "}
                                {"\u2197"}
                              </>
                            ),
                            textValue: "Auction",
                          },
                          {
                            id: "navigate-to-accounts-listing",
                            label: "Voters",
                          },
                          { id: "open-treasury-dialog", label: "Treasury" },
                        ],
                      },
                      {
                        id: "settings",
                        children: [
                          {
                            id: "open-settings-dialog",
                            label: "Settings",
                          },
                        ],
                      },
                      {
                        id: "disconnect",
                        children: [
                          {
                            id: "disconnect-wallet",
                            label: "Disconnect wallet",
                          },
                        ],
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
                  },
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
                        <DropdownMenu.Section items={item.children}>
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
      "@media (min-width: 996px)": {
        padding: "0 6rem",
      },
    })}
    style={{
      "--width": narrow ? "92rem" : "132rem",
    }}
    {...props}
  >
    {sidebar == null ? (
      children
    ) : (
      <div
        css={(t) =>
          css({
            "@media (min-width: 996px)": {
              display: "grid",
              gridTemplateColumns: `minmax(0, 1fr) ${t.sidebarWidth} `,
              gridGap: "8rem",
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
        style={{ "--container-height": containerHeight }}
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
