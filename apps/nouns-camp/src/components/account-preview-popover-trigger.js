import React from "react";
import { useEnsName, useEnsAvatar } from "wagmi";
import { css } from "@emotion/react";
import { useAccountDisplayName } from "@shades/common/app";
import Button from "@shades/ui-web/button";
import * as Popover from "@shades/ui-web/popover";
import InlineUserButton from "@shades/ui-web/inline-user-button";
import { useDelegate } from "../store.js";
import AccountAvatar from "./account-avatar.js";
import NounAvatar from "./noun-avatar.js";

const AccountPreviewPopoverTrigger = React.forwardRef(
  (
    {
      accountAddress,
      showAvatar = false,
      variant: buttonVariant = "link",
      popoverPlacement = "top",
      accountActions = [],
      children,
      ...props
    },
    triggerRef
  ) => {
    const avatar = showAvatar ? (
      <AccountAvatar
        address={accountAddress}
        size="1.2em"
        placeholder={false}
        css={css({
          display: "inline-block",
          marginRight: "0.3em",
          verticalAlign: "sub",
        })}
      />
    ) : null;

    const renderTrigger = () => {
      if (children != null) return children;

      if (avatar == null)
        return (
          <InlineUserButton
            ref={triggerRef}
            walletAddress={accountAddress}
            variant={buttonVariant}
            {...props}
          />
        );

      return (
        <button
          ref={triggerRef}
          css={css({
            outline: "none",
            "@media(hover: hover)": {
              cursor: "pointer",
              ":hover": {
                "[data-display-name]": { textDecoration: "underline" },
              },
            },
          })}
        >
          {avatar}
          <InlineUserButton
            data-display-name
            component="div"
            walletAddress={accountAddress}
            variant={buttonVariant}
            {...props}
          />
        </button>
      );
    };

    return (
      <Popover.Root placement={popoverPlacement} {...props}>
        <Popover.Trigger asChild>{renderTrigger()}</Popover.Trigger>
        <Popover.Content>
          <AccountPreview
            accountAddress={accountAddress}
            actions={accountActions}
          />
        </Popover.Content>
      </Popover.Root>
    );
  }
);

const AccountPreview = React.forwardRef(
  ({ accountAddress, actions = [] }, ref) => {
    const delegate = useDelegate(accountAddress);

    const { displayName, truncatedAddress } =
      useAccountDisplayName(accountAddress);

    const { data: ensName } = useEnsName({ address: accountAddress });
    const { data: ensAvatarUrl } = useEnsAvatar({
      name: ensName,
      enabled: ensName != null,
    });

    return (
      <div
        ref={ref}
        css={css({
          width: "32rem",
          minWidth: 0,
          borderRadius: "0.4rem",
          overflow: "hidden",
        })}
      >
        <div
          css={(t) =>
            css({
              display: "flex",
              flexDirection: "column",
              gap: "0.8rem",
              padding: "1rem 1.2rem",
              borderBottom: "0.1rem solid",
              borderColor: t.colors.borderLighter,
              h2: {
                fontWeight: "400",
                fontSize: t.text.sizes.small,
                color: t.colors.textDimmed,
              },
            })
          }
        >
          <h2>
            {delegate?.nounsRepresented?.length > 0
              ? "Nouns represented"
              : "No delegation currently"}
          </h2>
          {delegate?.nounsRepresented.length > 0 && (
            <div
              css={(t) =>
                css({
                  display: "flex",
                  gap: "1.2rem",
                  flexWrap: "wrap",
                  justifyContent: "flex-start",
                  paddingTop: "0.2rem",
                  marginBottom: "-0.2rem",
                  "[data-id]": {
                    fontSize: t.text.sizes.tiny,
                    color: t.colors.textDimmed,
                    margin: "0.2rem 0 0",
                    textAlign: "center",
                  },
                })
              }
            >
              {delegate.nounsRepresented.map((n) => (
                <div key={n.id}>
                  <NounAvatar id={n.id} seed={n.seed} size="3.2rem" />
                  <div data-id>{n.id}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div
          css={css({
            display: "flex",
            alignItems: "center",
            padding: "1rem 1.2rem",
            gap: "1rem",
          })}
        >
          {ensAvatarUrl != null && (
            <img
              src={ensAvatarUrl}
              css={(t) =>
                css({
                  width: "3.2rem",
                  height: "3.2rem",
                  objectFit: "cover",
                  borderRadius: "0.3rem",
                  background: t.colors.backgroundModifierHover,
                })
              }
            />
          )}
          <div style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
            <a
              href={`https://etherscan.io/address/${accountAddress}`}
              rel="noreferrer"
              target="_blank"
              css={css({
                color: "inherit",
                textDecoration: "none",
                "@media(hover: hover)": {
                  ':hover [data-hover-underline="true"]': {
                    textDecoration: "underline",
                  },
                },
              })}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                <h2
                  data-hover-underline={displayName === truncatedAddress}
                  css={(t) =>
                    css({
                      color: t.colors.header,
                      fontSize: t.text.sizes.large,
                      fontWeight: t.text.weights.header,
                    })
                  }
                >
                  {displayName}
                </h2>
              </div>
              {displayName !== truncatedAddress && (
                <div
                  data-hover-underline="true"
                  css={(t) =>
                    css({
                      fontSize: t.text.sizes.small,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: t.colors.textDimmed,
                    })
                  }
                >
                  {displayName === truncatedAddress
                    ? "Etherscan"
                    : truncatedAddress}
                </div>
              )}
            </a>
          </div>
        </div>

        {actions.length > 0 && (
          <div
            css={(t) =>
              css({
                padding: "1.2rem",
                borderTop: "0.1rem solid",
                borderColor: t.colors.borderLighter,
              })
            }
          >
            {/* {user.description != null && ( */}
            {/*   <div css={(t) => css({ fontSize: t.text.sizes.base })}> */}
            {/*     {user.description} */}
            {/*   </div> */}
            {/* )} */}

            {actions.length > 0 && (
              <div
                css={css({
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                  gridGap: "1.2rem",
                })}
                // style={{
                //   marginTop: user.description == null ? undefined : "1.2rem",
                // }}
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
