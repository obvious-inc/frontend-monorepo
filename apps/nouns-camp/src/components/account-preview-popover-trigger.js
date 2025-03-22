import { getAddress as checksumEncodeAddress } from "viem";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useEnsAvatar } from "wagmi";
import { css } from "@emotion/react";
import {
  ethereum as ethereumUtils,
  array as arrayUtils,
} from "@shades/common/utils";
import * as DropdownMenu from "@shades/ui-web/dropdown-menu";
import {
  DotsHorizontal as DotsHorizontalIcon,
  Fullscreen as FullscreenIcon,
} from "@shades/ui-web/icons";
import Button from "@shades/ui-web/button";
import * as Popover from "@shades/ui-web/popover";
import InlineButton from "@shades/ui-web/inline-button";
import Avatar from "@shades/ui-web/avatar";
import { resolveAddress as resolveContractAddress } from "@/contracts";
import { CHAIN_ID } from "@/constants/env";
import { pickDisplayName as pickFarcasterAccountDisplayName } from "@/utils/farcaster";
import { buildEtherscanLink } from "@/utils/etherscan";
import { useActions, useDelegate, useAccount } from "@/store";
import { useWallet } from "@/hooks/wallet";
import { useDialog } from "@/hooks/global-dialogs";
import useEnsName from "@/hooks/ens-name";
import useAccountDisplayName from "@/hooks/account-display-name";
import { useAccountsWithVerifiedEthAddress as useFarcasterAccountsWithVerifiedEthAddress } from "@/hooks/farcaster";
import AccountAvatar from "@/components/account-avatar";
import NounPreviewPopoverTrigger from "@/components/noun-preview-popover-trigger";
import NextLink from "next/link";

const isProduction = process.env.NODE_ENV === "production";

const isDebugSession =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("debug") != null;

const AccountPreviewPopoverTrigger = React.forwardRef(
  (
    {
      accountAddress,
      showAvatar = false,
      avatarFallback = false,
      avatarBackground,
      fallbackImageUrl,
      fallbackDisplayName: fallbackDisplayName_,
      customDisplayName,
      variant: buttonVariant = "link",
      popoverPlacement = "top",
      children,
      ...props
    },
    triggerRef,
  ) => {
    const contract = resolveContractAddress(accountAddress);
    const fallbackDisplayName = fallbackDisplayName_ ?? contract?.name;

    const avatar = showAvatar ? (
      <AccountAvatar
        address={accountAddress}
        size="1.2em"
        placeholder={avatarFallback}
        background={avatarBackground}
        fallbackImageUrl={fallbackImageUrl}
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
          <InlineAccountButton
            ref={triggerRef}
            address={accountAddress}
            variant={buttonVariant}
            customDisplayName={customDisplayName}
            fallbackDisplayName={fallbackDisplayName}
            {...props}
          />
        );

      return (
        <button
          ref={triggerRef}
          className="account-preview-trigger"
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
          <InlineAccountButton
            data-display-name
            component="div"
            address={accountAddress}
            variant={buttonVariant}
            customDisplayName={customDisplayName}
            fallbackDisplayName={fallbackDisplayName}
            {...props}
          />
        </button>
      );
    };

    return (
      <Popover.Root placement={popoverPlacement} {...props}>
        <Popover.Trigger asChild>{renderTrigger()}</Popover.Trigger>
        <Popover.Content
          css={css({
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            "& > *": {
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            },
          })}
        >
          <AccountPreview accountAddress={accountAddress} />
        </Popover.Content>
      </Popover.Root>
    );
  },
);

const AccountPreview = React.forwardRef(({ accountAddress, close }, ref) => {
  const { address: connectedAccountAddress } = useWallet();
  const connectedAccount = useAccount(connectedAccountAddress);
  const farcasterAccounts =
    useFarcasterAccountsWithVerifiedEthAddress(accountAddress);

  const isMe = accountAddress.toLowerCase() === connectedAccountAddress;
  const enableImpersonation = !isMe && (!isProduction || isDebugSession);
  const enableDelegation = connectedAccount?.nouns?.length > 0;

  const account = useAccount(accountAddress);
  const delegate = useDelegate(accountAddress);

  const representedNouns = delegate?.nounsRepresented ?? [];
  const ownedNouns = account?.nouns ?? [];

  const isDelegating =
    // We only care about delegation status if there are nouns to delegate
    ownedNouns.length > 0 &&
    account?.delegateId != null &&
    account.delegateId !== accountAddress;

  const delegatedRepresentedNouns = representedNouns.filter(
    (n) => n.ownerId !== accountAddress,
  );

  const representedNounsByOwner = arrayUtils.groupBy(
    (n) => n.ownerId,
    representedNouns,
  );
  const delegatedRepresentedNounOwnerAccounts = Object.entries(
    representedNounsByOwner,
  )
    .filter(([ownerId]) => ownerId !== accountAddress)
    .map(([accountAddress, nouns]) => ({ id: accountAddress, nouns }));

  const resolvedContract = resolveContractAddress(accountAddress);
  const truncatedAddress = ethereumUtils.truncateAddress(
    checksumEncodeAddress(accountAddress),
  );
  const displayName_ = useAccountDisplayName(accountAddress);
  const displayName =
    displayName_ !== truncatedAddress
      ? displayName_
      : (resolvedContract?.name ?? displayName_);

  const ensName = useEnsName(accountAddress);
  const { data: ensAvatarUrl } = useEnsAvatar({
    name: ensName,
    chainId: CHAIN_ID,
    query: {
      enabled: ensName != null,
    },
  });

  const { open: openDelegationDialog } = useDialog("delegation");

  const accountLink = `/voters/${ensName ?? accountAddress}`;

  const { fetchAccount, fetchDelegate } = useActions();

  const { isPending: accountDataIsPending } = useQuery({
    queryKey: ["account", accountAddress],
    queryFn: () => fetchAccount(accountAddress),
  });
  useQuery({
    queryKey: ["delegate", accountAddress],
    queryFn: () => fetchDelegate(accountAddress),
  });

  const showStatus = !accountDataIsPending || account != null;

  return (
    <div
      ref={ref}
      css={css({
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        width: "min-content",
        maxWidth: "min(36.4rem, calc(100vw - 2rem))",
        minWidth: "min(27.8rem, calc(100vw - 2rem))",
        borderRadius: "0.4rem",
        overflow: "hidden",
      })}
    >
      {showStatus && (
        <div
          css={(t) =>
            css({
              flex: 1,
              minHeight: 0,
              overflow: "auto",
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
              ".nowrap": {
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              },
            })
          }
        >
          {representedNouns?.length === 0 && ownedNouns.length === 0 && (
            <h2>No voting power</h2>
          )}
          {representedNouns?.length > 0 && (
            <>
              <h2>
                Representing{" "}
                {representedNouns.length === 1 ? (
                  <NounPreviewPopoverTrigger nounId={representedNouns[0].id} />
                ) : (
                  <>
                    {representedNouns.length}{" "}
                    {representedNouns.length === 1 ? "noun" : "nouns"}
                  </>
                )}
                {delegatedRepresentedNouns.length > 0 &&
                  (() => {
                    const delegators = arrayUtils
                      .sortBy(
                        { value: ({ nouns }) => nouns.length, order: "desc" },
                        delegatedRepresentedNounOwnerAccounts,
                      )
                      .map(({ id, nouns }, index, accounts) => {
                        const isLast = index === accounts.length - 1;
                        return (
                          <React.Fragment key={id}>
                            {index > 0 && <>, {isLast && "and "}</>}
                            <span className="nowrap">
                              <AccountPreviewPopoverTrigger
                                accountAddress={id}
                              />
                              {accounts.length > 1 && <> ({nouns.length})</>}
                            </span>
                          </React.Fragment>
                        );
                      });

                    if (!isDelegating && ownedNouns.length > 0)
                      return (
                        <>
                          , of which {ownedNouns.length} owned, and{" "}
                          {delegatedRepresentedNouns.length} delegated from{" "}
                          {delegators}
                        </>
                      );

                    return <>, delegated from {delegators}</>;
                  })()}
              </h2>
              {representedNouns.length > 1 && (
                <NounList
                  nouns={representedNouns}
                  contextAccount={accountAddress}
                />
              )}
            </>
          )}
          {isDelegating && ownedNouns?.length > 0 && (
            <>
              <h2>
                Delegating{" "}
                {ownedNouns.length === 1 ? (
                  <NounPreviewPopoverTrigger
                    nounId={ownedNouns[0].id}
                    contextAccount={accountAddress}
                  />
                ) : representedNouns.length > 0 ? (
                  <>
                    {ownedNouns.length}{" "}
                    {ownedNouns.length === 1 ? "noun" : "nouns"}
                  </>
                ) : (
                  <>
                    votes
                    {ownedNouns.length > 3 && <> ({ownedNouns.length})</>}
                  </>
                )}{" "}
                to{" "}
                <AccountPreviewPopoverTrigger
                  showAvatar
                  accountAddress={account.delegateId}
                />
              </h2>
              {ownedNouns.length > 1 && (
                <NounList nouns={ownedNouns} contextAccount={accountAddress} />
              )}
            </>
          )}
        </div>
      )}

      <div
        css={css({
          display: "flex",
          alignItems: "center",
          padding: "1rem 1.2rem",
          gap: "1.6rem",
        })}
      >
        <div css={css({ flex: 1, minWidth: 0 })}>
          <NextLink
            prefetch
            href={accountLink}
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
          </NextLink>
        </div>
        <div
          css={css({
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
          })}
        >
          <Button
            size="default"
            component={NextLink}
            prefetch
            href={accountLink}
            icon={
              <FullscreenIcon
                style={{
                  width: "1.2rem",
                  height: "auto",
                  transform: "scaleX(-1)",
                }}
              />
            }
          />
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
                    !enableDelegation
                      ? null
                      : isMe
                        ? {
                            id: "manage-delegation",
                            label: "Manage delegation",
                          }
                        : {
                            id: "delegate-to-account",
                            label: "Delegate to this account",
                          },
                    {
                      id: "copy-account-address",
                      label: "Copy account address",
                    },
                    enableImpersonation && {
                      id: "impersonate-account",
                      label: "Impersonate account",
                    },
                  ].filter(Boolean),
                },
                {
                  id: "external",
                  children: [
                    ...(farcasterAccounts ?? []).map((farcasterAccount) => ({
                      id: `open-warpcast:${farcasterAccount.fid}`,
                      label: (
                        <div>
                          Warpcast
                          <div
                            css={(t) =>
                              css({
                                marginTop: "0.2rem",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                fontSize: t.text.sizes.small,
                                color: t.colors.textDimmed,
                              })
                            }
                          >
                            {(() => {
                              const { username, pfpUrl } = farcasterAccount;
                              const displayName =
                                pickFarcasterAccountDisplayName(
                                  farcasterAccount,
                                );
                              return (
                                <span
                                  title={[
                                    displayName,
                                    username != displayName && `(@${username})`,
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                >
                                  {pfpUrl != null && (
                                    <Avatar
                                      url={pfpUrl}
                                      size="1.2em"
                                      css={css({
                                        display: "inline-block",
                                        marginRight: "0.3em",
                                        verticalAlign: "sub",
                                      })}
                                    />
                                  )}
                                  {displayName}
                                  {username !== displayName && (
                                    <> (@{username})</>
                                  )}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      ),
                    })),
                    {
                      id: "open-etherscan",
                      label: "Etherscan",
                    },
                    {
                      id: "open-agora",
                      label: "Agora",
                    },
                    {
                      id: "open-rainbow",
                      label: "Rainbow",
                    },
                  ].filter(Boolean),
                },
              ]}
              onAction={(key) => {
                if (key.startsWith("open-warpcast:")) {
                  const fid = key.split(":")[1];
                  const farcasterAccount = farcasterAccounts.find(
                    (a) => String(a.fid) === fid,
                  );
                  if (farcasterAccount == null) throw new Error();
                  window.open(
                    `https://warpcast.com/${farcasterAccount.username}`,
                    "_blank",
                  );
                  return;
                }

                switch (key) {
                  case "manage-delegation":
                    openDelegationDialog();
                    close();
                    break;

                  case "delegate-to-account":
                    openDelegationDialog({ target: accountAddress });
                    close();
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

                  case "open-etherscan":
                    window.open(
                      buildEtherscanLink(`/address/${accountAddress}`),
                      "_blank",
                    );
                    break;

                  case "open-agora":
                    window.open(
                      `https://nounsagora.com/delegate/${accountAddress}`,
                      "_blank",
                    );
                    break;

                  case "open-rainbow":
                    window.open(
                      `https://rainbow.me/${accountAddress}`,
                      "_blank",
                    );
                    break;
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

const InlineAccountButton = React.forwardRef(
  (
    {
      address,
      variant = "button",
      customDisplayName,
      fallbackDisplayName,
      children,
      ...props
    },
    ref,
  ) => {
    const displayName = useAccountDisplayName(address);
    const displayNameOrFallback =
      fallbackDisplayName == null ||
      displayName !== ethereumUtils.truncateAddress(address)
        ? displayName
        : fallbackDisplayName;

    return (
      // {children} need to be rendered to work in Slate editor
      <InlineButton
        ref={ref}
        variant={variant}
        {...props}
        css={css({ userSelect: "text" })}
      >
        {variant === "button" && "@"}
        {customDisplayName ?? displayNameOrFallback}
        {children}
      </InlineButton>
    );
  },
);

const NounList = ({ nouns = [], contextAccount }) => (
  <ul
    css={css({
      display: "flex",
      gap: "1.2rem",
      flexWrap: "wrap",
      justifyContent: "flex-start",
      paddingTop: "0.2rem",
      marginBottom: "-0.2rem",
      listStyle: "none",
    })}
  >
    {arrayUtils
      .sortBy(
        { value: (n) => n.ownerId === contextAccount },
        { value: (n) => parseInt(n.id), order: "asc" },
        nouns,
      )
      .map((n) => (
        <li key={n.id}>
          <NounPreviewPopoverTrigger
            nounId={n.id}
            contextAccount={contextAccount}
            variant="portrait"
          />
        </li>
      ))}
  </ul>
);

export default AccountPreviewPopoverTrigger;
