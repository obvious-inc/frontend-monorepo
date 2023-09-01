import { getAddress as checksumEncodeAddress } from "viem";
import React from "react";
import { useEnsName } from "wagmi";
import { css } from "@emotion/react";
import {
  useUser,
  useUserWithWalletAddress,
  useAccountDisplayName,
} from "@shades/common/app";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import Button from "./button.js";
import AccountAvatar from "./account-avatar.js";
import * as Tooltip from "./tooltip.js";
import * as Popover from "./popover.js";
import InlineUserButton from "./inline-user-button.js";

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
    triggerRef
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
  }
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
  }
);

export default AccountPreviewPopoverTrigger;
