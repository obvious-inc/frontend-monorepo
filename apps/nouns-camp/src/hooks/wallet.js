import React from "react";
import { css } from "@emotion/react";
import { mainnet } from "wagmi/chains";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useConnectors,
  useSwitchChain,
} from "wagmi";
import { array as arrayUtils } from "@shades/common/utils";
import Dialog from "@shades/ui-web/dialog";
import Button from "@shades/ui-web/button";
import Spinner from "@shades/ui-web/spinner";
import useChainId, { useConnectedChainId, defaultChainId } from "./chain-id.js";

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
          <ConnectDialog titleProps={titleProps} dismiss={closeDialog} />
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
        // Exclude the injected connector if it’s not available
        .filter((c) => c.id !== "injected" || c.ready),
    [connectors, readyConnectorIds],
  );
};

const ConnectDialog = ({ titleProps, dismiss }) => {
  const { connectAsync: connect, isPending, reset } = useConnect();
  const connectors = useConnectorsWithReadyState();

  const init = async (connector) => {
    await connect({ connector });
    dismiss();
  };

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
            dismiss();
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
          "@media (min-width: 600px)": {
            padding: "3.2rem",
          },
          h1: {
            fontSize: t.text.sizes.base,
            fontWeight: "400",
            color: t.colors.textDimmed,
            textAlign: "center",
            margin: "0 0 1.6rem",
          },
          em: { fontStyle: "normal", fontWeight: t.text.weights.emphasis },
          "[data-small]": {
            fontSize: t.text.sizes.small,
            color: t.colors.textDimmed,
            lineHeight: 1.4,
          },
        })
      }
    >
      <h1 {...titleProps}>Pick connect method</h1>
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
          .map((c) => {
            return (
              <div key={c.uid}>
                <Button
                  fullWidth
                  onClick={() => {
                    init(c);
                  }}
                  disabled={!c.ready}
                >
                  {c.id === "injected" ? (
                    "Injected wallet (EIP-1193)"
                  ) : (
                    <em>{c.name}</em>
                  )}
                </Button>
              </div>
            );
          })}
      </main>
    </div>
  );
};

export const useWallet = () => {
  const { openDialog } = React.useContext(Context);
  const {
    address: connectedAccountAddress,
    isConnected,
    isConnecting: isConnectingAccount,
    isReconnecting: isReconnectingAccount,
  } = useAccount();
  const { connect, isPending: isConnecting, reset } = useConnect();
  const connectors = useConnectorsWithReadyState();
  const { disconnectAsync: disconnect } = useDisconnect();
  const { isLoading: isSwitchingNetwork, switchChainAsync: switchChain } =
    useSwitchChain();
  const chainId = useChainId();
  const connectedChainId = useConnectedChainId();
  const { betaAccounts } = { betaAccounts:[] } /*useConfig()*/;

  const isUnsupportedChain =
    connectedChainId != null && chainId !== connectedChainId;

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

  const isLoading =
    isConnecting ||
    isConnectingAccount ||
    isReconnectingAccount ||
    isSwitchingNetwork;

  return {
    address: isConnected || impersonationAddress != null ? address : null,
    requestAccess: hasReadyConnector ? requestAccess : null,
    disconnect,
    reset,
    switchToMainnet: () =>
      new Promise((resolve, reject) => {
        // Some wallets switch network without responding
        const timeoutHandle = setTimeout(() => {
          location.reload();
        }, 12_000);

        switchChain({ chainId: mainnet.id })
          .then(resolve, reject)
          .finally(() => {
            clearTimeout(timeoutHandle);
          });
      }),
    isLoading,
    isUnsupportedChain,
    isTestnet: chainId !== defaultChainId,
    isBetaAccount: betaAccounts.includes(address),
  };
};
