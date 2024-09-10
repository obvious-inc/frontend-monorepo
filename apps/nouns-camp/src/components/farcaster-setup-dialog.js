import React from "react";
import { css, useTheme } from "@emotion/react";
import { useFetch } from "@shades/common/react";
import Dialog from "@shades/ui-web/dialog";
import Button from "@shades/ui-web/button";
import DialogHeader from "@shades/ui-web/dialog-header";
import Avatar from "@shades/ui-web/avatar";
import Spinner from "@shades/ui-web/spinner";
import QRCode from "@shades/ui-web/qr-code";
import { pickDisplayName as pickFarcasterAccountDisplayName } from "../utils/farcaster.js";
import {
  useWallet,
  useWalletAuthentication,
  ConnectDialogContent,
} from "../hooks/wallet.js";
import { useDialog } from "../hooks/global-dialogs.js";
import { useConnectedFarcasterAccounts } from "../hooks/farcaster.js";
import LogoSymbol from "./logo-symbol.js";
import ChainExplorerAddressLink from "./chain-explorer-address-link.js";

const createFarcasterAccountKey = async () => {
  const res = await fetch("/api/farcaster-account-key", { method: "POST" });
  if (!res.ok) {
    const body = await res.text();
    console.error(body);
    throw new Error();
  }
  return res.json();
};

const getFarcasterAccountKey = async (publicKey) => {
  const res = await fetch(`/api/farcaster-account-key?key=${publicKey}`);
  if (!res.ok) {
    const body = await res.text();
    console.error(body);
    throw new Error();
  }
  return res.json();
};

const FarcasterSetupDialog = ({ isOpen, close }) => {
  const { address: connectedAccountAddress } = useWallet();

  return (
    <Dialog
      isOpen={isOpen}
      onRequestClose={() => {
        close();
      }}
      width="40rem"
    >
      {(props) => {
        if (connectedAccountAddress == null)
          return <ConnectDialogContent {...props} />;
        return <FarcasterSetupContent dismiss={close} {...props} />;
      }}
    </Dialog>
  );
};

const FarcasterSetupContent = ({ titleProps, dismiss }) => {
  const theme = useTheme();

  const { address: connectedWalletAccountAddress, isAuthenticated } =
    useWallet();
  const { signIn: authenticateConnectedAccount, state: authenticationState } =
    useWalletAuthentication();

  const isAuthenticating = authenticationState !== "idle";

  const { data: dialogData } = useDialog("farcaster-setup");

  const userIntent = dialogData?.intent;

  const [isInitiatingKeyRequest, setInitiatingKeyRequest] =
    React.useState(false);
  const [keyData, setKeyData] = React.useState(null);

  useFetch(
    async () => {
      const data = await getFarcasterAccountKey(keyData.key);
      setKeyData((s) => ({ ...s, ...data }));
    },
    {
      enabled: keyData != null,
      fetchInterval: 3000,
    },
    [keyData?.key],
  );

  const accounts = useConnectedFarcasterAccounts({
    // Long-poll to get account key data as the key request is approved
    refetchInterval: 2500,
  });

  if (accounts == null) return null;

  const hasVerifiedAddress = accounts.length > 0;
  const hasAccountKey =
    hasVerifiedAddress && accounts.every((a) => a.hasAccountKey);
  const hasFinishedAccountKeySetup = hasAccountKey && keyData?.fid != null;

  return (
    <div
      css={(t) =>
        css({
          padding: "1.6rem",
          "p + p": { marginTop: "1em" },
          ".small": {
            fontSize: t.text.sizes.small,
            color: t.colors.textDimmed,
            a: { color: "inherit" },
          },
          "p a": {
            color: t.colors.link,
            "&.plain": { color: "inherit", textDecoration: "none" },
          },
          b: { fontWeight: t.text.weights.emphasis },
          "@media (min-width: 600px)": { padding: "2rem" },
        })
      }
    >
      <DialogHeader
        title={
          hasAccountKey && isAuthenticated ? (
            <>All done 🎉</>
          ) : hasAccountKey ? (
            "Authenticate account"
          ) : keyData == null ? (
            "Setup Farcaster"
          ) : keyData.fid == null ? (
            "Approve key request"
          ) : (
            "Key request approved"
          )
        }
        titleProps={titleProps}
        dismiss={keyData == null ? null : dismiss}
      />
      <main>
        {!hasVerifiedAddress ? (
          <>
            {userIntent === "like" && (
              <p>
                Likes on Camp are built on top of{" "}
                <a
                  href="https://docs.farcaster.xyz/learn/"
                  target="_blank"
                  rel="noreferrer"
                  style={{ whiteSpace: "nowrap" }}
                >
                  Farcaster
                </a>
                .
              </p>
            )}
            <p>
              There’s unfortunately no Farcaster account associated with your
              connected address (
              <ChainExplorerAddressLink
                address={connectedWalletAccountAddress}
                className="plain"
              >
                {connectedWalletAccountAddress.slice(0, 6)}...
                {connectedWalletAccountAddress.slice(-4)}
              </ChainExplorerAddressLink>
              )
            </p>
            <p>
              You can verify your address under <i>Verified addresses</i>, in
              the Warpcast app settings. Your verification will appear here as
              soon as it is accepted.
            </p>
            <p className="small">
              If you don’t have a Farcaster account, you can create one using
              the{" "}
              <a href="https://warpcast.com/" target="_blank" rel="noreferrer">
                Warpcast app
              </a>
              .
            </p>
          </>
        ) : hasAccountKey ? (
          <>
            {(() => {
              if (accounts == null) return null;
              const account =
                keyData == null
                  ? accounts.find((a) => a.hasAccountKey)
                  : accounts.find((a) => String(keyData.fid) === String(a.fid));

              if (keyData != null && account == null) {
                return (
                  <p>You can now cast from Camp with FID {keyData.fid}.</p>
                );
              }

              const displayName = pickFarcasterAccountDisplayName(account);

              if (isAuthenticated)
                return (
                  <>
                    <p>
                      You can now cast and like stuff with your Farcaster
                      account (
                      {account.pfpUrl != null && (
                        <Avatar
                          url={account.pfpUrl}
                          size="1.2em"
                          css={css({
                            display: "inline-block",
                            marginRight: "0.3em",
                            verticalAlign: "sub",
                          })}
                        />
                      )}
                      <b>{displayName}</b>) from Camp.
                    </p>
                    <p className="small">
                      If you wish to log out, there’s an option for that in the
                      account menu up in the top right corner.
                    </p>
                  </>
                );

              return (
                <>
                  {hasFinishedAccountKeySetup && (
                    <p>
                      Nice! An account key for{" "}
                      {account.pfpUrl != null && (
                        <Avatar
                          url={account.pfpUrl}
                          size="1.2em"
                          css={css({
                            display: "inline-block",
                            marginRight: "0.3em",
                            verticalAlign: "sub",
                          })}
                        />
                      )}
                      <b>{displayName}</b> is set up.
                    </p>
                  )}
                  <p>
                    Now we just need a quick authentication signature, and then
                    we’re good to go.
                  </p>
                  <p className="small">
                    Camp will prompt you to sign a little message according to
                    the{" "}
                    <a
                      href="https://eips.ethereum.org/EIPS/eip-4361"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Sign-In with Ethereum
                    </a>{" "}
                    standard. This signature proves that you are in control of
                    your connected wallet account.
                  </p>
                </>
              );
            })()}
          </>
        ) : keyData != null ? (
          <>
            <div
              css={(t) =>
                css({
                  width: "70vh",
                  maxWidth: "100%",
                  margin: "2rem auto 0",
                  padding: "1rem",
                  background: t.light ? "none" : t.colors.textAccent,
                  border: t.light ? "0.1rem solid" : "none",
                  borderColor: t.colors.borderLight,
                  borderRadius: "2rem",
                })
              }
            >
              <QRCode
                uri={keyData.signerApprovalUrl}
                color={
                  theme.light
                    ? theme.colors.textAccent
                    : theme.colors.backgroundPrimary
                }
                image={
                  <LogoSymbol css={css({ width: "100%", height: "auto" })} />
                }
              />
            </div>
            <div
              css={(t) =>
                css({
                  margin: "1.6rem 0",
                  "p + p": { marginTop: "1em" },
                  '[data-size="small"]': {
                    fontSize: t.text.sizes.small,
                  },
                  '[data-variant="warning"]': {
                    color: t.colors.textHighlight,
                  },
                  "@media (min-width: 600px)": {
                    margin: "2rem 0 2.8rem",
                  },
                })
              }
            >
              <p>
                Scan the QR code to view the key request in Warpcast, or press
                the button below if you have the Warpcast mobile app installed
                on your device.
              </p>
              <p data-size="small" data-variant="warning">
                Issuing account keys requires an onchain transaction. Warpcast
                will ask you to pay a small fee to cover gas costs.
              </p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="primary"
                component="a"
                href={keyData.signerApprovalUrl}
              >
                Open in Warpcast {"\u2197"}
              </Button>
            </div>
          </>
        ) : (
          <>
            {(() => {
              // Note that there is a slight risk that this account is not the
              // one the user intends to use
              const { pfpUrl } = accounts[0];
              const displayName = pickFarcasterAccountDisplayName(accounts[0]);
              return (
                <p>
                  To {userIntent === "like" ? "like stuff" : "cast"} as{" "}
                  {pfpUrl != null && (
                    <Avatar
                      url={pfpUrl}
                      size="1.2em"
                      css={css({
                        display: "inline-block",
                        marginRight: "0.3em",
                        verticalAlign: "sub",
                      })}
                    />
                  )}
                  <b>{displayName}</b> on Camp, you need to issue an{" "}
                  <em>account key</em> (aka signer) that can write messages on
                  your behalf.
                </p>
              );
            })()}
            <p>
              Issuing account keys does not put you at risk of losing access to
              your account, although it does authorize a set of actions, like
              submitting casts and likes.
            </p>
            <p className="small">
              You can revoke an account key at any time in the Warpcast app
              under <i>connected apps</i>, in settings.
            </p>
          </>
        )}
      </main>
      {keyData == null && (
        <footer
          css={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: "2.5rem",
            "@media (min-width: 600px)": {
              paddingTop: "3rem",
            },
          })}
        >
          <div>
            {!hasVerifiedAddress && (
              <div
                css={(t) =>
                  css({
                    display: "flex",
                    alignItems: "center",
                    gap: "0.8rem",
                    color: t.colors.textMuted,
                    fontSize: t.text.sizes.small,
                  })
                }
              >
                <Spinner size="1.4rem" />
                <div>Checking verifications...</div>
              </div>
            )}
          </div>
          {(() => {
            if (hasAccountKey)
              return (
                <div css={css({ display: "flex", gap: "1rem" })}>
                  <Button type="button" size="medium" onClick={dismiss}>
                    Close
                  </Button>
                  {!isAuthenticated && (
                    <Button
                      size="medium"
                      variant="primary"
                      type="button"
                      onClick={async () => {
                        await authenticateConnectedAccount();
                        dismiss();
                      }}
                      disabled={isAuthenticating}
                      isLoading={isAuthenticating}
                    >
                      Authenticate account
                    </Button>
                  )}
                </div>
              );

            return (
              <div
                css={css({
                  display: "grid",
                  gridAutoFlow: "column",
                  gridAutoColumns: "minmax(0,1fr)",
                  gridGap: "1rem",
                })}
              >
                <Button type="button" size="medium" onClick={dismiss}>
                  Close
                </Button>
                {hasVerifiedAddress && (
                  <Button
                    size="medium"
                    variant="primary"
                    type="button"
                    onClick={async () => {
                      setInitiatingKeyRequest(true);
                      try {
                        const keyData = await createFarcasterAccountKey();
                        setKeyData(keyData);
                      } finally {
                        setInitiatingKeyRequest(false);
                      }
                    }}
                    disabled={isInitiatingKeyRequest}
                    isLoading={isInitiatingKeyRequest}
                  >
                    Got it &rarr;
                  </Button>
                )}
              </div>
            );
          })()}
        </footer>
      )}
    </div>
  );
};

export default FarcasterSetupDialog;
