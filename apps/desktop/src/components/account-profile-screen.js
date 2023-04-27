import { utils as ethersUtils } from "ethers";
import React from "react";
import { css } from "@emotion/react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useProvider } from "wagmi";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import {
  useSelectors,
  useMe,
  useUserWithWalletAddress,
} from "@shades/common/app";
import Button from "@shades/ui-web/button";
import useAccountDisplayName from "../hooks/account-display-name.js";
import * as Tooltip from "./tooltip.js";
import Delay from "./delay.js";
import Spinner from "./spinner.js";
import NavBar from "./nav-bar.js";
import Heading from "./heading.js";
import UserAvatar from "./user-avatar.js";

const { truncateAddress } = ethereumUtils;

const AccountProfileScreen = () => {
  const { ensNameOrEthereumAccountAddress } = useParams();
  const provider = useProvider();
  const isAddress = React.useMemo(
    () => ethersUtils.isAddress(ensNameOrEthereumAccountAddress),
    [ensNameOrEthereumAccountAddress]
  );

  const [notFound, setNotFound] = React.useState(false);
  const [resolvedAddress, setResolvedAddress] = React.useState(null);

  const accountAddress = isAddress
    ? ensNameOrEthereumAccountAddress
    : resolvedAddress;

  React.useEffect(() => {
    if (isAddress) return;

    provider.resolveName(ensNameOrEthereumAccountAddress).then(
      (address) => {
        if (address == null) {
          setNotFound(true);
          return;
        }

        setResolvedAddress(address);
      },
      (error) => {
        setNotFound(true);
        if (error.code !== "INVALID_ARGUMENT") {
          console.warn("unrecognized error", error.code);
        }
      }
    );
  }, [isAddress, provider, ensNameOrEthereumAccountAddress]);

  if (notFound)
    return (
      <div
        css={css({
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
        })}
      >
        <div css={(t) => css({ fontSize: t.text.large, textAlign: "center" })}>
          <div style={{ fontSize: "5rem" }}>🧐🤨🤔</div>
          Could not resolve{" "}
          <span css={(t) => css({ fontWeight: t.text.weights.header })}>
            {ensNameOrEthereumAccountAddress}
          </span>
        </div>
      </div>
    );

  if (accountAddress == null)
    return (
      <Delay millis={1000}>
        <div
          css={css({
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
          })}
        >
          <Spinner size="2.4rem" />
        </div>
      </Delay>
    );

  return <AccountProfile accountAddress={accountAddress} />;
};

const AccountProfile = ({ accountAddress }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const selectors = useSelectors();

  const me = useMe();
  const user = useUserWithWalletAddress(accountAddress);
  const displayName = useAccountDisplayName(accountAddress);

  const isMe =
    me != null &&
    me.walletAddress.toLowerCase() === accountAddress.toLowerCase();

  const truncatedAddress = truncateAddress(
    ethersUtils.getAddress(accountAddress)
  );

  const [textCopied, setTextCopied] = React.useState(false);

  const isOnline = user?.onlineStatus === "online";

  return (
    <div
      css={(t) =>
        css({
          position: "relative",
          zIndex: 0,
          flex: 1,
          minWidth: "min(30.6rem, 100vw)",
          background: t.colors.backgroundPrimary,
          display: "flex",
          flexDirection: "column",
          height: "100%",
        })
      }
    >
      <NavBar>
        <UserAvatar
          walletAddress={accountAddress}
          style={{ marginRight: "1.1rem" }}
        />

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
          }}
        >
          <Heading css={css({ minWidth: 0 })}>{displayName}</Heading>

          {user?.description != null && (
            <>
              <div
                role="separator"
                aria-orientation="vertical"
                css={(t) =>
                  css({
                    width: "0.1rem",
                    height: "1.8rem",
                    background: t.colors.borderLight,
                    margin: "0 1.1rem",
                  })
                }
              />

              <div
                css={(t) =>
                  css({
                    flex: 1,
                    minWidth: 0,
                    color: t.colors.textDimmed,
                    marginRight: "1.1rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    userSelect: "text",
                    maxWidth: "100%",
                  })
                }
              >
                {user.description}
              </div>
            </>
          )}
        </div>
      </NavBar>
      <div
        css={(t) =>
          css({
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            justifyContent: "flex-start",
            padding: "6rem 1.6rem 2rem",
            color: t.colors.textNormal,
            fontSize: t.text.sizes.large,
          })
        }
      >
        <div
          css={(t) =>
            css({
              borderBottom: "0.1rem solid",
              borderColor: t.colors.borderLighter,
              padding: "0 0 1.5rem",
            })
          }
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ marginRight: "1.2rem" }}>
              <UserAvatar
                walletAddress={accountAddress}
                transparent
                highRes
                size="6.6rem"
              />
            </div>
            <div>
              <div
                css={(t) =>
                  css({
                    fontSize: t.text.sizes.headerLarge,
                    fontWeight: t.text.weights.header,
                    color: t.colors.textHeader,
                    lineHeight: 1.3,
                    display: "flex",
                    alignItems: "center",
                  })
                }
              >
                {displayName}
                {user != null && (
                  <>
                    {" "}
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <div
                          css={(t) =>
                            css({
                              marginLeft: "1rem",
                              width: "0.8rem",
                              height: "0.8rem",
                              borderRadius: "50%",
                              background: isOnline
                                ? t.colors.onlineIndicator
                                : "none",
                              boxShadow: isOnline
                                ? "none"
                                : `0 0 0 0.2rem ${t.colors.textMuted} inset`,
                            })
                          }
                        />
                      </Tooltip.Trigger>
                      <Tooltip.Content side="top" align="center" sideOffset={6}>
                        User{" "}
                        {user.onlineStatus === "online" ? "online" : "offline"}
                      </Tooltip.Content>
                    </Tooltip.Root>
                  </>
                )}
              </div>
              {displayName !== truncatedAddress && (
                <div
                  css={(t) =>
                    css({
                      fontSize: t.text.sizes.default,
                      color: t.colors.textDimmed,
                    })
                  }
                >
                  {truncatedAddress}
                </div>
              )}
            </div>
          </div>

          {user?.description != null && (
            <div
              css={css({
                marginTop: "2rem",
                // whiteSpace: "pre-wrap",
                // "p + p": { marginTop: "1.5rem" },
              })}
            >
              {user.description}
            </div>
          )}

          <div
            css={css({
              marginTop: "2rem",
              display: "flex",
            })}
          >
            <div
              css={css({
                display: "grid",
                gridAutoFlow: "column",
                gridAutoColumns: "minmax(10rem, auto)",
                gridGap: "1.2rem",
              })}
            >
              <Button
                size="small"
                variant="primary"
                onClick={() => {
                  const dmChannel = selectors.selectDmChannelFromUserId(
                    user?.id
                  );

                  if (dmChannel != null) {
                    navigate(`/channels/${dmChannel.id}`);
                    return;
                  }

                  const newMessageUrl = `/new?account=${user.walletAddress.toLowerCase()}`;

                  // Push navigation will be ignored from /new since the search params are
                  // controlled from state
                  if (location.pathname === "/new") {
                    window.location = newMessageUrl;
                    return;
                  }

                  navigate(newMessageUrl);
                }}
              >
                {!isMe ? "My DM" : "Message"}
              </Button>
              <Button
                size="small"
                onClick={() => {
                  navigator.clipboard.writeText(user.walletAddress);
                  setTextCopied(true);
                  setTimeout(() => {
                    setTextCopied(false);
                  }, 3000);
                }}
                css={css({
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  padding: "0 1.6rem",
                })}
              >
                {textCopied ? "Address copied" : "Copy address"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountProfileScreen;
