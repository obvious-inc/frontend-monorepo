import React from "react";
import { css } from "@emotion/react";
import { useAccount, useConnect } from "wagmi";
import Dialog from "@shades/ui-web/dialog";
import Button from "@shades/ui-web/button";
import Spinner from "@shades/ui-web/spinner";

const impersonationAddress = new URLSearchParams(location.search).get(
  "impersonate"
);

const Context = React.createContext();

export const Provider = ({ children }) => {
  const [isOpen, setOpen] = React.useState(false);

  const openDialog = React.useCallback(() => setOpen(true), []);
  const closeDialog = () => setOpen(false);

  return (
    <Context.Provider value={{ openDialog }}>
      {children}
      <Dialog isOpen={isOpen} onRequestClose={closeDialog} width="34rem">
        {({ titleProps }) => (
          <ConnectDialog titleProps={titleProps} dismiss={closeDialog} />
        )}
      </Dialog>
    </Context.Provider>
  );
};

const ConnectDialog = ({ titleProps, dismiss }) => {
  const { address } = useAccount();
  const { connectAsync: connect, connectors, isLoading, reset } = useConnect();
  const init = (id) => {
    connect({ connector: connectors.find((c) => c.id === id) }).then(() => {
      dismiss();
    });
  };

  const injectedConnector = connectors.find(
    (c) => c.ready && c.id === "injected"
  );

  const hasInjected = injectedConnector != null;

  const injectedTitle = (() => {
    if (
      injectedConnector.name === "Rainbow" &&
      window.ethereum.isMetaMask &&
      !window.ethereum.rainbowIsDefaultProvider
    )
      return "Metamask";
    return injectedConnector.name;
  })();

  if (isLoading || address != null)
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
          {isLoading ? <Spinner /> : "Connected"}
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
        })
      }
    >
      <h1 {...titleProps}>Pick connect method</h1>
      <main
        css={css({ display: "flex", flexDirection: "column", gap: "1rem" })}
      >
        {hasInjected && (
          <Button
            fullWidth
            onClick={() => {
              init("injected");
            }}
          >
            <em>{injectedTitle}</em> browser extension
          </Button>
        )}

        <Button
          fullWidth
          onClick={() => {
            init("walletConnect");
          }}
        >
          <em>WalletConnect</em>
        </Button>
      </main>
    </div>
  );
};

export const useWallet = () => {
  const { openDialog } = React.useContext(Context);
  const { address } = useAccount();
  const { connect, connectors, isLoading, reset } = useConnect();

  const requestAccess = (connector) => {
    if (connector != null) {
      connect({ connector });
      return;
    }

    const hasInjectedConnector = connectors.some(
      (c) => c.ready && c.id === "injected"
    );
    const wcConnector = connectors.find(
      (c) => c.ready && c.id === "walletConnect"
    );

    if (!hasInjectedConnector && wcConnector != null) {
      connect({ connector: wcConnector });
      return;
    }

    openDialog();
  };

  return {
    address: impersonationAddress ?? address,
    requestAccess,
    isLoading,
    reset,
  };
};
