"use client";

import React from "react";
import { css } from "@emotion/react";
import { useEnsName } from "wagmi";
import NextLink from "next/link";
import { useDebouncedCallback } from "use-debounce";
import {
  ethereum as ethereumUtils,
  array as arrayUtils,
} from "@shades/common/utils";
import {
  Plus as PlusIcon,
  DotsHorizontal as DotsHorizontalIcon,
} from "@shades/ui-web/icons";
import * as DropdownMenu from "@shades/ui-web/dropdown-menu";
import Input from "@shades/ui-web/input";
import Button from "@shades/ui-web/button";
import Select from "@shades/ui-web/select";
import {
  useDelegates,
  useDelegate,
  useAccount,
  useEnsCache,
} from "../store.js";
import { useSearchParams } from "../hooks/navigation.js";
import { useWallet } from "../hooks/wallet.js";
import { useDialog } from "../hooks/global-dialogs.js";
import useContract from "../hooks/contract.js";
import Layout, { MainContentContainer } from "./layout.js";
import AccountAvatar from "./account-avatar.js";

const isDebugSession =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("debug") != null;

const searchEns = (nameByAddress, rawQuery) => {
  const query = rawQuery.trim().toLowerCase();
  const ensEntries = Object.entries(nameByAddress);

  const matchingRecords = ensEntries.reduce((matches, [address, name]) => {
    const index = name.toLowerCase().indexOf(query);
    if (index === -1) return matches;
    return [...matches, { address, index }];
  }, []);

  return arrayUtils
    .sortBy({ value: (r) => r.index, type: "index" }, matchingRecords)
    .map((r) => r.address);
};

const BrowseAccountsScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const deferredQuery = React.useDeferredValue(query.trim());

  const accounts = useDelegates();
  const { address: treasuryAddress } = useContract("executor");
  const { address: forkEscrowAddress } = useContract("fork-escrow");

  const [sortStrategy, setSortStrategy] = React.useState("voting-power");
  const [sortOrder, setSortOrder] = React.useState("desc");

  const { nameByAddress: primaryEnsNameByAddress } = useEnsCache();

  const matchingAddresses = React.useMemo(() => {
    if (deferredQuery.trim() === "") return null;
    return searchEns(primaryEnsNameByAddress, deferredQuery);
  }, [primaryEnsNameByAddress, deferredQuery]);

  const sortedFilteredAccounts = React.useMemo(() => {
    const accountsExcludingContracts = accounts.filter(
      (a) => a.id !== treasuryAddress && a.id !== forkEscrowAddress,
    );

    const sort = (accounts) =>
      arrayUtils.sortBy(
        { value: (a) => a.nounsRepresented.length, order: sortOrder },
        accounts,
      );

    if (matchingAddresses == null) return sort(accountsExcludingContracts);
    const filteredAccounts = accountsExcludingContracts.filter((a) =>
      matchingAddresses.includes(a.id),
    );
    return sort(filteredAccounts);
  }, [
    matchingAddresses,
    sortOrder,
    accounts,
    treasuryAddress,
    forkEscrowAddress,
  ]);

  const handleSearchInputChange = useDebouncedCallback((query) => {
    // Clear search from path if query is empty
    if (query.trim() === "") {
      setSearchParams(
        (p) => {
          const newParams = new URLSearchParams(p);
          newParams.delete("q");
          return newParams;
        },
        { replace: true },
      );
      return;
    }

    setSearchParams(
      (p) => {
        const newParams = new URLSearchParams(p);
        newParams.set("q", query);
        return newParams;
      },
      { replace: true },
    );
  });

  return (
    <>
      <Layout
        navigationStack={[{ to: "/campers", label: "Campers" }]}
        actions={[
          {
            label: "New Proposal",
            buttonProps: {
              component: NextLink,
              href: "/new",
              icon: <PlusIcon style={{ width: "0.9rem" }} />,
            },
          },
        ]}
      >
        <div css={css({ padding: "0 1.6rem" })}>
          <MainContentContainer narrow>
            <div
              css={css({
                padding: "0 0 3.2rem",
                "@media (min-width: 600px)": {
                  padding: "6rem 0 8rem",
                },
              })}
            >
              <div
                css={(t) =>
                  css({
                    background: t.colors.backgroundPrimary,
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                    display: "flex",
                    alignItems: "center",
                    gap: "1.6rem",
                    margin: "-0.3rem -1.6rem 0",
                    // Top padding to offset the focus box shadow
                    padding: "0.3rem 1.6rem 0",
                    // "@media (min-width: 600px)": {
                    //   marginBottom: "2.8rem",
                    // },
                  })
                }
              >
                <Input
                  placeholder="Search..."
                  defaultValue={query}
                  size="large"
                  onChange={(e) => {
                    handleSearchInputChange(e.target.value);
                  }}
                  css={css({
                    flex: 1,
                    minWidth: 0,
                  })}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "1.6rem",
                  // justifyContent: "flex-end",
                  margin: "2.4rem 0 1.6rem",
                }}
              >
                <Select
                  size="small"
                  aria-label="Sort by"
                  value={sortStrategy}
                  options={[
                    {
                      value: "voting-power",
                      label: "By voting power",
                      property: "Voting power",
                    },
                    {
                      value: "votes-cast",
                      label: "By votes cast",
                      property: "Cast votes",
                      disabled: true,
                    },
                  ]}
                  onChange={(value) => {
                    setSortStrategy(value);
                  }}
                  fullWidth={false}
                  width="max-content"
                  renderTriggerContent={(value, options) => (
                    <>
                      Sort by:{" "}
                      <em
                        css={(t) =>
                          css({
                            fontStyle: "normal",
                            fontWeight: t.text.weights.emphasis,
                          })
                        }
                      >
                        {options.find((o) => o.value === value)?.property}
                      </em>
                    </>
                  )}
                />
                <Select
                  size="small"
                  aria-label="Order"
                  value={sortOrder}
                  options={[
                    {
                      value: "asc",
                      label: "Ascending",
                    },
                    {
                      value: "desc",
                      label: "Descending",
                    },
                  ]}
                  onChange={(value) => {
                    setSortOrder(value);
                  }}
                  fullWidth={false}
                  width="max-content"
                  renderTriggerContent={(value, options) => (
                    <>
                      <span
                        css={css({
                          "@media(max-width: 440px)": { display: "none" },
                        })}
                      >
                        Order:{" "}
                      </span>
                      <em
                        css={(t) =>
                          css({
                            fontStyle: "normal",
                            fontWeight: t.text.weights.emphasis,
                          })
                        }
                      >
                        {options.find((o) => o.value === value)?.label}
                      </em>
                    </>
                  )}
                />
              </div>
              <div>
                <ul
                  css={(t) => {
                    const hoverColor = t.colors.backgroundModifierNormal;
                    return css({
                      listStyle: "none",
                      lineHeight: 1.25,
                      ".dimmed": { color: t.colors.textDimmed },
                      ".small": { fontSize: t.text.sizes.small },
                      "& > li": {
                        position: "relative",
                        ".account-link": {
                          position: "absolute",
                          inset: 0,
                        },
                        ".container": {
                          pointerEvents: "none",
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          gap: "1.2rem",
                          padding: "1.2rem 0",
                        },
                        ".content-container": {
                          flex: 1,
                          minWidth: 0,
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          alignItems: "center",
                          gap: "1.2rem",
                        },
                        ".dots-button": {
                          pointerEvents: "all",
                        },
                        ".display-name": {
                          fontWeight: t.text.weights.emphasis,
                        },
                        ".avatar-placeholder": {
                          width: "3.6rem",
                          height: "3.6rem",
                        },
                      },
                      // Hover enhancement
                      "@media(hover: hover)": {
                        "& > li": { cursor: "pointer" },
                        "& > li:hover": {
                          background: `linear-gradient(90deg, transparent 0%, ${hoverColor} 20%, ${hoverColor} 80%, transparent 100%)`,
                        },
                      },
                    });
                  }}
                >
                  {sortedFilteredAccounts.map((account) => (
                    <li key={account.id}>
                      <AccountListItem address={account.id} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </MainContentContainer>
        </div>
      </Layout>
    </>
  );
};

const AccountListItem = React.memo(({ address: accountAddress }) => {
  const containerRef = React.useRef();
  const { address: connectedAccountAddress } = useWallet();
  const connectedAccount = useAccount(connectedAccountAddress);

  const isMe = accountAddress.toLowerCase() === connectedAccountAddress;
  const enableImpersonation = !isMe && isDebugSession;
  const enableDelegation = connectedAccount?.nouns.length > 0;

  const [isVisible, setVisible] = React.useState(false);

  const delegate = useDelegate(accountAddress);
  const { data: ensName } = useEnsName({
    address: accountAddress,
    enabled: isVisible,
  });
  const truncatedAddress = ethereumUtils.truncateAddress(accountAddress);
  const displayName = ensName ?? truncatedAddress;
  const votingPower = delegate?.nounsRepresented.length;

  const { open: openDelegationDialog } = useDialog("delegation");

  React.useEffect(() => {
    const observer = new window.IntersectionObserver(
      ([entry]) => {
        setVisible((v) => v || entry.isIntersecting);
      },
      { root: null, threshold: 0 },
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <NextLink
        className="account-link"
        href={`/campers/${ensName ?? accountAddress}`}
      />
      <div className="container" ref={containerRef}>
        {isVisible ? (
          <AccountAvatar size="3.6rem" address={accountAddress} />
        ) : (
          <div className="avatar-placeholder" />
        )}
        <div className="content-container">
          <div>
            <span className="display-name">{displayName}</span>
            <br />
            <span className="small dimmed">
              {votingPower != null && (
                <>
                  {displayName !== truncatedAddress && (
                    <>
                      {truncatedAddress} {"\u00B7"}{" "}
                    </>
                  )}
                  {votingPower === 0
                    ? "No voting power"
                    : `${votingPower} voting power`}
                </>
              )}
            </span>
          </div>
          {isVisible && (
            <DropdownMenu.Root
              placement="bottom end"
              offset={18}
              crossOffset={5}
            >
              <DropdownMenu.Trigger asChild>
                <Button
                  variant="transparent"
                  size="small"
                  icon={
                    <DotsHorizontalIcon
                      style={{ width: "1.8rem", height: "auto" }}
                    />
                  }
                  style={{ pointerEvents: "all" }}
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
                ]}
                onAction={(key) => {
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
                      navigator.clipboard.writeText(
                        accountAddress.toLowerCase(),
                      );
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
                        `https://etherscan.io/address/${accountAddress}`,
                        "_blank",
                      );
                      break;

                    case "open-mogu":
                      window.open(
                        `https://mmmogu.com/address/${accountAddress}`,
                        "_blank",
                      );
                      break;

                    case "open-agora":
                      window.open(
                        `https://nounsagora.com/delegate/${accountAddress}`,
                        "_blank",
                      );
                      break;

                    case "open-nounskarma":
                      window.open(
                        `https://nounskarma.xyz/player/${accountAddress}`,
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
          )}
        </div>
      </div>
    </>
  );
});

export default BrowseAccountsScreen;
