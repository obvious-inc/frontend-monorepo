import React from "react";
import { useSearchParams } from "react-router-dom";
import { css } from "@emotion/react";
import { TITLE_BAR_HEIGHT } from "../constants/ui";
import { useAuth, useLatestCallback } from "@shades/common";
import * as eth from "../utils/ethereum";
import usePageVisibilityChangeListener from "../hooks/page-visibility-change-listener";
import * as Tooltip from "../components/tooltip";
import Spinner from "../components/spinner";

const isNative = window.Native != null;

const useWallet = ({ onDisconnect }) => {
  const providerRef = React.useRef();

  const [isProviderConnected, setProviderConnected] = React.useState(false);
  const [selectedChainId, setSelectedChainId] = React.useState(null);
  const [selectedAddress, setSelectedAddress] = React.useState(null);

  const { signIn: signIn_ } = useAuth();

  const connectWallet = useLatestCallback(async () => {
    try {
      const addresses = await providerRef.current.request({
        method: "eth_requestAccounts",
      });
      handleAccountsChange(addresses);
    } catch (e) {
      // WalletConnect throws an error and disconnects the provider when the
      // user closes the modal with the cross
      if (e.message === "User closed modal") {
        await connectProvider();
        return;
      }

      // Ignore 4001s (rejected by user)
      if (e.code !== 4001) {
        console.error(e);
        throw e;
      }
    }
  });

  const handleChainChange = useLatestCallback((chainId) => {
    eth.numberToHex(parseInt(chainId)).then((hexChainId) => {
      setSelectedChainId(hexChainId);
    });
  });

  const handleAccountsChange = useLatestCallback((accounts) => {
    if (accounts.length === 0) {
      setSelectedAddress(null);
      return;
    }

    // Login endpoint expects a checksum address
    eth.getChecksumAddress(accounts[0]).then((a) => {
      setSelectedAddress(a);
    });
  });

  const updateChainId = useLatestCallback(async (provider) => {
    try {
      const chainId = await provider.request({ method: "net_version" });
      handleChainChange(chainId);
    } catch (e) {
      setSelectedChainId("unsupported");
    }
  });

  const updateAccount = useLatestCallback(async (provider) => {
    try {
      const addresses = await provider.request({ method: "eth_accounts" });
      handleAccountsChange(addresses);
    } catch (e) {
      handleAccountsChange([]);
    }
  });

  const connectProvider = useLatestCallback(async () => {
    const provider = await eth.connectProvider();
    providerRef.current = provider;

    provider.on("accountsChanged", handleAccountsChange);

    provider.on("chainChanged", handleChainChange);

    provider.on("disconnect", () => {
      onDisconnect();
      setSelectedAddress(null);
      setSelectedChainId(null);

      // WalletConnect kills the previous provider so we have to reconnect
      if (provider.isWalletConnect) connectProvider();
    });

    await updateChainId(provider);

    // WalletConnect will prompt the connect modal when sending requests
    if (!provider.isWalletConnect) {
      try {
        const permissions = await provider.request({
          method: "wallet_getPermissions",
        });
        if (permissions.some((p) => p.parentCapability === "eth_accounts"))
          updateAccount(provider);
      } catch (e) {
        // We can’t expect wallet_getPermissions to be supported
      }
    }

    setProviderConnected(true);

    return provider;
  });

  const requestEthereumChainSwitch = (chainId) =>
    providerRef.current.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });

  const signIn = () =>
    eth
      .signAddress(providerRef.current, selectedAddress)
      .catch((e) =>
        Promise.reject(
          new Error(
            e.code === 4001
              ? "signature-rejected"
              : "signature-rejected-or-failed"
          )
        )
      )
      .then(([signature, message, signedAt, nonce]) =>
        signIn_({
          message,
          signature,
          signedAt,
          address: selectedAddress,
          nonce,
        }).catch(() => Promise.reject(new Error("login-error")))
      );

  React.useEffect(() => {
    connectProvider();
  }, [connectProvider]);

  usePageVisibilityChangeListener((visibilityState) => {
    if (visibilityState !== "visible" || providerRef.current == null) return;

    if (selectedAddress != null) updateAccount(providerRef.current);

    updateChainId(providerRef.current);
  });

  return {
    connectWallet,
    signIn,
    requestEthereumChainSwitch,
    isProviderConnected,
    selectedAddress,
    selectedChainId,
  };
};

export const useWalletLogin = () => {
  const [status, setStatus] = React.useState("idle");
  const [error, setError] = React.useState(null);

  const {
    connectWallet: connectWallet_,
    signIn: signIn_,
    requestEthereumChainSwitch: requestEthereumChainSwitch_,
    isProviderConnected,
    selectedAddress,
    selectedChainId,
  } = useWallet({
    onDisconnect: () => {
      setError(null);
      setStatus("idle");
    },
  });

  const connectWallet = async () => {
    setError(null);
    setStatus("requesting-address");
    try {
      await connectWallet_();
    } finally {
      setStatus("idle");
    }
  };

  const signIn = async () => {
    setError(null);
    setStatus("requesting-signature");

    try {
      await signIn_();
    } catch (e) {
      setError(e.message);
    } finally {
      setStatus("idle");
    }
  };

  const requestEthereumChainSwitch = async (chainId) => {
    setError(null);
    setStatus("requesting-network-switch");
    try {
      await requestEthereumChainSwitch_(chainId);
    } catch (e) {
      // Ignore
    } finally {
      setStatus("idle");
    }
  };

  return {
    status,
    error,
    isProviderConnected,
    selectedAddress,
    selectedChainId,
    connectWallet,
    signIn,
    requestEthereumChainSwitch,
  };
};

const SignInScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { accessToken, verifyAccessToken } = useAuth();

  const {
    connectWallet,
    signIn,
    requestEthereumChainSwitch,
    isProviderConnected,
    selectedAddress,
    selectedChainId,
    error,
    status,
  } = useWalletLogin();

  React.useEffect(() => {
    if (accessToken == null || searchParams.get("redirect") == null) return;

    verifyAccessToken().then(() => {
      searchParams.set("token", encodeURIComponent(accessToken));
      setSearchParams(searchParams);
    });
  }, [accessToken, verifyAccessToken, searchParams, setSearchParams]);

  return (
    <div
      css={css`
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        text-align: center;
        padding: 2rem;

        & > * {
          min-width: 0;
        }
      `}
      style={{
        height: isNative ? `calc(100% - ${TITLE_BAR_HEIGHT})` : "100%",
      }}
    >
      {!isProviderConnected || selectedChainId == null ? (
        <Spinner color="rgb(255 255 255 / 15%)" size="2.6rem" />
      ) : selectedChainId !== "0x1" ? (
        status === "requesting-network-switch" ? (
          <div>
            <Spinner
              color="rgb(255 255 255 / 15%)"
              size="2.4rem"
              style={{ margin: "0 auto 2rem" }}
            />
            <div style={{ marginBottom: "1rem" }}>
              Requesting network change...
            </div>
            <Small>Check your wallet</Small>
          </div>
        ) : (
          <div>
            <div style={{ margin: "0 0 2rem", color: "#ffc874" }}>
              Network not supported
            </div>
            <Button
              onClick={() => {
                requestEthereumChainSwitch("0x1");
              }}
            >
              Switch to Ethereum Mainnet
            </Button>
          </div>
        )
      ) : status === "requesting-address" ? (
        <div>
          <Spinner
            color="rgb(255 255 255 / 15%)"
            size="2.4rem"
            style={{ margin: "0 auto 2rem" }}
          />
          <div style={{ marginBottom: "1rem" }}>
            Requesting wallet address...
          </div>
          <Small>Check your wallet</Small>
        </div>
      ) : status === "requesting-signature" ? (
        <div>
          <Spinner
            color="rgb(255 255 255 / 15%)"
            size="2.4rem"
            style={{ margin: "0 auto 2rem" }}
          />
          <div style={{ marginBottom: "1rem" }}>
            Requesting signature from {eth.truncateAddress(selectedAddress)}
            ...
          </div>
          <Small>Check your wallet</Small>
        </div>
      ) : status === "requesting-access-token" ? (
        <div>
          <Spinner
            color="rgb(255 255 255 / 15%)"
            size="2.4rem"
            style={{ margin: "0 auto 2rem" }}
          />
          Signing in...
        </div>
      ) : (
        <div>
          {error != null && (
            <div style={{ color: "#ff9e9e", margin: "0 0 3.4rem" }}>
              {error === "connect-wallet-error"
                ? "Could not connect to wallet"
                : error === "signature-rejected"
                ? "Signature rejected by user"
                : error === "signature-rejected-or-failed"
                ? "Signature rejected or failed"
                : error === "login-error"
                ? "Could not log in address. Check console for hints if you’re into that kind of thing."
                : "A wild error has appeard! Check you Internet connection or go grab a snack."}
            </div>
          )}
          {selectedAddress == null ? (
            <>
              <Button onClick={connectWallet}>Connect wallet</Button>
              <Small
                style={{
                  width: "42rem",
                  maxWidth: "100%",
                  marginTop: "2rem",
                  lineHeight: 1.3,
                }}
              >
                Make sure to enable any browser extension wallets before you try
                to connect. If you use a mobile wallet, no action is requred.
              </Small>
              <Small style={{ marginTop: "1.2rem" }}>
                <a
                  href="https://learn.rainbow.me/what-is-a-cryptoweb3-wallet-actually"
                  rel="noreferrer"
                  target="_blank"
                  css={(theme) =>
                    css({
                      color: theme.colors.linkColor,
                      ":hover": { color: theme.colors.linkColorHighlight },
                    })
                  }
                >
                  What is a wallet?
                </a>
              </Small>
            </>
          ) : (
            <>
              <Button onClick={signIn}>Log in with wallet signature</Button>
              <div
                css={(theme) =>
                  css({
                    fontSize: theme.fontSizes.small,
                    color: theme.colors.textMuted,
                    marginTop: "2rem",
                  })
                }
              >
                Connected as{" "}
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <a
                      href={`https://etherscan.io/address/${selectedAddress}`}
                      rel="noreferrer"
                      target="_blank"
                      css={(theme) =>
                        css({
                          color: theme.colors.linkColor,
                          ":hover": { color: theme.colors.linkColorHighlight },
                        })
                      }
                    >
                      {eth.truncateAddress(selectedAddress)}
                    </a>
                  </Tooltip.Trigger>
                  <Tooltip.Content side="top" sideOffset={4}>
                    <div>
                      Click to see address on{" "}
                      <span
                        css={(theme) =>
                          css({
                            color: theme.colors.linkColor,
                            marginBottom: "0.3rem",
                          })
                        }
                      >
                        etherscan.io
                      </span>
                    </div>
                    <div
                      css={(theme) => css({ color: theme.colors.textMuted })}
                    >
                      {selectedAddress}
                    </div>
                  </Tooltip.Content>
                </Tooltip.Root>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const Button = ({ css: cssProp, ...props }) => (
  <button
    css={css`
      color: white;
      background: hsl(0 0% 100% / 7%);
      border: 0;
      padding: 1.1rem 2.4rem;
      font-weight: 500;
      font-size: 1.5rem;
      border-radius: 0.3rem;
      cursor: pointer;
      transition: 0.15s ease-out background;
      text-align: center;
      :hover {
        background: hsl(0 0% 100% / 9%);
      }
      ${cssProp}
    `}
    {...props}
  />
);

const Small = (props) => (
  <div
    css={(theme) =>
      css({
        fontSize: theme.fontSizes.small,
        color: theme.colors.textMuted,
      })
    }
    {...props}
  />
);

export default SignInScreen;
