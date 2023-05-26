import { getAddress as checksumEncodeAddress } from "viem";
import React from "react";
import { useAccount, useEnsName } from "wagmi";
import { css } from "@emotion/react";
import {
  useSelectors,
  useMe,
  useUser,
  useUserWithWalletAddress,
} from "@shades/common/app";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import Button from "@shades/ui-web/button";
import AccountAvatar from "@shades/ui-web/account-avatar";
import useAccountDisplayName from "../hooks/account-display-name";
import { useDialog } from "../hooks/dialogs";
import * as Tooltip from "./tooltip";
import { useNavigate, useLocation } from "react-router-dom";

const ProfilePreview = React.forwardRef(
  ({ userId, walletAddress, close: dismiss }, ref) => {
    const [textCopied, setTextCopied] = React.useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    const selectors = useSelectors();

    const me = useMe();
    const { address: connectedWalletAccountAddress } = useAccount();
    const userFromId = useUser(userId);
    const userFromWalletAddress = useUserWithWalletAddress(walletAddress);
    const user =
      userFromId ??
      userFromWalletAddress ??
      (walletAddress == null ? null : { walletAddress });

    const { open: openEditProfileDialog } = useDialog("edit-profile");

    const meWalletAddress =
      me == null ? connectedWalletAccountAddress : me.walletAddress;

    const isMe =
      user != null &&
      meWalletAddress != null &&
      meWalletAddress.toLowerCase() === user.walletAddress.toLowerCase();

    const { displayName } = useAccountDisplayName(user.walletAddress);

    const { data: ensName } = useEnsName({ address: user.walletAddress });

    const isOnline = user?.onlineStatus === "online";

    const sendMessage = () => {
      const dmChannel = selectors.selectDmChannelFromUserId(user?.id);

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
    };

    const copyWalletAddress = () => {
      navigator.clipboard.writeText(user.walletAddress);
      setTextCopied(true);
      setTimeout(() => {
        setTextCopied(false);
      }, 3000);
    };

    if (user == null) return null;

    const truncatedAddress = ethereumUtils.truncateAddress(
      checksumEncodeAddress(user.walletAddress)
    );

    return (
      <div
        ref={ref}
        css={css({
          width: "27rem",
          minWidth: 0,
          borderRadius: "0.4rem",
          overflow: "hidden",
        })}
      >
        <div
          style={{ display: "flex", alignItems: "center", padding: "1.2rem" }}
        >
          <AccountAvatar
            highRes
            transparent
            address={user.walletAddress}
            size="6.6rem"
            // borderRadius="0.5rem"
            style={{ marginRight: "1.2rem" }}
          />
          <div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <h2
                css={(t) =>
                  css({
                    color: t.colors.header,
                    fontSize: t.text.sizes.large,
                    fontWeight: t.text.weights.smallHeader,
                    lineHeight: 1.2,
                  })
                }
              >
                {displayName}
              </h2>

              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <div
                    css={(t) =>
                      css({
                        marginLeft: "0.8rem",
                        width: "0.7rem",
                        height: "0.7rem",
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
                <Tooltip.Content dark side="top" align="center" sideOffset={6}>
                  User {user.onlineStatus === "online" ? "online" : "offline"}
                </Tooltip.Content>
              </Tooltip.Root>
            </div>
            <div
              css={(t) =>
                css({
                  fontSize: t.text.sizes.small,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: t.colors.textDimmed,
                })
              }
            >
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <a
                    href={`https://etherscan.io/address/${user.walletAddress}`}
                    rel="noreferrer"
                    target="_blank"
                    css={css({
                      color: "inherit",
                      textDecoration: "none",
                      ":hover": { textDecoration: "underline" },
                    })}
                  >
                    {displayName === ensName
                      ? truncatedAddress
                      : displayName === truncatedAddress
                      ? ensName
                      : ensName == null
                      ? truncatedAddress
                      : `${ensName} (${truncatedAddress})`}
                  </a>
                </Tooltip.Trigger>
                <Tooltip.Content side="top" align="start" sideOffset={4}>
                  <div>
                    Click to see address on{" "}
                    <span css={(t) => css({ color: t.colors.link })}>
                      etherscan.io
                    </span>
                    <div css={(t) => css({ color: t.colors.textDimmed })}>
                      {checksumEncodeAddress(user.walletAddress)}
                    </div>
                  </div>
                </Tooltip.Content>
              </Tooltip.Root>
            </div>
          </div>
        </div>

        <div
          css={(t) =>
            css({
              padding: "1.2rem",
              borderTop: "0.1rem solid",
              borderColor: t.colors.borderLighter,
            })
          }
        >
          {user.description != null && (
            <div
              css={(t) =>
                css({ fontSize: t.text.sizes.default, marginBottom: "1.2rem" })
              }
            >
              {user.description}
            </div>
          )}
          <div
            css={css({
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0,1fr))",
              gridGap: "1.2rem",
            })}
          >
            <Button size="small" onClick={sendMessage}>
              {isMe ? "My DM" : "Message"}
            </Button>
            {isMe ? (
              <Button
                size="small"
                onClick={() => {
                  dismiss();
                  openEditProfileDialog();
                }}
              >
                Edit profile
              </Button>
            ) : (
              <Button
                size="small"
                onClick={copyWalletAddress}
                style={{ whiteSpace: "nowrap", textOverflow: "ellipsis" }}
              >
                {textCopied ? "Address copied" : "Copy address"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }
);

export default ProfilePreview;
