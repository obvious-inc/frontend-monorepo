import React from "react";
import { css } from "@emotion/react";
import { Small } from "./text.js";
import Button from "@shades/ui-web/button";
import { Link, useSearchParams } from "react-router-dom";
import { fetchCustodyAddressByUsername } from "../hooks/neynar.js";
import Input from "@shades/ui-web/input";
import { ethereum as ethereumUtils } from "@shades/common/utils";

const { truncateAddress } = ethereumUtils;

const CustodyWalletDialog = () => {
  const [searchParams] = useSearchParams();

  const accountAddress = searchParams.get("wallet");

  const [farcasterUsername, setFarcasterUsername] = React.useState("");
  const [custodyWalletAddress, setCustodyWalletAddress] = React.useState("");
  const [custodyWalletSearchError, setCustodyWalletAddressError] =
    React.useState(null);
  const [pendingCustodyWalletSearch, setPendingCustodyWalletSearch] =
    React.useState(false);
  const [connectedAddresses, setConnectedAddresses] = React.useState([]);

  const isConnectedWallet = React.useMemo(() => {
    return connectedAddresses.includes(accountAddress);
  }, [connectedAddresses, accountAddress]);

  const handleSearchCustodyWalletClick = async () => {
    setPendingCustodyWalletSearch(true);
    fetchCustodyAddressByUsername(farcasterUsername.replace("@", ""))
      .then((result) => {
        if (!result) {
          setCustodyWalletAddressError("User not found");
          setCustodyWalletAddress(null);
        } else {
          setCustodyWalletAddressError(null);
          setCustodyWalletAddress(result.custodyAddress);
          setConnectedAddresses(result.verifications);
        }
      })
      .catch((e) => {
        console.error(e);
        setCustodyWalletAddressError(e.message);
      })
      .finally(() => setPendingCustodyWalletSearch(false));
  };

  return (
    <div
      css={css({
        overflow: "auto",
        padding: "1.5rem",
        "{@}media (min-width: 600px)": {
          padding: "3rem",
        },
      })}
    >
      <div
        css={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        })}
      >
        <div style={{ marginTop: "1rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gridGap: "1rem",
            }}
          >
            <Input
              style={{ marginTop: "1.2rem" }}
              placeholder="@vitalik"
              value={farcasterUsername}
              onChange={(e) => {
                setFarcasterUsername(e.target.value);
              }}
            />
            <Button
              style={{ marginTop: "1.2rem" }}
              onClick={handleSearchCustodyWalletClick}
              isLoading={pendingCustodyWalletSearch}
              disabled={pendingCustodyWalletSearch}
            >
              Find my custody wallet
            </Button>
          </div>
          {custodyWalletSearchError && (
            <div css={(t) => css({ color: t.colors.textDanger })}>
              <p>{custodyWalletSearchError}</p>
            </div>
          )}
        </div>

        {custodyWalletAddress && (
          <div style={{ marginTop: "2rem", textAlign: "center" }}>
            <p>Your farcaster custody wallet is:</p>
            <a
              href={`https://optimistic.etherscan.io/address/${custodyWalletAddress}`}
              rel="noreferrer"
              target="_blank"
              css={(theme) =>
                css({
                  color: theme.colors.link,
                  textDecoration: "none",
                  ":hover": {
                    color: theme.colors.linkModifierHover,
                  },
                })
              }
            >
              {custodyWalletAddress}
            </a>

            <div style={{ marginTop: "2rem", maxWidth: "45rem" }}>
              {isConnectedWallet && (
                <Small>
                  The connected wallet is not the custody wallet for{" "}
                  <span style={{ fontWeight: "bold" }}>
                    @{farcasterUsername.replace("@", "")}
                  </span>
                  , but it is connected to it on Farcaster. You should
                  re-connect using{" "}
                  <a
                    href={`https://optimistic.etherscan.io/address/${custodyWalletAddress}`}
                    rel="noreferrer"
                    target="_blank"
                    css={(theme) =>
                      css({
                        color: theme.colors.textDimmed,
                        textDecoration: "none",
                        ":hover": {
                          color: theme.colors.linkModifierHover,
                        },
                      })
                    }
                  >
                    {truncateAddress(custodyWalletAddress)}
                  </a>
                  .
                </Small>
              )}

              <Small style={{ marginTop: "2rem" }}>
                You might not have imported your Farcaster recovery phrase into
                your wallet yet. If that&apos;s the case, you can do so by
                opening Warpcast and going to the Advanced settings page.
              </Small>

              <Small style={{ marginTop: "1rem" }}>
                If you don&apos;t wanna import it, you can{" "}
                <Link
                  to="/login/warpcast"
                  preventScrollReset={true}
                  css={(theme) =>
                    css({
                      color: theme.colors.textDimmed,
                      ":hover": {
                        color: theme.colors.linkModifierHover,
                      },
                    })
                  }
                >
                  login with warpcast
                </Link>{" "}
                instead.
              </Small>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustodyWalletDialog;
