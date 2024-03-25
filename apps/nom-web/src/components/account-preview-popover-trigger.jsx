import { getAddress as checksumEncodeAddress } from "viem";
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { css } from "@emotion/react";
import { useAccount, useEnsName } from "wagmi";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import {
  useSelectors,
  useMe,
  useUser,
  useUserWithWalletAddress,
} from "@shades/common/app";
import * as Popover from "@shades/ui-web/popover";
import * as Tooltip from "@shades/ui-web/tooltip";
import Button from "@shades/ui-web/button";
import AccountAvatar from "@shades/ui-web/account-avatar";
import InlineUserButton from "@shades/ui-web/inline-user-button";
import { useDialog } from "../hooks/dialogs";
import useAccountDisplayName from "../hooks/account-display-name";

const useActions = ({ userId, accountAddress }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const selectors = useSelectors();
  const me = useMe();
  const { address: connectedWalletAccountAddress } = useAccount();
  const userFromId = useUser(userId);
  const userFromAccountAddress = useUserWithWalletAddress(accountAddress);
  const user =
    userFromId ??
    userFromAccountAddress ??
    (accountAddress == null ? null : { walletAddress: accountAddress });

  const meWalletAddress =
    me == null ? connectedWalletAccountAddress : me.walletAddress;

  const isMe =
    user != null &&
    meWalletAddress != null &&
    meWalletAddress.toLowerCase() === user?.walletAddress?.toLowerCase();

  const [textCopied, setTextCopied] = React.useState(false);
  const { open: openEditProfileDialog } = useDialog("edit-profile");

  return [
    {
      label: isMe ? "My DM" : "Message",
      onSelect: () => {
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
      },
    },
    isMe
      ? {
          label: "Edit profile",
          onSelect: () => {
            openEditProfileDialog();
          },
        }
      : {
          label: textCopied ? "Address copied" : "Copy address",
          onSelect: () => {
            navigator.clipboard.writeText(user.walletAddress);
            setTextCopied(true);
            setTimeout(() => {
              setTextCopied(false);
            }, 3000);
          },
        },
  ];
};

const AccountPreviewPopoverTrigger = React.forwardRef(
  (
    {
      userId: userId_,
      accountAddress,
      variant: buttonVariant = "link",
      popoverPlacement = "top",
      accountActions = [],
      children,
      ...props
    },
    triggerRef,
  ) => {
    const accountUser = useUserWithWalletAddress(accountAddress);

    const userId = userId_ ?? accountUser?.id;

    const user = useUser(userId);

    if (userId == null && accountAddress == null) return null;

    const disabled = user?.deleted || user?.unknown;

    return (
      <Popover.Root placement={popoverPlacement} {...props}>
        <Popover.Trigger asChild disabled={disabled}>
          {children ?? (
            <InlineUserButton
              ref={triggerRef}
              userId={userId}
              walletAddress={accountAddress}
              variant={buttonVariant}
              {...props}
            />
          )}
        </Popover.Trigger>
        <Popover.Content>
          <AccountPreview
            userId={userId}
            accountAddress={accountAddress}
            actions={accountActions}
          />
        </Popover.Content>
      </Popover.Root>
    );
  },
);

const AccountPreview = React.forwardRef(
  ({ userId, accountAddress, actions = [] }, ref) => {
    const userFromId = useUser(userId);
    const userFromWalletAddress = useUserWithWalletAddress(accountAddress);
    const user =
      userFromId ??
      userFromWalletAddress ??
      (accountAddress == null ? null : { walletAddress: accountAddress });

    const { displayName } = useAccountDisplayName(user.walletAddress);

    const { data: ensName } = useEnsName({ address: user.walletAddress });

    const isOnline = user?.onlineStatus === "online";

    if (user == null) return null;

    const truncatedAddress = ethereumUtils.truncateAddress(
      checksumEncodeAddress(user.walletAddress),
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

              {user?.id != null && (
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
                  <Tooltip.Content
                    portal={false}
                    side="top"
                    align="center"
                    sideOffset={6}
                  >
                    User {user.onlineStatus === "online" ? "online" : "offline"}
                  </Tooltip.Content>
                </Tooltip.Root>
              )}
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
                      "@media(hover: hover)": {
                        ":hover": { textDecoration: "underline" },
                      },
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
                <Tooltip.Content portal={false} side="top" sideOffset={4}>
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

        {(actions.length > 0 || user.description != null) && (
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
              <div css={(t) => css({ fontSize: t.text.sizes.base })}>
                {user.description}
              </div>
            )}

            {actions.length > 0 && (
              <div
                css={css({
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                  gridGap: "1.2rem",
                })}
                style={{
                  marginTop: user.description == null ? undefined : "1.2rem",
                }}
              >
                {actions.map((a, i) => (
                  <Button
                    key={i}
                    size="small"
                    onClick={a.onSelect}
                    style={{ whiteSpace: "nowrap", textOverflow: "ellipsis" }}
                  >
                    {a.label}
                  </Button>
                ))}

                {/* {isMe ? ( */}
                {/*   <Button */}
                {/*     size="small" */}
                {/*     onClick={() => { */}
                {/*       dismiss(); */}
                {/*       openEditProfileDialog(); */}
                {/*     }} */}
                {/*   > */}
                {/*     Edit profile */}
                {/*   </Button> */}
                {/* ) : ( */}
                {/*   <Button */}
                {/*     size="small" */}
                {/*     onClick={copyWalletAddress} */}
                {/*     style={{ whiteSpace: "nowrap", textOverflow: "ellipsis" }} */}
                {/*   > */}
                {/*     {textCopied ? "Address copied" : "Copy address"} */}
                {/*   </Button> */}
                {/* )} */}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

const AccountPreviewPopoverTriggerWithActions = (
  { userId, accountAddress, ...props },
  ref,
) => {
  const actions = useActions({ userId, accountAddress });
  return (
    <AccountPreviewPopoverTrigger
      ref={ref}
      userId={userId}
      accountActions={actions}
      {...props}
    />
  );
};

export default AccountPreviewPopoverTriggerWithActions;
