import React from "react";
import AuthScreen from "./auth-screen";
import WarpcastAuthScreen from "./warpcast-screen";
import { css } from "@emotion/react";
import { Small } from "./text";
import Button from "@shades/ui-web/button";
import { useSearchParams } from "react-router-dom";
import { useMatchMedia } from "@shades/common/react";
import TinyMutedText from "./tiny-muted-text";

const AuthDialog = () => {
  const [searchParams] = useSearchParams();
  const provider = searchParams.get("provider");
  const [warpcastVisible, setWarpcastVisible] = React.useState(
    provider === "warpcast",
  );
  const [custodyWalletVisible, setCustodyWalletVisible] = React.useState(
    provider === "wallet",
  );

  const isSmallScreen = useMatchMedia("(max-width: 800px)");

  return (
    <div
      css={css({
        overflow: "auto",
        padding: "1.5rem",
        "@media (min-width: 600px)": {
          padding: "3rem",
        },
      })}
    >
      {warpcastVisible ? (
        <WarpcastAuthScreen />
      ) : custodyWalletVisible ? (
        <AuthScreen />
      ) : (
        <div
          css={css({
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            textAlign: "center",
          })}
        >
          <div
            css={css({
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            })}
          >
            <Button
              onClick={() => setWarpcastVisible(true)}
              disabled={isSmallScreen}
            >
              Use Warpcast
            </Button>

            {isSmallScreen && (
              <TinyMutedText style={{ marginTop: "2.8rem" }}>
                Desktop-only
              </TinyMutedText>
            )}

            <Small
              css={css({
                padding: "0 3rem",
                maxWidth: "100%",
                marginTop: "2.8rem",
                "p + p": { marginTop: "1.4rem" },
              })}
            >
              <p
                css={(t) =>
                  css({
                    color: t.colors.pink,
                    fontWeight: "bold",
                    fontStyle: "italic",
                  })
                }
              >
                Simple
              </p>
              <p>
                If you don&rsquo;t wanna mess around with wallets and on-chain
                transactions.
              </p>
              <p>
                You will be shown a QR code to scan using whichever device you
                have Warpcast installed.
              </p>
            </Small>
          </div>
          <div
            css={(t) =>
              css({
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                borderLeft: "1px solid",
                borderLeftColor: t.colors.backgroundQuarternary,
              })
            }
          >
            <Button onClick={() => setCustodyWalletVisible(true)}>
              Use Custody Wallet
            </Button>

            <Small
              css={css({
                padding: "0 3rem",
                maxWidth: "100%",
                marginTop: "2.8rem",
                "p + p": { marginTop: "1.4rem" },
              })}
            >
              <p
                css={(t) =>
                  css({
                    color: t.colors.pink,
                    fontWeight: "bold",
                    fontStyle: "italic",
                  })
                }
              >
                Advanced
              </p>
              <p>
                If you have imported your Farcaster seed phrase into a mobile
                wallet (rainbow, metamask, etc.)
              </p>
              <p>
                You will have to connect your custody wallet and then submit a
                transaction on-chain.
              </p>
            </Small>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthDialog;
