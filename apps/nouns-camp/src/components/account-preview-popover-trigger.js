import React from "react";
import { useEnsName, useEnsAvatar } from "wagmi";
import { Link as RouterLink } from "react-router-dom";
import { css } from "@emotion/react";
import { useAccountDisplayName } from "@shades/common/app";
import * as DropdownMenu from "@shades/ui-web/dropdown-menu";
import { DotsHorizontal as DotsHorizontalIcon } from "@shades/ui-web/icons";
import Button from "@shades/ui-web/button";
import * as Popover from "@shades/ui-web/popover";
import InlineUserButton from "@shades/ui-web/inline-user-button";
import { useDelegate } from "../store.js";
import AccountAvatar from "./account-avatar.js";
import NounAvatar from "./noun-avatar.js";
import NounPreviewPopoverTrigger from "./noun-preview-popover-trigger.js";
import { Link } from "react-router-dom";

const isAdminSession =
  process.env.NODE_ENV !== "production" ||
  new URLSearchParams(location.search).get("admin") != null;

const AccountPreviewPopoverTrigger = React.forwardRef(
  (
    {
      accountAddress,
      showAvatar = false,
      avatarFallback = false,
      avatarBackground,
      variant: buttonVariant = "link",
      popoverPlacement = "top",
      children,
      ...props
    },
    triggerRef
  ) => {
    const avatar = showAvatar ? (
      <AccountAvatar
        address={accountAddress}
        size="1.2em"
        placeholder={avatarFallback}
        background={avatarBackground}
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
          <AccountPreview accountAddress={accountAddress} />
        </Popover.Content>
      </Popover.Root>
    );
  }
);

const AccountPreview = React.forwardRef(({ accountAddress, close }, ref) => {
  const delegate = useDelegate(accountAddress);

  const { displayName, truncatedAddress } =
    useAccountDisplayName(accountAddress);

  const { data: ensName } = useEnsName({ address: accountAddress });
  const { data: ensAvatarUrl } = useEnsAvatar({
    name: ensName,
    enabled: ensName != null,
  });

  const accountLink = `/campers/${ensName ?? accountAddress}`;

  return (
    <div
      ref={ref}
      css={css({
        width: "min-content",
        maxWidth: "min(calc(100vw - 1.2rem), 36.4rem)",
        minWidth: "32rem",
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
              <NounPreviewPopoverTrigger
                key={n.id}
                nounId={n.id}
                contextAccount={accountAddress}
                popoverPlacement="top"
              >
                <button
                  css={css({
                    outline: "none",
                    "@media(hover: hover)": {
                      cursor: "pointer",
                      ":hover": {
                        "[data-id]": { textDecoration: "underline" },
                      },
                    },
                  })}
                >
                  <NounAvatar id={n.id} size="3.2rem" />
                  <div data-id>{n.id}</div>
                </button>
              </NounPreviewPopoverTrigger>
            ))}
          </div>
        )}
      </div>
      <div
        css={css({
          display: "flex",
          alignItems: "center",
          padding: "1rem 1.2rem",
          gap: "1.6rem",
        })}
      >
        <div css={css({ flex: 1, minWidth: 0 })}>
          <Link
            to={accountLink}
            css={css({
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              color: "inherit",
              textDecoration: "none",
              lineHeight: 1.25,
            })}
          >
            {ensAvatarUrl != null && (
              <div css={css({ width: "3.2rem", height: "3.2rem" })}>
                <img
                  src={ensAvatarUrl}
                  css={(t) =>
                    css({
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: "0.3rem",
                      background: t.colors.backgroundModifierHover,
                    })
                  }
                />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                css={(t) =>
                  css({
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: t.colors.header,
                    fontSize: t.text.sizes.large,
                    fontWeight: t.text.weights.header,
                  })
                }
              >
                {displayName}
              </h2>
              {displayName !== truncatedAddress && (
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
                  {truncatedAddress}
                </div>
              )}
            </div>
          </Link>
        </div>
        <div
          css={css({
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
          })}
        >
          <Button size="default" component={RouterLink} to={accountLink}>
            View profile
          </Button>
          <DropdownMenu.Root placement="bottom end" offset={18} crossOffset={5}>
            <DropdownMenu.Trigger asChild>
              <Button
                size="default"
                icon={
                  <DotsHorizontalIcon
                    style={{ width: "1.8rem", height: "auto" }}
                  />
                }
              />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content
              css={css({
                width: "min-content",
                minWidth: "min-content",
                maxWidth: "calc(100vw - 2rem)",
              })}
              items={[
                {
                  id: "main",
                  children: [
                    {
                      id: "open-etherscan",
                      label: "Etherscan",
                    },
                    {
                      id: "open-mogu",
                      label: "Mogu",
                    },
                    {
                      id: "open-agora",
                      label: "Agora",
                    },
                    {
                      id: "open-nounskarma",
                      label: "NounsKarma",
                    },
                    {
                      id: "open-rainbow",
                      label: "Rainbow",
                    },
                  ],
                },
                {
                  id: "misc",
                  children: [
                    {
                      id: "copy-account-address",
                      label: "Copy account address",
                    },
                    isAdminSession && {
                      id: "impersonate-account",
                      label: "Impersonate account",
                    },
                  ],
                },
              ].filter(Boolean)}
              onAction={(key) => {
                switch (key) {
                  case "open-etherscan":
                    window.open(
                      `https://etherscan.io/address/${accountAddress}`,
                      "_blank"
                    );
                    break;

                  case "open-mogu":
                    window.open(
                      `https://mmmogu.com/address/${accountAddress}`,
                      "_blank"
                    );
                    break;

                  case "open-agora":
                    window.open(
                      `https://nounsagora.com/delegate/${accountAddress}`,
                      "_blank"
                    );
                    break;

                  case "open-nounskarma":
                    window.open(
                      `https://nounskarma.xyz/player/${accountAddress}`,
                      "_blank"
                    );
                    break;

                  case "open-rainbow":
                    window.open(
                      `https://rainbow.me/${accountAddress}`,
                      "_blank"
                    );
                    break;

                  case "copy-account-address":
                    navigator.clipboard.writeText(accountAddress.toLowerCase());
                    close();
                    break;

                  case "impersonate-account": {
                    const searchParams = new URLSearchParams(location.search);
                    searchParams.set("impersonate", accountAddress);
                    location.replace(`${location.pathname}?${searchParams}`);
                    close();
                    break;
                  }
                }
              }}
            >
              {(item) => (
                <DropdownMenu.Section items={item.children}>
                  {(item) => (
                    <DropdownMenu.Item>{item.label}</DropdownMenu.Item>
                  )}
                </DropdownMenu.Section>
              )}
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      </div>
    </div>
  );
});

export default AccountPreviewPopoverTrigger;
