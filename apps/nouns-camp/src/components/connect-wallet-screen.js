import { css } from "@emotion/react";
import Button from "@shades/ui-web/button";
import Spinner from "@shades/ui-web/spinner";
import { useWallet } from "@/hooks/wallet";
import Layout from "@/components/layout";

const ConnectWalletScreen = () => {
  const { requestAccess, isLoading, reset } = useWallet();

  return (
    <Layout>
      <div
        css={css({
          // height: "100%",
          // width: "100%",
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
      >
        {isLoading ? (
          <div>
            <Spinner
              color="rgb(255 255 255 / 15%)"
              size="2.4rem"
              style={{ margin: "0 auto 2rem" }}
            />
            <div style={{ marginBottom: "1rem" }}>Connecting...</div>
            <Small>Check your wallet</Small>
            <Button
              size="medium"
              onClick={() => {
                reset();
              }}
              style={{ marginTop: "2rem" }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div
            css={(t) =>
              css({
                h1: {
                  fontSize: "6rem",
                  margin: "0 0 3rem",
                },
                p: { fontSize: t.text.sizes.large, margin: "2.8rem 0 0" },
              })
            }
          >
            <h1>👋</h1>
            <Button
              size="large"
              onClick={() => {
                requestAccess();
              }}
              style={{ marginTop: "2rem" }}
            >
              Connect Wallet
            </Button>
            <div style={{ marginTop: "2rem" }}>
              <Small
                style={{
                  width: "42rem",
                  maxWidth: "100%",
                  margin: "auto",
                }}
              >
                Make sure to enable any browser extension wallets before you try
                to connect. If you use a mobile wallet, no action is required.
              </Small>
              <Small style={{ marginTop: "1.2rem" }}>
                <a
                  href="https://learn.rainbow.me/what-is-a-cryptoweb3-wallet-actually"
                  rel="noreferrer"
                  target="_blank"
                  css={(theme) =>
                    css({
                      color: theme.colors.link,
                      ":hover": { color: theme.colors.linkModifierHover },
                    })
                  }
                >
                  What is a wallet?
                </a>
              </Small>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

const Small = (props) => (
  <div
    css={(theme) =>
      css({
        fontSize: theme.text.sizes.small,
        color: theme.colors.textDimmed,
        lineHeight: 1.3,
      })
    }
    {...props}
  />
);

export default ConnectWalletScreen;
