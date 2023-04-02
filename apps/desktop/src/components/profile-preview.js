import React from "react";
import { css } from "@emotion/react";
import {
  useSelectors,
  useMe,
  useUser,
  useUserWithWalletAddress,
} from "@shades/common/app";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import Button from "@shades/ui-web/button";
import useAccountDisplayName from "../hooks/account-display-name";
import UserAvatar from "./user-avatar";
import * as Tooltip from "./tooltip";
import { useNavigate } from "react-router-dom";

const ProfilePreview = React.forwardRef(({ userId, walletAddress }, ref) => {
  const [textCopied, setTextCopied] = React.useState(false);
  const navigate = useNavigate();

  const selectors = useSelectors();
  const me = useMe();

  const userFromId = useUser(userId);
  const userFromWalletAddress = useUserWithWalletAddress(walletAddress);
  const user =
    userFromId ??
    userFromWalletAddress ??
    (walletAddress == null ? null : { walletAddress });

  const displayName = useAccountDisplayName(user.walletAddress);

  const isOnline = user?.onlineStatus === "online";

  const sendMessage = () => {
    const dmChannel = selectors.selectDmChannelFromUserId(user.id);

    if (dmChannel != null) {
      navigate(`/channels/${dmChannel.id}`);
      return;
    }

    navigate(`/new?account=${user.walletAddress.toLowerCase()}`);
  };

  const copyWalletAddress = () => {
    navigator.clipboard.writeText(user.walletAddress);
    setTextCopied(true);
    setTimeout(() => {
      setTextCopied(false);
    }, 3000);
  };

  if (user == null) return null;

  const isLoggedInUser = me != null && me.id === user.id;

  const truncatedAddress = ethereumUtils.truncateAddress(user.walletAddress);

  return (
    <div
      ref={ref}
      css={css({
        width: "30rem",
        minWidth: 0,
        borderRadius: "0.4rem",
        overflow: "hidden",
      })}
    >
      <UserAvatar
        highRes
        transparent
        walletAddress={user.walletAddress}
        size="30rem"
        borderRadius={0}
      />
      <div style={{ padding: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <h2
            css={(t) =>
              css({ fontSize: t.text.sizes.large, fontWeight: "400" })
            }
          >
            {displayName}
          </h2>

          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <div
                css={(t) =>
                  css({
                    marginLeft: "1rem",
                    width: "0.8rem",
                    height: "0.8rem",
                    borderRadius: "50%",
                    background: isOnline ? t.colors.onlineIndicator : "none",
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
                {displayName.toLowerCase() === truncatedAddress.toLowerCase()
                  ? user.walletAddress
                  : truncatedAddress}
                {/* : `${userEnsName} (${truncatedAddress})`} */}
              </a>
            </Tooltip.Trigger>
            <Tooltip.Content dark side="top" align="start" sideOffset={4}>
              <div>
                Click to see address on{" "}
                <span css={(t) => css({ color: t.colors.link })}>
                  etherscan.io
                </span>
              </div>
            </Tooltip.Content>
          </Tooltip.Root>
        </div>

        {!isLoggedInUser && (
          <div
            css={css({
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0,1fr))",
              gridGap: "1rem",
              marginTop: "1rem",
            })}
          >
            <Button variant="transparent" size="default" onClick={sendMessage}>
              Message
            </Button>
            <Button
              variant="transparent"
              size="default"
              onClick={copyWalletAddress}
              style={{ whiteSpace: "nowrap", textOverflow: "ellipsis" }}
            >
              {textCopied ? "Address copied" : "Copy address"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
});

export default ProfilePreview;
