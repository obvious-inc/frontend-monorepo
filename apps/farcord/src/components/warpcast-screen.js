import React from "react";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import { css } from "@emotion/react";
import Button from "@shades/ui-web/button";
import Spinner from "@shades/ui-web/spinner";
import QRCode from "qrcode";
import useSigner from "./signer";
import { useInterval, useLatestCallback } from "@shades/common/react";
import { useNeynarUser } from "../hooks/neynar";
import Avatar from "@shades/ui-web/avatar";
import { Small } from "./text";
import useFarcasterAccount from "./farcaster-account";
import { createKeyPair } from "../utils/crypto";
import { toHex } from "viem";

const { truncateAddress } = ethereumUtils;

const warpcastApi = "https://api.warpcast.com";

const WarpcastUser = () => {
  const { fid } = useFarcasterAccount();
  const { user: farcasterUser } = useNeynarUser(fid);

  const SLICE_LENGTH = 30;
  const truncate = farcasterUser?.profile?.bio?.text.length > SLICE_LENGTH;
  const profileBio = truncate
    ? farcasterUser?.profile?.bio?.text.slice(0, SLICE_LENGTH) + "..."
    : farcasterUser?.profile?.bio?.text;

  return (
    <>
      <div
        css={css({
          display: "grid",
          gridTemplateColumns: "5rem auto",
          columnGap: "1rem",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "2.4rem",
        })}
      >
        <Avatar
          url={farcasterUser?.pfp?.url}
          size="5rem"
          css={(t) =>
            css({
              background: t.colors.borderLighter,
            })
          }
        />
        <div
          css={() =>
            css({
              textAlign: "left",
            })
          }
        >
          <p>
            <span style={{ fontWeight: "bold" }}>
              {farcasterUser?.displayName}
            </span>{" "}
            <a
              href={`https://warpcast.com/${farcasterUser?.username}`}
              rel="noreferrer"
              target="_blank"
              css={(theme) =>
                css({
                  color: "inherit",
                  textDecoration: "none",
                  ":hover": { color: theme.colors.linkModifierHover },
                })
              }
            >
              (@
              {farcasterUser?.username})
            </a>
          </p>
          <p>{profileBio}</p>
        </div>
      </div>
    </>
  );
};

const WarpcastAuthScreen = () => {
  const [qrCodeURL, setQrCodeURL] = React.useState(null);
  const [warpcastToken, setWarpcastToken] = React.useState(null);
  const [warpcastStatus, setWarpcastStatus] = React.useState(null);
  const [warpcastDeepLink, setWarpcastDeepLink] = React.useState(null);
  const [keypair, setKeypair] = React.useState(null);

  const { account, initAccount } = useFarcasterAccount();

  const {
    signer,
    onChainSigner,
    createWarpcastSignKeyRequest,
    status: signerStatus,
    setSigner,
  } = useSigner();

  useInterval(
    async () => {
      await fetch(
        `${warpcastApi}/v2/signed-key-request?token=${warpcastToken}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
        .then((response) => {
          return response.json();
        })
        .then((response) => {
          const signedKeyRequest = response.result.signedKeyRequest;
          if (signedKeyRequest.state == "completed") {
            setWarpcastToken(null);
            initAccount({
              fid: signedKeyRequest.userFid,
              provider: "warpcast",
            });
          }
          setWarpcastStatus(signedKeyRequest.state);
        });
    },
    {
      delay: warpcastToken !== null ? 3000 : 0,
      requireFocus: true,
      requireOnline: true,
    }
  );

  const handleWarpcastConnection = useLatestCallback(async () => {
    await createKeyPair()
      .then((createdSigner) => {
        setKeypair(createdSigner);
        createWarpcastSignKeyRequest({
          publicKey: createdSigner?.publicKey,
        }).then(({ token, deeplinkUrl, state }) => {
          setWarpcastStatus(state);
          setWarpcastToken(token);
          setWarpcastDeepLink(deeplinkUrl);
          QRCode.toDataURL(deeplinkUrl)
            .then((url) => {
              setQrCodeURL(url);
            })
            .catch((err) => {
              console.error(err);
            });
        });
      })
      .catch((e) => console.error(e));
  });

  React.useEffect(() => {
    const fetchData = async () => {
      setWarpcastStatus("creating");
      await handleWarpcastConnection();
    };

    if (warpcastStatus) return;
    fetchData();
  }, [qrCodeURL, warpcastStatus, handleWarpcastConnection]);

  React.useEffect(() => {
    if (!account) return;
    if (!keypair) return;

    setSigner(keypair);
  }, [account, keypair, setSigner]);

  return (
    <div
      css={css({
        width: "100%",
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "2rem",
        "& > *": {
          minWidth: 0,
        },
      })}
      style={{ height: undefined }}
    >
      {!warpcastStatus ||
      warpcastStatus === "creating" ||
      signerStatus === "requesting-signed-key-request" ? (
        <div>
          <Spinner
            size="2.4rem"
            css={(t) => ({
              color: t.colors.textDimmed,
              margin: "0 auto 2rem",
            })}
          />
          <div style={{ marginBottom: "1rem" }}>Generating QR code...</div>
        </div>
      ) : warpcastStatus === "pending" ? (
        <div
          css={css({
            display: "grid",
            gridTemplateColumns: "auto",
            justifyItems: "center",
          })}
        >
          <img src={qrCodeURL} />
          <div style={{ marginTop: "2rem" }}>
            Scan QR code to open Warpcast and grant access...
          </div>
          <p>
            (or{" "}
            <a
              href={warpcastDeepLink}
              css={(theme) =>
                css({
                  color: theme.colors.link,
                  ":hover": { color: theme.colors.linkModifierHover },
                })
              }
            >
              click here
            </a>{" "}
            if on mobile)
          </p>
        </div>
      ) : warpcastStatus === "approved" ? (
        <div>
          <Spinner
            size="2.4rem"
            css={(t) => ({
              color: t.colors.textDimmed,
              margin: "2rem auto 2rem",
            })}
          />
          <div style={{ marginBottom: "1rem" }}>
            Warpcast is broadcasting and confirming your signer on-chain...
          </div>
        </div>
      ) : (
        <div>
          {/* {error != null && (
            <div
              css={(t) =>
                css({ color: t.colors.textDanger, margin: "0 0 3.4rem" })
              }
            >
              {
                "A wild error has appeared! Check you Internet connection or go grab a snack."
              }
            </div>
          )} */}

          <div>
            <WarpcastUser />
            <div
              css={() =>
                css({
                  marginTop: "2rem",
                  display: "grid",
                  gridTemplateColumns: "20rem 20rem",
                  alignItems: "center",
                })
              }
            >
              {signer && onChainSigner ? (
                <a
                  href={`https://optimistic.etherscan.io/tx/${toHex(
                    onChainSigner?.transactionHash
                  )}`}
                  rel="noreferrer"
                  target="_blank"
                  css={(theme) =>
                    css({
                      color: theme.colors.link,
                      ":hover": { color: theme.colors.linkModifierHover },
                    })
                  }
                >
                  {truncateAddress(signer?.publicKey)}
                </a>
              ) : (
                <p>{signer && truncateAddress(signer?.publicKey)}</p>
              )}

              <Button danger={true} disabled={true}>
                Revoke signer
              </Button>
            </div>

            <p style={{ marginTop: "2rem" }}>
              Revoking the signer will remove all casts sent using Farcord.
            </p>

            <Small
              css={css({
                width: "40rem",
                maxWidth: "100%",
                marginTop: "2.8rem",
                "p + p": { marginTop: "1.4rem" },
              })}
            >
              <p>
                Farcord is still very much in beta. If you encounter any bugs
                ping me on{" "}
                <a
                  href="https://warpcast.com/pedropregueiro"
                  rel="noreferrer"
                  target="_blank"
                  css={(theme) =>
                    css({
                      color: theme.colors.link,
                      ":hover": { color: theme.colors.linkModifierHover },
                    })
                  }
                >
                  warpcast
                </a>
              </p>
            </Small>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarpcastAuthScreen;
