import isToday from "date-fns/isToday";
import isYesterday from "date-fns/isYesterday";
import isThisYear from "date-fns/isThisYear";
import { utils as ethersUtils } from "ethers";
import React from "react";
import { css } from "@emotion/react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAccount as useConnectedWalletAccount, useProvider } from "wagmi";
import { ethereum as ethereumUtils } from "@shades/common/utils";
import { useWallet, useWalletLogin } from "@shades/common/wallet";
import {
  useSelectors,
  useActions,
  useAuth,
  // useMe,
  useUserWithWalletAddress,
  useIsUserStarred,
} from "@shades/common/app";
import Button from "@shades/ui-web/button";
import { Duplicate as DuplicateIcon } from "@shades/ui-web/icons";
import useFetch from "../hooks/fetch.js";
import { useDialog } from "../hooks/dialogs.js";
import useAccountDisplayName from "../hooks/account-display-name.js";
import * as Tooltip from "./tooltip.js";
import * as Tabs from "./tabs.js";
import Delay from "./delay.js";
import FormattedDate from "./formatted-date.js";
import Spinner from "./spinner.js";
import NavBar from "./nav-bar.js";
import Heading from "./heading.js";
import UserAvatar from "./user-avatar.js";

const { truncateAddress } = ethereumUtils;

const prettifyAddress = (a) => truncateAddress(ethersUtils.getAddress(a));

const fetchAccountTransactions = async (accountAddress, query = {}) => {
  const searchParams = new URLSearchParams({
    "account-address": accountAddress,
    ...query,
  });
  const res = await fetch(
    `${process.env.EDGE_API_BASE_URL}/account-transactions?${searchParams}`
  );
  const body = await res.json();
  if (!res.ok) return Promise.reject(body);
  return body.results;
};

const useAccountTransactions = (accountAddress) => {
  const [transactions, setTransactions] = React.useState([]);

  useFetch(
    () =>
      fetchAccountTransactions(accountAddress).then((ts) => {
        setTransactions(ts);
      }),
    [accountAddress]
  );

  return transactions;
};

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
  const { starUser, unstarUser } = useActions();

  const { address: connectedWalletAccountAddress } =
    useConnectedWalletAccount();
  const { connect: connectWallet } = useWallet();
  const { login: initAccountVerification } = useWalletLogin();

  const { status: authenticationStatus } = useAuth();
  // const me = useMe();
  const user = useUserWithWalletAddress(accountAddress);
  const displayName = useAccountDisplayName(accountAddress);
  const isStarred = useIsUserStarred(user?.id);

  const {
    open: openAccountAuthenticationDialog,
    dismiss: dismissAccountAuthenticationDialog,
  } = useDialog("account-authentication");

  // const isMe =
  //   me != null &&
  //   me.walletAddress.toLowerCase() === accountAddress.toLowerCase();

  const truncatedAddress = prettifyAddress(accountAddress);

  const [hasPendingStarRequest, setPendingStarRequest] = React.useState(false);
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
        {/* <UserAvatar */}
        {/*   walletAddress={accountAddress} */}
        {/*   style={{ marginRight: "1.1rem" }} */}
        {/* /> */}

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
          }}
        >
          <Heading css={css({ minWidth: 0 })}>{displayName}</Heading>

          {/* {user?.description != null && ( */}
          {/*   <> */}
          {/*     <div */}
          {/*       role="separator" */}
          {/*       aria-orientation="vertical" */}
          {/*       css={(t) => */}
          {/*         css({ */}
          {/*           width: "0.1rem", */}
          {/*           height: "1.8rem", */}
          {/*           background: t.colors.borderLight, */}
          {/*           margin: "0 1.1rem", */}
          {/*         }) */}
          {/*       } */}
          {/*     /> */}

          {/*     <div */}
          {/*       css={(t) => */}
          {/*         css({ */}
          {/*           flex: 1, */}
          {/*           minWidth: 0, */}
          {/*           color: t.colors.textDimmed, */}
          {/*           marginRight: "1.1rem", */}
          {/*           whiteSpace: "nowrap", */}
          {/*           overflow: "hidden", */}
          {/*           textOverflow: "ellipsis", */}
          {/*           userSelect: "text", */}
          {/*           maxWidth: "100%", */}
          {/*         }) */}
          {/*       } */}
          {/*     > */}
          {/*       {user.description} */}
          {/*     </div> */}
          {/*   </> */}
          {/* )} */}
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
                fontSize: t.text.sizes.default,
                marginRight: "1.1rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                userSelect: "text",
                maxWidth: "100%",
              })
            }
          >
            {/* {truncatedAddress} */}
            {accountAddress}
          </div>
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
            padding: "6rem 0 0",
            color: t.colors.textNormal,
            fontSize: t.text.sizes.large,
            overflowY: "scroll",
            overflowX: "hidden",
          })
        }
      >
        <div css={css({ padding: "0 1.6rem 3rem" })}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ marginRight: "1.2rem" }}>
              <UserAvatar
                walletAddress={accountAddress}
                transparent
                highRes
                size="6.6rem"
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
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
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      ethersUtils.getAddress(accountAddress)
                    );
                    setTextCopied(true);
                    setTimeout(() => {
                      setTextCopied(false);
                    }, 2000);
                  }}
                  css={(t) =>
                    css({
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: t.text.sizes.base,
                      color: t.colors.textNormal,
                      padding: "0.2rem",
                      margin: "-0.2rem",
                      "@media(hover: hover)": {
                        cursor: "pointer",
                        "[data-icon]": { opacity: 0 },
                        ":hover [data-icon]": { opacity: 1 },
                      },
                    })
                  }
                >
                  {textCopied ? (
                    "Address copied"
                  ) : (
                    <>
                      <div style={{ marginRight: "0.6rem" }}>
                        {truncatedAddress}
                      </div>
                      <DuplicateIcon data-icon style={{ width: "1.4rem" }} />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
          {user?.description != null && (
            <div css={css({ marginTop: "2rem" })}>{user.description}</div>
          )}
          <div css={css({ marginTop: "2rem", display: "flex" })}>
            <div
              css={css({
                display: "grid",
                gridAutoFlow: "column",
                gridAutoColumns: "minmax(0,1fr)",
                gridGap: "1.2rem",
                "@media(min-width: 320px)": {
                  gridAutoColumns: "minmax(12rem, auto)",
                },
              })}
            >
              {(authenticationStatus !== "authenticated" || user != null) && (
                <Button
                  size="medium"
                  variant="primary"
                  disabled={
                    authenticationStatus === "loading" || hasPendingStarRequest
                  }
                  isLoading={hasPendingStarRequest}
                  onClick={async () => {
                    setPendingStarRequest(true);

                    try {
                      if (authenticationStatus !== "authenticated") {
                        openAccountAuthenticationDialog({
                          title: "Verify account",
                          subtitle: `Verify account to follow ${displayName}`,
                        });
                        if (connectedWalletAccountAddress == null)
                          await connectWallet();
                        await initAccountVerification(
                          connectedWalletAccountAddress
                        );
                        dismissAccountAuthenticationDialog();
                      }

                      const user = await new Promise((resolve) => {
                        const scheduleCheck = () =>
                          setTimeout(() => {
                            if (selectors.selectHasFetchedUserChannels()) {
                              resolve(
                                selectors.selectUserFromWalletAddress(
                                  accountAddress
                                )
                              );
                              return;
                            }

                            scheduleCheck();
                          }, 500);

                        scheduleCheck();
                      });

                      if (user == null) return;

                      if (isStarred == null || !isStarred) {
                        await starUser(user.id);
                      } else {
                        await unstarUser(user.id);
                      }
                    } finally {
                      setPendingStarRequest(false);
                      dismissAccountAuthenticationDialog();
                    }
                  }}
                >
                  {isStarred ? "Unfollow" : "Follow"}
                </Button>
              )}

              <Button
                size="medium"
                onClick={() => {
                  const dmChannel = selectors.selectDmChannelFromUserId(
                    user?.id
                  );

                  if (dmChannel != null) {
                    navigate(`/channels/${dmChannel.id}`);
                    return;
                  }

                  const newMessageUrl = `/new?account=${accountAddress}`;

                  // Push navigation will be ignored from /new since the search params are
                  // controlled from state
                  if (location.pathname === "/new") {
                    window.location = newMessageUrl;
                    return;
                  }

                  navigate(newMessageUrl);
                }}
              >
                Message
              </Button>
            </div>
          </div>
        </div>
        <Tabs.Root
          size="large"
          aria-label="Account tabs"
          defaultSelectedKey="transactions"
          disabledKeys={["messages", "channels"]}
          css={css({ padding: "0 1.6rem" })}
        >
          <Tabs.Item key="messages" title="Messages" />
          <Tabs.Item key="channels" title="Channels" />
          <Tabs.Item key="transactions" title="Transactions">
            <TransactionsTabPane accountAddress={accountAddress} />
          </Tabs.Item>
        </Tabs.Root>
      </div>
    </div>
  );
};

const TransactionsTabPane = ({ accountAddress }) => {
  const transactions = useAccountTransactions(accountAddress);
  return (
    <div style={{ padding: "1.6rem" }}>
      <ul
        css={(t) =>
          css({
            overflowY: "hidden",
            overflowX: "auto",
            listStyle: "none",
            whiteSpace: "nowrap",
            li: {
              display: "grid",
              gridGap: "1.6rem",
              justifyContent: "flex-start",
              gridTemplateColumns: "minmax(0, 1fr) auto",
            },
            "li > *": {
              overflow: "hidden",
              textOverflow: "ellipsis",
            },
            "[data-arrow]": {
              color: t.colors.textDimmed,
              fontSize: t.text.sizes.base,
            },
            "[data-date]": {
              color: t.colors.textDimmed,
              fontSize: t.text.sizes.small,
            },
            "[data-tag]": {
              display: "inline-flex",
              alignItems: "center",
              color: t.colors.textNormal,
              background: t.colors.backgroundModifierHover,
              fontSize: t.text.sizes.base,
              borderRadius: "1.3rem",
              padding: "0.3rem 1rem",
            },
            "li + li": { marginTop: "1rem" },
            "a[data-tag]": {
              textDecoration: "none",
              "@media(hover: hover)": {
                ":hover": {
                  textDecoration: "underline",
                  background: t.colors.backgroundModifierHoverStrong,
                },
              },
            },
          })
        }
      >
        {transactions.map((t) => {
          const functionName = t.functionName.includes("(")
            ? t.functionName.slice(0, t.functionName.indexOf("("))
            : t.functionName || null;
          const eth = ethersUtils.formatEther(t.value);
          const [wholeEth, ethDecimals] = eth.split(".");
          const date = new Date(parseInt(t.timeStamp) * 1000);
          const showYear = !isThisYear(date);

          const parseCamelCasedString = (str) => {
            const parsed = str.replace(
              /[A-Z]+(?![a-z])|[A-Z]/g,
              (matchCapitalLetter, matchOffset) =>
                `${matchOffset === 0 ? "" : " "
                }${matchCapitalLetter.toLowerCase()}`
            );
            return `${parsed[0].toUpperCase()}${parsed.slice(1)}`;
          };

          const renderEthTxLinkTag = () => (
            <a
              href={`https://etherscan.io/tx/${t.hash}`}
              rel="noreferrer"
              target="_blank"
              data-tag
            >
              {eth === "0.0" ? (
                "0"
              ) : ethDecimals.length <= 3 ? (
                eth
              ) : (
                <>
                  {wholeEth}.{ethDecimals.slice(0, 3)}
                  ...
                </>
              )}{" "}
              {"Ξ"}
            </a>
          );

          if (functionName == null && eth === "0.0") console.log(t);

          return (
            <li key={t.hash} rel="noreferrer" target="_blank">
              {/* <Link */}
              {/*   component="a" */}
              {/*   href={`https://etherscan.io/tx/${t.hash}`} */}
              {/*   target="_blank" */}
              {/* > */}
              {/*   <span data-hash>{t.hash}</span> */}
              {/* </Link> */}
              <div
                style={{
                  display: "grid",
                  gridAutoFlow: "column",
                  gridAutoColumns: "auto",
                  gridGap: "1rem",
                  alignItems: "center",
                  justifyContent: "flex-start",
                  overflowX: "scroll",
                }}
              >
                {functionName == null ? (
                  <>
                    <AccountLink address={t.from} />
                    {ethDecimals.length <= 3 ? (
                      renderEthTxLinkTag()
                    ) : (
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          {renderEthTxLinkTag()}
                        </Tooltip.Trigger>
                        <Tooltip.Content side="top" sideOffset={5}>
                          {eth} {"Ξ"}
                        </Tooltip.Content>
                      </Tooltip.Root>
                    )}
                    <span data-arrow>&rarr;</span>
                    <AccountLink address={t.to} />
                  </>
                ) : (
                  <>
                    <a
                      href={`https://etherscan.io/tx/${t.hash}`}
                      rel="noreferrer"
                      target="_blank"
                      data-tag
                    >
                      {parseCamelCasedString(functionName)}
                    </a>
                    <span data-arrow>&rarr;</span>
                    <AccountLink address={t.to} />
                  </>
                )}
              </div>
              <div data-date>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <span>
                      {isToday(date) ? (
                        <FormattedDate
                          value={date}
                          hour="numeric"
                          minute="numeric"
                        />
                      ) : isYesterday(date) ? (
                        <>
                          Yesterday{" "}
                          <FormattedDate
                            value={date}
                            hour="numeric"
                            minute="numeric"
                          />
                        </>
                      ) : (
                        <FormattedDate
                          value={date}
                          month="short"
                          day="numeric"
                          year={showYear ? "numeric" : undefined}
                          hour="numeric"
                          minute="numeric"
                        />
                      )}
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Content side="top" sideOffset={5}>
                    <FormattedDate
                      value={date}
                      weekday="long"
                      hour="numeric"
                      minute="numeric"
                      day="numeric"
                      month="long"
                    />
                  </Tooltip.Content>
                </Tooltip.Root>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const AccountLink = React.memo(({ address }) => {
  const displayName = useAccountDisplayName(address);
  return (
    <a
      href={`https://etherscan.io/address/${address}`}
      rel="noreferrer"
      target="_blank"
      data-tag
      style={{ paddingLeft: "0.3rem" }}
    >
      <UserAvatar
        walletAddress={address}
        transparent
        size="2rem"
        css={(t) =>
          css({
            background: t.colors.backgroundModifierHoverStrong,
            marginRight: "0.5rem",
          })
        }
      />
      {displayName}
    </a>
  );
});

export default AccountProfileScreen;
