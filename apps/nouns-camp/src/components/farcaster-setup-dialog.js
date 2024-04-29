import React from "react";
import { css, useTheme } from "@emotion/react";
import { useFetch } from "@shades/common/react";
import Dialog from "@shades/ui-web/dialog";
import Button from "@shades/ui-web/button";
import DialogHeader from "@shades/ui-web/dialog-header";
import Avatar from "@shades/ui-web/avatar";
import QRCode from "@shades/ui-web/qr-code";
import { useWallet } from "../hooks/wallet.js";
import { useAccountsWithVerifiedEthAddress as useFarcasterAccountsWithVerifiedEthAddress } from "../hooks/farcaster.js";
import LogoSymbol from "./logo-symbol.js";

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

const FarcasterSetupDialog = ({ isOpen, close }) => (
  <Dialog
    isOpen={isOpen}
    onRequestClose={() => {
      close();
    }}
    width="40rem"
  >
    {(props) => <Content dismiss={close} {...props} />}
  </Dialog>
);

const Content = ({ titleProps, dismiss }) => {
  const theme = useTheme();

  const { address: connectedWalletAccountAddress } = useWallet();

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
      fetchInterval: 2000,
    },
    [keyData?.key],
  );

  const accounts = useFarcasterAccountsWithVerifiedEthAddress(
    connectedWalletAccountAddress,
    {
      // Long-poll to get account key data as the key request is approved
      fetchInterval: 2000,
    },
  );

  return (
    <div
      css={(t) =>
        css({
          padding: "1.6rem",
          "p + p": { marginTop: "1em" },
          ".small": {
            fontSize: t.text.sizes.small,
            color: t.colors.textDimmed,
          },
          b: { fontWeight: t.text.weights.emphasis },
          "@media (min-width: 600px)": { padding: "2rem" },
        })
      }
    >
      <DialogHeader
        title={
          keyData == null
            ? "Setup Farcaster"
            : keyData.fid == null
              ? "Approve key request"
              : "Key request approved"
        }
        titleProps={titleProps}
        dismiss={keyData == null ? null : dismiss}
      />
      <main>
        {keyData == null ? (
          <>
            <p>
              To cast from Camp, you need to issue an <em>account key</em> (aka
              signer) that can write messages on your behalf.
            </p>
            <p>
              Issuing account keys does not put you at risk of losing access to
              your account, although it does authorize a set of actions, like
              adding casts and likes.
            </p>
            <p className="small">
              You can revoke an account key at any time in the Warpcast app
              under {'"connected apps"'}, in settings.
            </p>
          </>
        ) : keyData.fid != null ? (
          <>
            <p>All done! 🎉</p>
            {(() => {
              if (accounts == null) return null;
              const account = accounts.find(
                (a) => String(keyData.fid) === String(a.fid),
              );

              if (account == null)
                return (
                  <p>You can now cast from Camp with FID {keyData.fid}.</p>
                );

              const { displayName, username, pfpUrl } = account;
              return (
                <p>
                  You can now cast from Camp as{" "}
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
                  <b>{displayName ?? username ?? `FID ${account.fid}`}</b>
                  {username != null && username !== displayName && (
                    <> (@{username})</>
                  )}
                  .
                </p>
              );
            })()}
          </>
        ) : (
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
            <p
              css={css({
                margin: "1.6rem 0",
                "@media (min-width: 600px)": {
                  margin: "2rem 0 2.8rem",
                },
              })}
            >
              Scan the QR code to view the key request in Warpcast, or press the
              button below if you have the Warpcast mobile app installed on your
              device.
            </p>
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
        )}
      </main>
      {keyData == null && (
        <footer
          css={css({
            display: "flex",
            justifyContent: "flex-end",
            paddingTop: "2.5rem",
            "@media (min-width: 600px)": {
              paddingTop: "3rem",
            },
          })}
        >
          <div
            css={css({
              display: "grid",
              gridAutoFlow: "column",
              gridAutoColumns: "minmax(0,1fr)",
              gridGap: "1rem",
            })}
          >
            <Button type="button" size="medium" onClick={dismiss}>
              Cancel
            </Button>
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
          </div>
        </footer>
      )}
    </div>
  );
};

export default FarcasterSetupDialog;
