import { utils as ethersUtils } from "ethers";
import React from "react";
import { useAccount } from "wagmi";
import { useNavigate, useSearchParams } from "react-router-dom";
import { css, useTheme } from "@emotion/react";
import { motion } from "framer-motion";
import { useEnsAddress } from "wagmi";
import {
  useListBox,
  useListBoxSection,
  useOption,
  useKeyboard,
  mergeProps,
} from "react-aria";
import {
  useActions,
  useAuth,
  useMe,
  useUsers,
  useAllUsers,
  useMemberChannels,
  usePublicChannels,
  useUserWithWalletAddress,
  useChannel,
  useChannelMembers,
  useChannelName,
  useChannelPermissions,
  useDmChannelWithMember,
  useSortedChannelMessageIds,
} from "@shades/common/app";
import { useWallet, useWalletLogin } from "@shades/common/wallet";
import {
  user as userUtils,
  channel as channelUtils,
  ethereum as ethereumUtils,
  array as arrayUtils,
} from "@shades/common/utils";
import { useLatestCallback } from "@shades/common/react";
import { useState as useSidebarState } from "@shades/ui-web/sidebar-layout";
import {
  CrossSmall as CrossSmallIcon,
  Checkmark as CheckmarkIcon,
  PlusSmall as PlusSmallIcon,
} from "@shades/ui-web/icons";
import Button from "@shades/ui-web/button";
import IconButton from "@shades/ui-web/icon-button";
import Dialog from "@shades/ui-web/dialog";
import { useDialog } from "../hooks/dialogs.js";
import useAccountDisplayName from "../hooks/account-display-name.js";
import useChannelFetchEffects from "../hooks/channel-fetch-effects.js";
import useScrollAwareChannelMessagesFetcher from "../hooks/scroll-aware-channel-messages-fetcher.js";
import Combobox, {
  Item as ComboboxItem,
  Section as ComboboxSection,
} from "./combobox";
import { Grid as FlexGrid, Item as FlexGridItem } from "./flex-grid.js";
import NavBar from "./nav-bar.js";
import UserAvatar from "./user-avatar.js";
import UserAvatarStack from "./user-avatar-stack.js";
import ChannelAvatar from "./channel-avatar.js";
import ErrorBoundary from "./error-boundary.js";
import NewChannelMessageInput from "./new-channel-message-input.js";
import ChannelMessagesScrollView from "./channel-messages-scroll-view.js";
import ChannelPrologue, {
  PersonalDMChannelPrologue,
} from "./channel-prologue.js";
import InlineUserButtonWithProfilePopover from "./inline-user-button-with-profile-popover.js";
import InlineChannelButton from "./inline-channel-button.js";
import Emoji from "./emoji.js";

const INTRO_CHANNEL_ID = "625806ed89bff47879344a9c";

const LazyCreateChannelDialog = React.lazy(() =>
  import("./create-channel-dialog.js")
);

const LazyLoginScreen = React.lazy(() => import("./login-screen.js"));

const MAX_ACCOUNT_MATCH_COUNT = 20;

const { search: searchUsers } = userUtils;
const {
  search: searchChannels,
  createDefaultComparator: createDefaultChannelComparator,
} = channelUtils;
const { truncateAddress } = ethereumUtils;
const { sort } = arrayUtils;

const fetchRelatedAccounts = (accountAddress) =>
  fetch(
    `${
      process.env.EDGE_API_BASE_URL
    }/related-accounts?wallet-address=${accountAddress.toLowerCase()}`
  ).then((res) => {
    if (!res.ok) return [];
    return res.json().then((body) => body.results);
  });

const fetchAccountEnsData = (accountAddress) =>
  fetch(
    `https://api.ensideas.com/ens/resolve/${accountAddress.toLowerCase()}`
  ).then((res) => {
    if (res.ok) return res.json();
    return Promise.reject(res.statusText);
  });

const getKeyItemType = (key) => {
  if (key == null) return null;
  const [type] = key.split("-");
  return type;
};

const getKeyItemIdentifier = (key) => {
  const type = getKeyItemType(key);
  if (type == null) return null;
  return key.slice(type.length + 1);
};

const getIdentifiersOfType = (type, keys) =>
  keys.filter((k) => getKeyItemType(k) === type).map(getKeyItemIdentifier);

const useFilteredAccounts = (query) => {
  const me = useMe();
  const { address: connectedWalletAccountAddress } = useAccount();
  const users = useAllUsers();
  const [relatedAccounts, setRelatedAccounts] = React.useState([]);

  const meAccountAddress = me?.walletAddress ?? connectedWalletAccountAddress;

  React.useEffect(() => {
    if (meAccountAddress == null) return;

    fetchRelatedAccounts(meAccountAddress).then((accountAddresses) => {
      setRelatedAccounts(accountAddresses.map((a) => ({ walletAddress: a })));
      Promise.all(accountAddresses.map((a) => fetchAccountEnsData(a))).then(
        (entries) => {
          setRelatedAccounts(
            entries.map((e) => ({ walletAddress: e.address, ensName: e.name }))
          );
        }
      );
    });
  }, [meAccountAddress]);

  const filteredOptions = React.useMemo(() => {
    if (query.trim() === "") return relatedAccounts;

    const accounts = [...users, ...relatedAccounts];

    const filteredUsers = searchUsers(accounts, query);

    return filteredUsers
      .slice(0, MAX_ACCOUNT_MATCH_COUNT)
      .filter(
        (u) =>
          me == null ||
          u.walletAddress.toLowerCase() !== me.walletAddress.toLowerCase()
      );
  }, [me, users, relatedAccounts, query]);

  return filteredOptions;
};

const useFilteredChannels = (query, { selectedWalletAddresses }) => {
  const channels = useMemberChannels({ name: true, members: true });
  const publicChannels = usePublicChannels({ name: true, members: true });

  const selectedWalletAddressesQuery = selectedWalletAddresses.join(" ");

  const filteredChannels = React.useMemo(() => {
    if (query.trim() === "")
      return channels.length === 0
        ? sort(
            createDefaultChannelComparator(),
            publicChannels.filter((c) => c.memberUserIds.length > 1)
          )
        : [];

    const allChannels = channels.length === 0 ? publicChannels : channels;

    const filteredChannels =
      query.length <= 0
        ? selectedWalletAddressesQuery.length === 0
          ? sort(createDefaultChannelComparator(), allChannels)
          : searchChannels(allChannels, selectedWalletAddressesQuery)
        : searchChannels(allChannels, query);

    return filteredChannels.filter((c) => c.kind !== "dm").slice(0, 3);
  }, [channels, publicChannels, query, selectedWalletAddressesQuery]);

  return filteredChannels;
};

const useExternalAccount = (ensNameOrWalletAddress) => {
  const { data: ensMatchWalletAddress } = useEnsAddress({
    name: /^.+\.eth$/.test(ensNameOrWalletAddress)
      ? ensNameOrWalletAddress
      : `${ensNameOrWalletAddress}.eth`,
    enabled: ensNameOrWalletAddress.length >= 3, // /^.+\.eth$/.test(ensNameOrWalletAddress),
  });

  const account = React.useMemo(
    () =>
      ensMatchWalletAddress != null
        ? { walletAddress: ensMatchWalletAddress }
        : ethersUtils.isAddress(ensNameOrWalletAddress)
        ? { walletAddress: ensNameOrWalletAddress }
        : null,
    [ensMatchWalletAddress, ensNameOrWalletAddress]
  );

  return account;
};

const useExactAccountMatch = (query) => {
  const externalAccount = useExternalAccount(query);
  const user = useUserWithWalletAddress(externalAccount?.walletAddress);
  return user ?? externalAccount;
};

const useFilteredComboboxItems = (query, state) => {
  const deferredQuery = React.useDeferredValue(query.trim().toLowerCase());

  const selectedWalletAddresses = state.selectedKeys.map(getKeyItemIdentifier);

  const exactAccountMatch = useExactAccountMatch(deferredQuery);
  const channels = useFilteredChannels(deferredQuery, {
    selectedWalletAddresses,
  });
  const accounts = useFilteredAccounts(deferredQuery);

  const items = React.useMemo(() => {
    if (ethersUtils.isAddress(deferredQuery))
      return [
        {
          key: "address",
          children: [
            { key: `account-${deferredQuery}`, textValue: deferredQuery },
          ],
        },
      ];

    const channelItems = channels.map((c) => ({
      key: `channel-${c.id}`,
      textValue: c.name ?? "untitled",
    }));

    const accountsExcludingEnsMatch =
      exactAccountMatch == null
        ? accounts
        : accounts.filter(
            (a) =>
              a.walletAddress.toLowerCase() !==
              exactAccountMatch.walletAddress.toLowerCase()
          );

    const accountItems = accountsExcludingEnsMatch.map((a) => ({
      key: `account-${a.walletAddress}`,
      textValue: a.displayName ?? a.walletAddress,
    }));

    return [
      {
        key: "ens",
        title: "ENS match",
        children:
          exactAccountMatch == null
            ? []
            : [
                {
                  key: `account-${exactAccountMatch.walletAddress}`,
                  textValue: exactAccountMatch.walletAddress,
                },
              ],
      },
      { key: "accounts", title: "Accounts", children: accountItems },
      { key: "channels", title: "Channels", children: channelItems },
    ].filter((s) => s.children.length !== 0);
  }, [deferredQuery, exactAccountMatch, channels, accounts]);

  return items;
};

const useRecipientsTagFieldComboboxState = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const recipientsState = useTagFieldComboboxState(() => {
    const accountKeys =
      searchParams
        .get("account")
        ?.split(",")
        .filter(ethersUtils.isAddress)
        .map((a) => `account-${a}`) ?? [];
    const channelKeys =
      searchParams
        .get("channel")
        ?.split(",")
        .map((id) => `channel-${id}`) ?? [];

    return { focusedKey: -1, selectedKeys: [...channelKeys, ...accountKeys] };
  });

  React.useEffect(() => {
    const accounts = getIdentifiersOfType(
      "account",
      recipientsState.selectedKeys
    );
    const channels = getIdentifiersOfType(
      "channel",
      recipientsState.selectedKeys
    );

    setSearchParams(
      [
        ["account", accounts.length === 0 ? undefined : accounts.join(",")],
        ["channel", channels[0]],
      ].filter((e) => e[1]),
      { replace: true }
    );
  }, [recipientsState.selectedKeys, setSearchParams]);

  return recipientsState;
};

const useTagFieldComboboxState = (initialState) => {
  const [state, setState] = React.useState(
    initialState ?? { selectedKeys: [], focusIndex: -1 }
  );
  const { selectedKeys, focusedIndex } = state;

  const setSelection = React.useCallback((keys) => {
    setState((s) => ({
      ...s,
      selectedKeys: typeof keys === "function" ? keys(s.selectedKeys) : keys,
    }));
  }, []);

  const clearFocus = React.useCallback(
    () => setState((s) => ({ ...s, focusedIndex: -1 })),
    []
  );

  const moveFocusLeft = React.useCallback(
    () =>
      setState(({ selectedKeys, focusedIndex }) => ({
        selectedKeys,
        focusedIndex:
          focusedIndex === -1
            ? selectedKeys.length - 1
            : Math.max(0, focusedIndex - 1),
      })),
    []
  );

  const moveFocusRight = React.useCallback(
    () =>
      setState(({ selectedKeys, focusedIndex }) => ({
        selectedKeys,
        focusedIndex:
          focusedIndex === -1 || focusedIndex === selectedKeys.length - 1
            ? -1
            : focusedIndex + 1,
      })),
    []
  );

  const focusIndex = React.useCallback(
    (i) => setState((s) => ({ ...s, focusedIndex: i })),
    []
  );

  const focusLast = React.useCallback(
    () =>
      setState(({ selectedKeys }) => ({
        selectedKeys,
        focusedIndex: selectedKeys.length - 1,
      })),
    []
  );

  const deselectFocusedKeyAndMoveFocusLeft = React.useCallback(
    () =>
      setState(({ selectedKeys, focusedIndex }) => ({
        selectedKeys: selectedKeys.filter((_, i) => i !== focusedIndex),
        focusedIndex: focusedIndex === 0 ? -1 : focusedIndex - 1,
      })),
    []
  );

  return {
    selectedKeys,
    setSelection,
    focusedIndex,
    focusIndex,
    focusLast,
    clearFocus,
    moveFocusLeft,
    moveFocusRight,
    deselectFocusedKeyAndMoveFocusLeft,
  };
};

const useTagFieldCombobox = ({ inputRef }, state) => {
  const { keyboardProps } = useKeyboard({
    onKeyDown: (e) => {
      const hasSelection = e.target.selectionStart != null;

      if (hasSelection) {
        const { selectionStart, selectionEnd } = e.target;
        const selectionIsCollapsed = selectionStart === selectionEnd;
        if (
          !selectionIsCollapsed ||
          selectionStart !== 0 ||
          state.selectedKeys.length === 0
        ) {
          e.continuePropagation();
          return;
        }
      }

      if (e.key === "ArrowLeft") {
        inputRef.current.focus();
        state.moveFocusLeft();
      } else if (e.key === "ArrowRight") {
        inputRef.current.focus();
        state.moveFocusRight();
      } else if (e.key === "Backspace") {
        inputRef.current.focus();
        if (state.focusedIndex === -1) {
          state.focusLast();
        } else {
          state.deselectFocusedKeyAndMoveFocusLeft();
        }
      } else {
        e.continuePropagation();
      }
    },
  });

  return {
    inputProps: keyboardProps,
    tagButtonProps: { ...keyboardProps, tabIndex: -1 },
  };
};

const createDefaultChannelName = async (accounts) => {
  const displayNames = await Promise.all(
    accounts.slice(0, 3).map(
      (a) =>
        a.displayName ??
        fetch(`https://api.ensideas.com/ens/resolve/${a.walletAddress}`)
          .then((r) => r.json())
          .then((data) => data.displayName)
          .catch(() => truncateAddress(a.walletAddressA))
    )
  );

  const joineddisplayNames = displayNames.join(", ");

  return accounts.length > 3
    ? `${joineddisplayNames}, ...`
    : joineddisplayNames;
};

const NewMessageScreen = () => {
  const navigate = useNavigate();

  const { status: authenticationStatus } = useAuth();
  const actions = useActions();
  const me = useMe();
  const { address: connectedWalletAccountAddress } = useAccount();
  const { connect: connectWallet, isConnecting: isConnectingWallet } =
    useWallet();
  const { login: initAccountVerification, status: accountVerificationStatus } =
    useWalletLogin();
  const meWalletAddress =
    authenticationStatus === "not-authenticated"
      ? connectedWalletAccountAddress
      : me?.walletAddress;

  const recipientInputRef = React.useRef();
  const messageInputRef = React.useRef();

  const { isFloating: isSidebarFloating } = useSidebarState();

  const [isRecipientsCommitted, setRecipientsCommitted] = React.useState(false);

  const recipientsState = useRecipientsTagFieldComboboxState();

  const { selectedChannelId, selectedWalletAddresses } = React.useMemo(() => {
    const selectedChannelId = recipientsState.selectedKeys
      .filter((k) => getKeyItemType(k) === "channel")
      .map(getKeyItemIdentifier)[0];
    const selectedWalletAddresses = recipientsState.selectedKeys
      .filter((k) => getKeyItemType(k) === "account")
      .map(getKeyItemIdentifier);
    return { selectedChannelId, selectedWalletAddresses };
  }, [recipientsState.selectedKeys]);

  const dmChannel = useDmChannelWithMember(
    selectedWalletAddresses.length === 1 ? selectedWalletAddresses[0] : null
  );

  const channelId = dmChannel?.id ?? selectedChannelId;

  const matchType =
    channelId != null
      ? "channel"
      : selectedWalletAddresses.length === 0
      ? null
      : selectedWalletAddresses.length === 1
      ? "dm"
      : "group";

  const channelMembers = useChannelMembers(channelId);
  const { canPostMessages: canPostChannelMessages } =
    useChannelPermissions(channelId);

  const selectedUsers = useUsers(selectedWalletAddresses);
  const selectedAccounts = selectedWalletAddresses.map(
    (a) =>
      selectedUsers.find(
        (u) => u.walletAddress.toLowerCase() === a.toLowerCase()
      ) ?? { walletAddress: a }
  );

  const [hasPendingMessageSubmit, setHasPendingMessageSubmit] =
    React.useState(false);
  const [replyTargetMessageId, setReplyTargetMessageId] = React.useState(null);

  const {
    open: openAccountAuthenticationDialog,
    dismiss: dismissAccountAuthenticationDialog,
  } = useDialog("account-authentication");
  const {
    isOpen: isCreateChannelDialogOpen,
    open: openCreateChannelDialog,
    dismiss: dismissCreateChannelDialog,
  } = useDialog("create-channel");

  const initReply = React.useCallback((messageId) => {
    setReplyTargetMessageId(messageId);
    messageInputRef.current.focus();
  }, []);

  const cancelReply = React.useCallback(() => {
    setReplyTargetMessageId(null);
    messageInputRef.current.focus();
  }, []);

  const enableRecipientsInput = true;

  const enableMessageInput =
    !hasPendingMessageSubmit &&
    (matchType === "channel" ? canPostChannelMessages : true);

  React.useEffect(() => {
    if (selectedChannelId != null) {
      if (!enableMessageInput) return;
      messageInputRef.current.focus();
      return;
    } else if (
      authenticationStatus === "authenticated" ||
      meWalletAddress != null
    ) {
      recipientInputRef.current?.focus();
    }
  }, [
    authenticationStatus,
    meWalletAddress,
    selectedChannelId,
    enableMessageInput,
  ]);

  return (
    <>
      <div
        css={(t) =>
          css({
            position: "relative",
            zIndex: 0,
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            height: "100%",
            background: t.colors.backgroundPrimary,
          })
        }
      >
        <NavBar>
          <div
            css={(t) =>
              css({
                fontSize: t.text.sizes.header,
                fontWeight: t.text.weights.header,
                color: t.colors.textHeader,
                marginRight: "1rem",
              })
            }
            style={{ paddingLeft: isSidebarFloating ? 0 : "1.6rem" }}
          >
            New Message
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <Button
              size="small"
              icon={<PlusSmallIcon style={{ width: "1.3rem" }} />}
              align="left"
              onClick={() => {
                openCreateChannelDialog();
              }}
            >
              New channel
            </Button>
          </div>
        </NavBar>
        <div css={css({ padding: "0 1.6rem" })}>
          {!isRecipientsCommitted ? (
            <MessageRecipientCombobox
              ref={recipientInputRef}
              label="To:"
              ariaLabel="Message recipient search"
              placeholder="An ENS name, Ethereum address, or channel name"
              state={recipientsState}
              disabled={!enableRecipientsInput}
              onSelect={(key) => {
                if (getKeyItemType(key) === "channel") {
                  setRecipientsCommitted(true);
                  messageInputRef.current.focus();
                }
              }}
              onBlur={() => {
                if (channelId != null || selectedWalletAddresses.length !== 0) {
                  setRecipientsCommitted(true);
                  messageInputRef.current.focus();
                }
              }}
            />
          ) : channelId != null ? (
            <MessageRecipientChannelHeader
              channelId={channelId}
              component="button"
              onClick={() => {
                setRecipientsCommitted(false);
              }}
            />
          ) : (
            <MessageRecipientAccountsHeader
              walletAddresses={selectedWalletAddresses}
              component="button"
              onClick={() => {
                setRecipientsCommitted(false);
              }}
            />
          )}
        </div>

        {matchType === "channel" ? (
          <ChannelMessages
            channelId={channelId}
            initReply={initReply}
            replyTargetMessageId={replyTargetMessageId}
          />
        ) : (
          <div
            css={css({
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              justifyContent: "flex-end",
              paddingBottom: "2rem",
            })}
          >
            {selectedWalletAddresses.length !== 0 ? (
              <ChannelIntro walletAddresses={selectedWalletAddresses} />
            ) : (
              <>
                {authenticationStatus === "not-authenticated" &&
                connectedWalletAccountAddress == null ? (
                  <LazyLoginScreen />
                ) : (
                  <Onboarding
                    selectChannel={(channelId) => {
                      recipientsState.setSelection([`channel-${channelId}`]);
                      setRecipientsCommitted(true);
                    }}
                  />
                )}
              </>
            )}
          </div>
        )}

        <div style={{ padding: "0 1.6rem 2rem" }}>
          <NewChannelMessageInput
            ref={messageInputRef}
            uploadImage={actions.uploadImage}
            submit={async (message) => {
              if (channelId != null) {
                actions.createMessage({
                  channel: channelId,
                  blocks: message,
                });
                navigate(`/channels/${channelId}`);
                return;
              }

              setHasPendingMessageSubmit(true);

              try {
                const channelName = await createDefaultChannelName([
                  me,
                  ...selectedAccounts,
                ]);

                const channel = await actions.createPrivateChannel({
                  name: channelName,
                  memberWalletAddresses: selectedWalletAddresses,
                });
                actions.createMessage({
                  channel: channel.id,
                  blocks: message,
                });
                navigate(`/channels/${channel.id}`);
              } catch (e) {
                alert("Oh no, something went wrong!");
              } finally {
                setHasPendingMessageSubmit(false);
              }
            }}
            placeholder="Type your message..."
            // @mentions require user ids for now, so we can’t pass `selectedAccounts`
            members={matchType === "channel" ? channelMembers : selectedUsers}
            disabled={!enableMessageInput}
            submitDisabled={
              matchType == null || authenticationStatus !== "authenticated"
            }
            fileUploadDisabled={authenticationStatus !== "authenticated"}
            channelId={channelId}
            replyTargetMessageId={replyTargetMessageId}
            cancelReply={cancelReply}
            submitArea={
              authenticationStatus === "not-authenticated" &&
              matchType != null ? (
                <div
                  style={{
                    alignSelf: "flex-end",
                    display: "flex",
                    height: 0,
                  }}
                >
                  <div
                    style={{
                      alignSelf: "flex-end",
                      display: "grid",
                      gridAutoFlow: "column",
                      gridAutoColumns: "auto",
                      gridGap: "1.6rem",
                      alignItems: "center",
                    }}
                  >
                    <div
                      css={(t) =>
                        css({
                          fontSize: t.text.sizes.small,
                          color: t.colors.textDimmed,
                          "@media(max-width: 600px)": {
                            display: "none",
                          },
                        })
                      }
                    >
                      Account verification required
                    </div>
                    {connectedWalletAccountAddress == null ? (
                      <Button
                        size="small"
                        variant="primary"
                        isLoading={isConnectingWallet}
                        disabled={isConnectingWallet}
                        onClick={() => {
                          connectWallet();
                          openAccountAuthenticationDialog();
                        }}
                      >
                        Connect wallet
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="primary"
                        isLoading={accountVerificationStatus !== "idle"}
                        disabled={accountVerificationStatus !== "idle"}
                        onClick={() => {
                          initAccountVerification(
                            connectedWalletAccountAddress
                          ).then(() => {
                            dismissAccountAuthenticationDialog();
                            messageInputRef.current.focus();
                          });
                          openAccountAuthenticationDialog();
                        }}
                      >
                        Verify account
                      </Button>
                    )}
                  </div>
                </div>
              ) : null
            }
          />
        </div>
      </div>

      <Dialog
        width="46rem"
        isOpen={isCreateChannelDialogOpen}
        onRequestClose={dismissCreateChannelDialog}
      >
        {({ titleProps }) => (
          <ErrorBoundary fallback={() => window.location.reload()}>
            <React.Suspense fallback={null}>
              <LazyCreateChannelDialog
                isOpen={isCreateChannelDialogOpen}
                dismiss={dismissCreateChannelDialog}
                titleProps={titleProps}
              />
            </React.Suspense>
          </ErrorBoundary>
        )}
      </Dialog>
    </>
  );
};

const ChannelMessages = ({ channelId, initReply, replyTargetMessageId }) => {
  const scrollContainerRef = React.useRef();
  const didScrollToBottomRef = React.useRef(false);
  const messageIds = useSortedChannelMessageIds(channelId, { threads: true });

  const { fetcher: fetchMessages, pendingMessagesBeforeCount } =
    useScrollAwareChannelMessagesFetcher(channelId, { scrollContainerRef });

  const fetchMoreMessages = useLatestCallback((args) =>
    fetchMessages(args ?? { beforeMessageId: messageIds[0], limit: 30 })
  );

  React.useEffect(() => {
    fetchMessages({ limit: 30 });
  }, [fetchMessages]);

  useChannelFetchEffects(channelId);

  return (
    <ChannelMessagesScrollView
      channelId={channelId}
      scrollContainerRef={scrollContainerRef}
      didScrollToBottomRef={didScrollToBottomRef}
      fetchMoreMessages={fetchMoreMessages}
      initReply={initReply}
      replyTargetMessageId={replyTargetMessageId}
      pendingMessagesBeforeCount={pendingMessagesBeforeCount}
    />
  );
};

const MessageRecipientsInputContainer = React.forwardRef(
  ({ component: Component = "div", label, children, ...props }, ref) => (
    <Component
      ref={ref}
      css={(t) =>
        css({
          position: "relative",
          zIndex: 1,
          display: "flex",
          width: "100%",
          color: t.colors.inputPlaceholder,
          background: t.colors.inputBackground,
          fontSize: t.text.sizes.large,
          borderRadius: "0.6rem",
          padding: "1.05rem 1.6rem",
          outline: "none",
          boxShadow: t.shadows.elevationLow,
          ":focus-visible": {
            filter: "brightness(1.05)",
            boxShadow: `0 0 0 0.2rem ${t.colors.primary}`,
          },
          ":has(input:disabled)": {
            color: t.colors.textMuted,
            cursor: "not-allowed",
          },
          "@media (hover: hover)": {
            ":not(:has(input))": {
              cursor: "pointer",
              ":hover": {
                filter: "brightness(1.05)",
              },
            },
          },
        })
      }
      {...props}
    >
      {label && <div style={{ marginRight: "0.8rem" }}>{label}</div>}
      {children}
    </Component>
  )
);

const MessageRecipientChannelHeader = ({ channelId, ...props }) => {
  const channelName = useChannelName(channelId);

  return (
    <MessageRecipientsInputContainer label="To:" {...props}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <ChannelAvatar
          id={channelId}
          size="2.4rem"
          style={{ marginRight: "0.5rem" }}
        />
        <div css={(t) => css({ color: t.colors.textNormal })}>
          {channelName}
        </div>
      </div>
    </MessageRecipientsInputContainer>
  );
};

const AccountDisplayName = ({ walletAddress }) =>
  useAccountDisplayName(walletAddress).displayName;

const MessageRecipientAccountsHeader = ({ walletAddresses, ...props }) => {
  const users = useUsers(walletAddresses);
  const accounts = walletAddresses.map(
    (a) => users.find((u) => u.walletAddress === a) ?? { walletAddress: a }
  );

  return (
    <MessageRecipientsInputContainer
      label="To:"
      css={(t) =>
        css({
          display: "flex",
          alignItems: "center",
          color: t.colors.textNormal,
        })
      }
      {...props}
    >
      {accounts.map((a, i, as) => (
        <React.Fragment key={a.walletAddress}>
          <AccountDisplayName walletAddress={a.walletAddress} />
          {i !== as.length - 1 ? <>, </> : null}
        </React.Fragment>
      ))}
    </MessageRecipientsInputContainer>
  );
};

const MessageRecipientCombobox = React.forwardRef(
  (
    { label, ariaLabel, placeholder, state, disabled, onSelect, onBlur },
    inputRef
  ) => {
    const containerRef = React.useRef();

    const [query, setQuery] = React.useState("");

    const filteredComboboxItems = useFilteredComboboxItems(query, state);
    const { inputProps: tagFieldInputProps, tagButtonProps } =
      useTagFieldCombobox({ inputRef }, state);

    const { keyboardProps: inputKeyboardProps } = useKeyboard({
      onKeyDown: (e) => {
        if (e.key === "Escape" || e.key === "Tab") {
          state.clearFocus();
          setQuery("");
        } else {
          e.continuePropagation();
        }
      },
    });

    const { selectedKeys } = state;

    return (
      <MessageRecipientsInputContainer ref={containerRef} label={label}>
        <FlexGrid gridGap="0.5rem" css={css({ flex: 1, minWidth: 0 })}>
          {state.selectedKeys.map((key, i) => {
            const type = getKeyItemType(key);
            const identifier = getKeyItemIdentifier(key);

            const props = {
              isFocused: i === state.focusedIndex,
              focus: () => {
                inputRef.current.focus();
                state.focusIndex(i);
              },
              deselect: () => {
                inputRef.current.focus();
                state.setSelection((keys) => keys.filter((k) => k !== key));
              },
              ...tagButtonProps,
            };

            switch (type) {
              case "account":
                return (
                  <FlexGridItem key={key}>
                    <SelectedAccountTag {...props} walletAddress={identifier} />
                  </FlexGridItem>
                );
              case "channel":
                return (
                  <FlexGridItem key={key}>
                    <SelectedChannelTag {...props} channelId={identifier} />
                  </FlexGridItem>
                );
              default:
                throw new Error();
            }
          })}

          <FlexGridItem css={css({ flex: 1, minWidth: "12rem" })}>
            <Combobox
              aria-label={ariaLabel}
              placeholder={
                state.selectedKeys.length === 0 ? placeholder : undefined
              }
              allowsCustomValue={false}
              allowsEmptyCollection={true}
              isOpen={filteredComboboxItems.length === 0 ? false : undefined}
              menuTrigger="focus"
              selectedKey={null}
              onSelect={(key) => {
                if (key == null) return;

                setQuery("");

                switch (getKeyItemType(key)) {
                  case "account":
                    state.setSelection((keys) => {
                      const nonChannelKeys = keys.filter(
                        (k) => getKeyItemType(k) !== "channel"
                      );
                      return [...nonChannelKeys, key];
                    });
                    break;

                  // There should only ever be one selected channel at the time
                  case "channel":
                    state.setSelection([key]);
                    break;

                  default:
                    throw new Error();
                }

                onSelect(key);
              }}
              inputValue={query}
              onInputChange={setQuery}
              disabledKeys={state.selectedKeys}
              disabled={disabled}
              targetRef={containerRef}
              inputRef={inputRef}
              items={filteredComboboxItems}
              popoverMaxHeight={365}
              renderInput={({ inputRef, inputProps }) => (
                <input
                  ref={inputRef}
                  css={(t) =>
                    css({
                      color: t.colors.textNormal,
                      background: "none",
                      border: 0,
                      padding: 0,
                      width: "100%",
                      outline: "none",
                      "::placeholder": {
                        color: t.colors.inputPlaceholder,
                      },
                      ":disabled": {
                        cursor: "not-allowed",
                        "::placeholder": {
                          color: t.colors.textMuted,
                        },
                      },
                    })
                  }
                  {...mergeProps(
                    {
                      onChange: () => {
                        state.clearFocus();
                      },
                      onClick: () => {
                        state.clearFocus();
                      },
                      onBlur: (e) => {
                        if (
                          e.relatedTarget != null &&
                          containerRef.current.contains(e.relatedTarget)
                        )
                          return;

                        setQuery("");
                        state.clearFocus();
                        onBlur(e);
                      },
                    },
                    inputKeyboardProps,
                    inputProps,
                    tagFieldInputProps
                  )}
                />
              )}
              renderListbox={({ state, listBoxRef, listBoxProps }) => (
                <MessageRecipientListBox
                  ref={listBoxRef}
                  listBoxProps={listBoxProps}
                  state={state}
                  selectedKeys={selectedKeys}
                />
              )}
            >
              {(item) => (
                <ComboboxSection items={item.children} title={item.title}>
                  {(item) => <ComboboxItem textValue={item.textValue} />}
                </ComboboxSection>
              )}
            </Combobox>
          </FlexGridItem>
        </FlexGrid>
      </MessageRecipientsInputContainer>
    );
  }
);

const Tag = ({ label, isFocused, focus, deselect, ...props }) => (
  <button
    data-focused={isFocused ? "true" : undefined}
    css={(t) =>
      css({
        display: "flex",
        alignItems: "center",
        border: 0,
        lineHeight: "inherit",
        borderRadius: "0.3rem",
        padding: "0 0.2rem",
        fontWeight: "500",
        outline: "none",
        cursor: "pointer",
        color: t.colors.mentionText,
        background: t.colors.mentionBackground,
        "&[data-focused]": {
          position: "relative",
          zIndex: 1,
          boxShadow: `0 0 0 0.2rem ${t.colors.mentionFocusBorder}`,
          textDecoration: "none",
          "[data-deselect-button]": { color: t.colors.textAccent },
        },
        "@media (hover: hover)": {
          "&:hover": {
            color: t.colors.mentionTextModifierHover,
            background: t.colors.mentionBackgroundModifierHover,
            textDecoration: "none",
          },
        },
      })
    }
    onFocus={() => {
      focus();
    }}
    {...props}
  >
    {label}
    <IconButton
      data-deselect-button
      component="div"
      role="button"
      size="1.8rem"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        deselect();
      }}
      style={{ marginLeft: "0.2rem" }}
      css={(t) =>
        css({
          color: "inherit",
          "@media (hover: hover)": {
            ":hover": {
              color: t.colors.textAccent,
              backdropFilter: "brightness(1.5) saturate(1.25)",
            },
          },
        })
      }
    >
      <CrossSmallIcon style={{ width: "0.9rem", height: "auto" }} />
    </IconButton>
  </button>
);

const SelectedAccountTag = ({ walletAddress, ...props }) => {
  const { displayName } = useAccountDisplayName(walletAddress);
  return <Tag label={displayName} {...props} />;
};

const SelectedChannelTag = ({ channelId, ...props }) => {
  const name = useChannelName(channelId);
  return <Tag label={name} {...props} />;
};

const MessageRecipientListBox = React.forwardRef(
  ({ state, listBoxProps: listBoxPropsInput, selectedKeys }, ref) => {
    const { listBoxProps } = useListBox(listBoxPropsInput, state, ref);
    const theme = useTheme();

    return (
      <ul
        ref={ref}
        css={css({
          display: "block",
          listStyle: "none",
          "li:not(:last-of-type)": { marginBottom: "0.2rem" },
        })}
        {...listBoxProps}
        style={{
          padding:
            state.collection.size === 0 ? 0 : theme.dropdownMenus.padding,
        }}
      >
        {[...state.collection].map((item) => {
          if (item.type === "section")
            return (
              <MessageRecipientComboboxSection
                key={item.key}
                state={state}
                item={item}
                selectedKeys={selectedKeys}
              />
            );

          return (
            <MessageRecipientComboboxOption
              key={item.key}
              state={state}
              item={item}
              isSelected={selectedKeys.includes(item.key)}
            />
          );
        })}
      </ul>
    );
  }
);

const MessageRecipientComboboxOption = ({ item, state, isSelected }) => {
  const props = {
    itemKey: item.key,
    state,
    isSelected,
  };

  const type = getKeyItemType(item.key);

  switch (type) {
    case "account":
      return (
        <MessageRecipientComboboxAccountOption
          identifier={item.key}
          {...props}
        />
      );
    case "channel":
      return (
        <MessageRecipientComboboxChannelOption
          identifier={item.key}
          {...props}
        />
      );
    default:
      throw new Error();
  }
};

const MessageRecipientOption = ({
  itemKey,
  state,
  isSelected,
  label,
  description,
  icon,
}) => {
  const ref = React.useRef();

  const { optionProps, labelProps, descriptionProps, isFocused, isDisabled } =
    useOption({ key: itemKey }, state, ref);

  const theme = useTheme();

  return (
    <li
      {...optionProps}
      ref={ref}
      css={(t) =>
        css({
          minHeight: t.dropdownMenus.itemHeight,
          padding: "0.8rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          lineHeight: 1.4,
          fontWeight: "400",
          color: t.colors.textNormal,
          borderRadius: "0.3rem",
          outline: "none",
        })
      }
      style={{
        cursor: isDisabled ? "default" : "pointer",
        background: isSelected
          ? theme.colors.primaryTransparentSoft
          : isFocused
          ? theme.colors.backgroundModifierHover
          : undefined,
      }}
    >
      <div
        css={css({
          marginRight: "1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        })}
      >
        {icon}
      </div>
      <div
        css={css({
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
        })}
      >
        <div
          {...labelProps}
          css={(t) => css({ fontSize: t.text.sizes.large })}
          style={{ color: isFocused ? theme.colors.textAccent : undefined }}
        >
          {label}
        </div>
        {description != null && (
          <div
            {...descriptionProps}
            css={(t) =>
              css({
                color: t.colors.textDimmed,
                fontSize: t.text.sizes.base,
                flex: 1,
                minWidth: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                marginLeft: "0.8rem",
              })
            }
          >
            {description}
          </div>
        )}
        {isSelected && (
          <div css={css({ padding: "0 0.5rem" })}>
            <CheckmarkIcon style={{ width: "1.2rem" }} />
          </div>
        )}
      </div>
    </li>
  );
};
const MessageRecipientComboboxSection = ({
  item: section,
  state,
  selectedKeys,
}) => {
  const { itemProps, headingProps, groupProps } = useListBoxSection({
    heading: section.rendered,
  });

  // const isAtTop = section.key === state.collection.getFirstKey();

  return (
    <li {...itemProps}>
      {section.rendered != null && (
        <div
          {...headingProps}
          css={(t) =>
            css({
              fontSize: t.text.sizes.small,
              fontWeight: "600",
              color: t.colors.textMutedAlpha,
              padding: "0.5rem 0.8rem",
            })
          }
        >
          {section.rendered}
        </div>
      )}
      <ul {...groupProps}>
        {[...section.childNodes].map((node) => (
          <MessageRecipientComboboxOption
            key={node.key}
            item={node}
            state={state}
            isSelected={selectedKeys.includes(node.key)}
          />
        ))}
      </ul>
    </li>
  );
};

const MessageRecipientComboboxAccountOption = ({
  itemKey,
  state,
  isSelected,
}) => {
  const walletAddress = getKeyItemIdentifier(itemKey);
  const user = useUserWithWalletAddress(walletAddress) ?? { walletAddress };

  const address = truncateAddress(user.walletAddress);
  const { displayName } = useAccountDisplayName(walletAddress);
  const description = displayName != address ? address : null;

  return (
    <MessageRecipientOption
      itemKey={itemKey}
      state={state}
      isSelected={isSelected}
      label={displayName}
      description={description}
      icon={<UserAvatar size="2.4rem" walletAddress={user.walletAddress} />}
    />
  );
};

const MessageRecipientComboboxChannelOption = ({
  itemKey,
  state,
  isSelected,
}) => {
  const channelId = getKeyItemIdentifier(itemKey);
  const channel = useChannel(channelId, { name: true });

  return (
    <MessageRecipientOption
      itemKey={itemKey}
      state={state}
      isSelected={isSelected}
      label={channel.name}
      description={channel.description}
      icon={<ChannelAvatar size="2.4rem" id={channel.id} />}
    />
  );
};

const ChannelIntro = ({ walletAddresses: walletAddresses_ }) => {
  const me = useMe();
  const { address: connectedWalletAccountAddress } = useAccount();

  const walletAddresses = walletAddresses_.filter((a) => {
    const meWalletAddress =
      me == null ? connectedWalletAccountAddress : me.walletAddress;
    return (
      meWalletAddress == null ||
      meWalletAddress.toLowerCase() !== a.toLowerCase()
    );
  });

  if (walletAddresses.length === 0) return <PersonalDMChannelPrologue />;

  if (walletAddresses.length === 1)
    return <DMChannelIntro walletAddress={walletAddresses[0]} />;

  return (
    <ChannelPrologue
      title={[me?.walletAddress, ...walletAddresses]
        .filter(Boolean)
        .slice(0, 3)
        .map((a, i, as) => (
          <React.Fragment key={a}>
            <InlineUserButtonWithProfilePopover
              walletAddress={a}
              css={(t) =>
                css({
                  color: t.colors.textHeader,
                })
              }
            />
            {i !== as.length - 1 && ", "}
            {i === as.length - 1 &&
              walletAddresses.length >= as.length &&
              ", ..."}
          </React.Fragment>
        ))}
      subtitle={<>{walletAddresses.length + 1} participants</>}
      image={
        <UserAvatarStack
          count={3}
          accounts={walletAddresses.map((a) => ({ walletAddress: a }))}
          highRes
          transparent
          size="6.6rem"
        />
      }
      body={
        <>
          This conversation is between{" "}
          {walletAddresses.map((a, i, as) => (
            <React.Fragment key={a}>
              <InlineUserButtonWithProfilePopover
                walletAddress={a}
                css={(t) => css({ color: t.colors.textNormal })}
              />
              {i !== as.length - 1 ? ", " : null}
            </React.Fragment>
          ))}{" "}
          and you.
        </>
      }
    />
  );
};

const DMChannelIntro = ({ walletAddress }) => {
  const { displayName } = useAccountDisplayName(walletAddress);

  const truncatedAddress = truncateAddress(walletAddress);
  const hasCustomDisplayName =
    displayName.toLowerCase() !== truncatedAddress.toLowerCase();

  return (
    <ChannelPrologue
      image={
        <UserAvatar walletAddress={walletAddress} size="6.6rem" transparent />
      }
      title={
        <InlineUserButtonWithProfilePopover
          walletAddress={walletAddress}
          css={(t) => css({ color: t.colors.textHeader })}
        />
      }
      subtitle={hasCustomDisplayName ? truncatedAddress : null}
      body={
        <>
          This conversation is just between{" "}
          <InlineUserButtonWithProfilePopover
            walletAddress={walletAddress}
            css={(t) => css({ color: t.colors.textNormal })}
          />{" "}
          and you.
        </>
      }
    />
  );
};

const Onboarding = ({ selectChannel }) => {
  const me = useMe();
  const { address: connectedWalletAccountAddress } = useAccount();
  // const connectedWallet = useWallet();

  // const memberChannels = useMemberChannels();
  const { open: openEditProfileDialog } = useDialog("edit-profile");
  const { open: openProfileLinkDialog } = useDialog("profile-link");

  // if (me == null) return null;
  // // `1` since users currently auto-join NS General
  // if (memberChannels.length > 1) return null;

  const staggeredChildMotionVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  return (
    <div
      css={(t) =>
        css({
          margin: "auto auto 0",
          width: "52rem",
          maxWidth: "100%",
          padding: "4rem 1.6rem 0",
          userSelect: "default",
          color: t.colors.textNormal,
          fontSize: t.text.sizes.large,
          "p.big": { fontSize: "2.8rem", margin: "0 0 2.2rem" },
          ul: { marginTop: "2rem" },
          li: { listStyle: "none" },
          "p + p, li + li, ul": { marginTop: "1.4rem" },
          ".onboarding-actions-list li > *": {
            display: "block",
            width: "100%",
            textDecoration: "none",
            padding: "1.6rem",
            borderRadius: "0.5rem",
            color: "inherit",
            background: t.colors.backgroundModifierHover,
            outline: "none",
            ":focus-visible": { boxShadow: t.shadows.focus },
            "@media(hover: hover)": {
              cursor: "pointer",
              ":hover": {
                color: t.colors.textAccent,
                background: t.colors.backgroundModifierHoverStrong,
              },
            },
          },
          "@media(min-width: 600px)": {
            margin: "auto",
            fontSize: "1.8rem",
            ".onboarding-actions-list li > *": {
              padding: "2rem",
            },
          },
        })
      }
    >
      <motion.p
        className="big"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { delay: 0.6 } },
        }}
      >
        Hi{" "}
        <InlineUserButtonWithProfilePopover
          variant="button"
          walletAddress={me?.walletAddress ?? connectedWalletAccountAddress}
        />
        !
      </motion.p>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              delay: 0.5,
              when: "beforeChildren",
              staggerChildren: 0.1,
              ease: "easeOut",
            },
          },
        }}
      >
        <motion.p variants={staggeredChildMotionVariants}>
          Here are some easy ways to get started:
        </motion.p>

        <ul className="onboarding-actions-list">
          <motion.li variants={staggeredChildMotionVariants}>
            <button
              onClick={() => {
                selectChannel(INTRO_CHANNEL_ID);
              }}
            >
              Say hi <Emoji emoji="👋" /> in{" "}
              <InlineChannelButton
                channelId={INTRO_CHANNEL_ID}
                component="div"
              />
            </button>
          </motion.li>
          <motion.li variants={staggeredChildMotionVariants}>
            <button onClick={openProfileLinkDialog}>
              Share your account with some friends <Emoji emoji="💁" />
            </button>
          </motion.li>
          <motion.li variants={staggeredChildMotionVariants}>
            <button onClick={openEditProfileDialog}>
              Set a display name <Emoji emoji="🏷️" />, and profile picture{" "}
              <Emoji emoji="🖼️" />
            </button>
          </motion.li>
        </ul>
      </motion.div>
    </div>
  );
};

export default NewMessageScreen;
