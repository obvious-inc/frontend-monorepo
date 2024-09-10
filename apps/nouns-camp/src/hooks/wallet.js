import React from "react";
import { css } from "@emotion/react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useConnectors,
  useSwitchChain,
} from "wagmi";
import { array as arrayUtils, invariant } from "@shades/common/utils";
import Dialog from "@shades/ui-web/dialog";
import Button from "@shades/ui-web/button";
import Spinner from "@shades/ui-web/spinner";
import { CHAIN_ID } from "@/constants/env";
// import { useConfig } from "@/config-provider";
import {
  useState as useSessionState,
  useActions as useSessionActions,
} from "@/session-provider";

const impersonationAddress =
  typeof location === "undefined"
    ? null
    : new URLSearchParams(location.search).get("impersonate");

const Context = React.createContext();

export const Provider = ({ children }) => {
  const [isOpen, setOpen] = React.useState(false);

  const openDialog = React.useCallback(() => setOpen(true), []);
  const closeDialog = () => {
    setOpen(false);
  };

  return (
    <Context.Provider value={{ openDialog }}>
      {children}
      <Dialog isOpen={isOpen} onRequestClose={closeDialog} width="36rem">
        {({ titleProps }) => (
          <ConnectDialogContent
            titleProps={titleProps}
            dismiss={closeDialog}
            onSuccess={() => {
              closeDialog();
            }}
          />
        )}
      </Dialog>
    </Context.Provider>
  );
};

export const useConnectorsWithReadyState = () => {
  const connectors = useConnectors();
  const [readyConnectorIds, setReadyConnectorIds] = React.useState([]);

  React.useEffect(() => {
    let canceled = false;

    Promise.all(
      connectors.map(async (c) => {
        const p = await c.getProvider();
        if (p == null) return c;
        return { ...c, ready: true };
      }),
    ).then((connectorsWithReadyState) => {
      if (canceled) return;

      const readyConnectorIds = connectorsWithReadyState
        .filter((c) => c.ready)
        .map((c) => c.id);

      setReadyConnectorIds(readyConnectorIds);
    });

    return () => {
      canceled = true;
    };
  }, [connectors]);

  return React.useMemo(
    () =>
      connectors
        .map((c) => {
          if (!readyConnectorIds.includes(c.id)) return c;
          return { ...c, ready: true };
        })
        .filter((c) => {
          // Exclude the injected and safe connectors if they’re not available
          // (safe only runs in iframe contexts)
          const hideIfUnavailable = c.id === "injected" || c.id === "safe";
          return c.ready || !hideIfUnavailable;
        }),
    [connectors, readyConnectorIds],
  );
};

export const ConnectDialogContent = ({ titleProps, onSuccess }) => {
  const { connectAsync: connect, isPending, reset } = useConnect();
  const connectors = useConnectorsWithReadyState();

  if (isPending)
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "18.3rem",
          gap: "1.6rem",
        }}
      >
        <div style={{ padding: "3rem" }}>
          <Spinner />
        </div>
        <Button
          onClick={() => {
            reset();
          }}
        >
          Cancel
        </Button>
      </div>
    );

  return (
    <div
      css={(t) =>
        css({
          padding: "1.6rem",
          textAlign: "center",
          header: {
            margin: "0 0 1.6rem",
            h1: { fontSize: t.text.sizes.larger },
            ".subheading": {
              fontSize: t.text.sizes.base,
              fontWeight: "400",
              color: t.colors.textDimmed,
            },
          },
          footer: {
            color: t.colors.textDimmed,
            margin: "1.6rem 0 0",
            fontSize: t.text.sizes.small,
          },
          em: { fontStyle: "normal", fontWeight: t.text.weights.emphasis },
          "[data-small]": {
            fontSize: t.text.sizes.small,
            color: t.colors.textDimmed,
            lineHeight: 1.4,
          },
          "@media (min-width: 600px)": {
            padding: "3.2rem",
            header: { margin: "0 0 2.4rem" },
            footer: { margin: "2.4rem 0 0" },
          },
        })
      }
    >
      <header>
        <h1 {...titleProps}>Connect wallet</h1>
        <p className="subheading">Pick connect method below</p>
      </header>
      <main
        css={css({ display: "flex", flexDirection: "column", gap: "1rem" })}
      >
        {arrayUtils
          // Injected wallets first
          .sortBy(
            { value: (c) => c.id !== "injected" },
            { value: (c) => c.type === "injected" },
            connectors,
          )
          .map((connector) => {
            return (
              <div key={connector.uid}>
                <Button
                  fullWidth
                  onClick={async () => {
                    await connect({ connector });
                    onSuccess?.();
                  }}
                  disabled={!connector.ready}
                >
                  {connector.id === "injected" ? (
                    "Injected wallet (EIP-1193)"
                  ) : (
                    <em>{connector.name}</em>
                  )}
                </Button>
              </div>
            );
          })}
      </main>
      <footer>
        If you use a browser extension wallet, you might need to enable the
        extension for it to show up here.
      </footer>
    </div>
  );
};

export const useWallet = () => {
  const { openDialog } = React.useContext(Context);
  const {
    address: connectedAccountAddress,
    chainId: connectedChainId,
    isConnected,
    isConnecting: isConnectingAccount,
    isReconnecting: isReconnectingAccount,
  } = useAccount();
  const { connect, isPending: isConnecting, reset } = useConnect();
  const connectors = useConnectorsWithReadyState();
  const { disconnectAsync: disconnectWallet } = useDisconnect();
  const { isLoading: isSwitchingNetwork, switchChainAsync: switchChain } =
    useSwitchChain();

  const { canaryAccounts, betaAccounts } = { canaryAccounts: [], betaAccounts:[] } /*useConfig()*/;

  const { address: authenticatedAccountAddress } = useSessionState();

  const hasReadyConnector = connectors.some((c) => c.ready);

  const requestAccess = (connector) => {
    if (connector != null) {
      connect({ connector });
      return;
    }

    openDialog();
  };

  const address = (
    impersonationAddress ?? connectedAccountAddress
  )?.toLowerCase();

  const switchToTargetChain = React.useCallback(
    () =>
      new Promise((resolve, reject) => {
        // Some wallets switch network without responding
        const timeoutHandle = setTimeout(() => {
          location.reload();
        }, 12_000);

        switchChain({ chainId: CHAIN_ID })
          .then(resolve, reject)
          .finally(() => {
            clearTimeout(timeoutHandle);
          });
      }),
    [switchChain],
  );

  const isLoading =
    isConnecting ||
    isConnectingAccount ||
    isReconnectingAccount ||
    isSwitchingNetwork;

  return {
    address: isConnected || impersonationAddress != null ? address : null,
    chainId: connectedChainId,
    requestAccess: hasReadyConnector ? requestAccess : null,
    disconnect: disconnectWallet,
    reset,
    switchToTargetChain,
    isAuthenticated: authenticatedAccountAddress === address,
    isLoading,
    isConnectedToTargetChain: connectedChainId === CHAIN_ID,
    isCanaryAccount: canaryAccounts.includes(address),
    isBetaAccount: betaAccounts.includes(address),
  };
};

export const useWalletAuthentication = () => {
  const { address: connectedAccountAddress, isConnected } = useAccount();
  const {
    address: authenticatedAccountAddress,
    createSessionState: createAccountSessionState,
  } = useSessionState();
  const { create: createAccountSession, destroy: destroyAccountSession } =
    useSessionActions();

  const signIn = React.useCallback(async () => {
    invariant(connectedAccountAddress != null, "Connected address required");
    return createAccountSession({ address: connectedAccountAddress });
  }, [connectedAccountAddress, createAccountSession]);

  if (!isConnected) return {};

  return {
    authenticatedAddress: authenticatedAccountAddress,
    signIn,
    signOut: destroyAccountSession,
    state: createAccountSessionState,
  };
};
