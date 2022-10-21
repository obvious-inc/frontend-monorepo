import throttle from "lodash.throttle";
import React from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { css, useTheme } from "@emotion/react";
import { useAuth, useAppScope } from "@shades/common/app";
import {
  getImageFileDimensions,
  array as arrayUtils,
  message as messageUtils,
  ethereum as ethereumUtils,
} from "@shades/common/utils";
import { useLatestCallback } from "@shades/common/react";
import useGlobalMediaQueries from "../hooks/global-media-queries";
import useWindowFocusListener from "../hooks/window-focus-listener";
import useOnlineListener from "../hooks/window-online-listener";
import useInterval from "../hooks/interval";
import useWallet from "../hooks/wallet";
import useWalletLogin from "../hooks/wallet-login";
import { createEmptyParagraph, isNodeEmpty, cleanNodes } from "../slate/utils";
import useCommands from "../hooks/commands";
import MessageInput from "./message-input";
import Spinner from "./spinner";
import ChannelMessage from "./channel-message";
import Avatar from "./avatar";
import Button from "./button";
import * as Tooltip from "./tooltip";
import Dialog from "./dialog";
import { Hash as HashIcon, AtSign as AtSignIcon } from "./icons";
import {
  HamburgerMenu as HamburgerMenuIcon,
  PlusCircle as PlusCircleIcon,
  CrossCircle as CrossCircleIcon,
  Star as StarIcon,
  StrokedStar as StrokedStarIcon,
} from "./icons";
import useSideMenu from "../hooks/side-menu";
import useIsOnScreen from "../hooks/is-on-screen";
import useScrollListener from "../hooks/scroll-listener";
import useMutationObserver from "../hooks/mutation-observer";

const { stringifyBlocks: stringifyMessageBlocks } = messageUtils;

const { sort } = arrayUtils;
const { truncateAddress } = ethereumUtils;

const isNative = window.Native != null;

const useFetch = (fetcher, dependencies) => {
  const fetcherRef = React.useRef(fetcher);

  React.useEffect(() => {
    fetcherRef.current = fetcher;
  });

  React.useEffect(() => {
    fetcherRef.current?.();
  }, dependencies); // eslint-disable-line

  useWindowFocusListener(() => {
    fetcherRef.current?.();
  });

  useOnlineListener(() => {
    fetcherRef.current?.();
  });
};

const pendingFetchMessagePromisesCache = {};

// This fetcher only allows for a single request (with the same query) to be
// pending at once. Subsequent "equal" request will simply return the initial
// pending request promise.
const useMessageFetcher = () => {
  const { actions } = useAppScope();

  const fetchMessages = useLatestCallback(
    async (channelId, { limit, beforeMessageId, afterMessageId } = {}) => {
      const key = new URLSearchParams([
        ["channel", channelId],
        ["limit", limit],
        ["before-message-id", beforeMessageId],
        ["after-message-id", afterMessageId],
      ]).toString();

      let pendingPromise = pendingFetchMessagePromisesCache[key];

      if (pendingPromise == null) {
        pendingPromise = actions.fetchMessages(channelId, {
          limit,
          beforeMessageId,
          afterMessageId,
        });
        pendingFetchMessagePromisesCache[key] = pendingPromise;
      }

      try {
        return await pendingPromise;
      } finally {
        delete pendingFetchMessagePromisesCache[key];
      }
    }
  );

  return fetchMessages;
};

const useMessages = (channelId) => {
  const { state } = useAppScope();
  const unsortedMessages = state.selectChannelMessages(channelId);
  const hasAllMessages = state.selectHasAllMessages(channelId);

  const messages = React.useMemo(
    () =>
      unsortedMessages.sort(
        (m1, m2) => new Date(m1.created_at) - new Date(m2.created_at)
      ),
    [unsortedMessages]
  );

  return { messages, hasAllMessages };
};

const useScroll = (scrollContainerRef, { cacheKey, onScrollToBottom }) => {
  const didScrollToBottomRef = React.useRef(false);

  const scrollToBottom = React.useCallback(
    (options) => {
      const isScrollable =
        scrollContainerRef.current.scrollHeight >
        scrollContainerRef.current.getBoundingClientRect().height;

      if (!isScrollable) {
        didScrollToBottomRef.current = true;
        return;
      }

      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        ...options,
      });
    },
    [scrollContainerRef]
  );

  // Restore cached scroll position
  React.useEffect(() => {
    const { scrollTop: cachedScrollTop } = scrollPositionCache[cacheKey] ?? {};

    if (cachedScrollTop == null) {
      scrollToBottom();
      return;
    }

    const el = scrollContainerRef.current;

    el.scrollTop = cachedScrollTop;

    const isAtBottom =
      Math.ceil(cachedScrollTop) + el.getBoundingClientRect().height >=
      el.scrollHeight;

    didScrollToBottomRef.current = isAtBottom;
  }, [scrollContainerRef, cacheKey, scrollToBottom]);

  useScrollListener(scrollContainerRef, (e) => {
    const isAtBottom =
      Math.ceil(e.target.scrollTop) + e.target.getBoundingClientRect().height >=
      e.target.scrollHeight;

    if (isAtBottom) {
      delete scrollPositionCache[cacheKey];
      onScrollToBottom?.();
    } else {
      scrollPositionCache[cacheKey] = { scrollTop: e.target.scrollTop };
    }

    didScrollToBottomRef.current = isAtBottom;
  });

  return { didScrollToBottomRef, scrollToBottom };
};

const useReverseScrollPositionMaintainer = (scrollContainerRef) => {
  // Whenever this ref is truthy we will try to maintain the scroll position
  // (keep the same distance to the bottom) when the scroll container’s scroll
  // height changes
  const maintainScrollPositionRef = React.useRef(false);

  const maintainScrollPositionDuringTheNextDomMutation =
    React.useCallback(() => {
      maintainScrollPositionRef.current = true;
    }, []);

  const prevScrollHeightRef = React.useRef();
  const prevScrollTopRef = React.useRef();

  React.useEffect(() => {
    if (prevScrollHeightRef.current == null)
      prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
    if (prevScrollTopRef.current == null)
      prevScrollTopRef.current = scrollContainerRef.current.scrollTop;
  }, [scrollContainerRef]);

  useMutationObserver(
    scrollContainerRef,
    () => {
      const el = scrollContainerRef.current;

      if (el == null) return;

      if (maintainScrollPositionRef.current) {
        maintainScrollPositionRef.current = false;

        if (prevScrollHeightRef.current === el.scrollHeight) return;

        const scrollHeightDiff = el.scrollHeight - prevScrollHeightRef.current;

        // console.log(
        //   "scroll adjust",
        //   [el.scrollTop, prevScrollHeightRef.current + scrollHeightDiff].join(
        //     " -> "
        //   )
        // );

        // Even with 'overflow-anchor' set to 'none', some browsers still mess
        // with the scroll, so we keep track of the most recent position in
        // `prevScrollTopRef` and use that when adjusting `scrollTop`
        el.scrollTop = prevScrollTopRef.current + scrollHeightDiff;
        prevScrollTopRef.current = el.scrollTop;
      }

      // if (prevScrollHeightRef.current !== el.scrollHeight) {
      //   console.log(
      //     "height change",
      //     [prevScrollHeightRef.current, el.scrollHeight].join(" -> ")
      //   );
      // }

      prevScrollHeightRef.current = el.scrollHeight;
    },
    { subtree: true, childList: true }
  );

  useScrollListener(scrollContainerRef, () => {
    prevScrollTopRef.current = scrollContainerRef.current.scrollTop;
  });

  return maintainScrollPositionDuringTheNextDomMutation;
};

const scrollPositionCache = {};

export const ChannelBase = ({
  channel,
  accessLevel: channelAccessLevel,
  members,
  typingMembers,
  isAdmin = false,
  createMessage,
  headerContent,
  compact,
  noSideMenu,
}) => {
  const { accountAddress: walletAccountAddress } = useWallet();
  const { login } = useWalletLogin();
  const { status: authenticationStatus } = useAuth();
  const hasConnectedWallet = walletAccountAddress != null;

  const { actions, state, addBeforeDispatchListener } = useAppScope();

  const { markChannelRead } = actions;

  const user = state.selectMe();

  const { inputDeviceCanHover } = useGlobalMediaQueries();
  const [touchFocusedMessageId, setTouchFocusedMessageId] =
    React.useState(null);

  const messagesContainerRef = React.useRef();
  const scrollContainerRef = React.useRef();

  const maintainScrollPositionDuringTheNextDomMutation =
    useReverseScrollPositionMaintainer(scrollContainerRef);

  const { didScrollToBottomRef, scrollToBottom } = useScroll(
    scrollContainerRef,
    {
      cacheKey: channel.id,
      onScrollToBottom: () => {
        if (
          // Only mark as read when the page has focus
          document.hasFocus() &&
          // Wait until the initial message batch is fetched
          hasFetchedChannelMessagesAtLeastOnce &&
          // Don’t bother if the channel is already marked as read
          channelHasUnread
        ) {
          markChannelRead(channel.id);
        }
      },
    }
  );

  React.useEffect(() => {
    const removeListener = addBeforeDispatchListener((action) => {
      // Maintain scroll position when new messages arrive
      if (action.type === "messages-fetched" && action.channelId === channel.id)
        maintainScrollPositionDuringTheNextDomMutation();
    });
    return () => {
      removeListener();
    };
  }, [
    channel.id,
    addBeforeDispatchListener,
    maintainScrollPositionDuringTheNextDomMutation,
  ]);

  const fetchMessages_ = useMessageFetcher();
  const fetchMessages = useLatestCallback((channelId, query) => {
    if (query.beforeMessageId) {
      // Maintain scroll position when we render the loading placeholder
      maintainScrollPositionDuringTheNextDomMutation();
      setPendingMessagesBeforeCount(query.limit);
    }

    return fetchMessages_(channelId, query).finally(() => {
      if (query.beforeMessageId) {
        // Maintain scroll position when we remove the loading placeholder
        maintainScrollPositionDuringTheNextDomMutation();
        setPendingMessagesBeforeCount(0);
      }
    });
  });

  const { messages, hasAllMessages } = useMessages(channel.id);

  const getMember = React.useCallback(
    (ref) => members.find((m) => m.id === ref),
    [members]
  );

  const inputRef = React.useRef();

  const isMember = user != null && channel.memberUserIds.includes(user.id);

  const hasWriteAccess =
    isMember || ["open", "private"].includes(channelAccessLevel);

  // const mightHaveWriteAccess =
  //   hasWriteAccess || (channelAccessLevel === "closed" && user == null);

  const disableInput = (user == null && !hasConnectedWallet) || !hasWriteAccess; // !mightHaveWriteAccess;

  React.useEffect(() => {
    if (!inputDeviceCanHover || disableInput) return;
    inputRef.current.focus();
  }, [inputRef, inputDeviceCanHover, disableInput, channel.id]);

  const [pendingReplyMessageId, setPendingReplyMessageId] =
    React.useState(null);

  const initReply = React.useCallback((messageId) => {
    setPendingReplyMessageId(messageId);
    inputRef.current.focus();
  }, []);

  const cancelReply = React.useCallback(() => {
    setPendingReplyMessageId(null);
    inputRef.current.focus();
  }, []);

  React.useEffect(() => {
    if (messages.length !== 0) return;

    // This should be called after the first render, and when navigating to
    // emply channels
    fetchMessages(channel.id, { limit: 30 });
  }, [fetchMessages, channel.id, messages.length]);

  const channelHasUnread = state.selectChannelHasUnread(channel.id);

  const [pendingMessagesBeforeCount, setPendingMessagesBeforeCount] =
    React.useState(0);

  const [averageMessageListItemHeight, setAverageMessageListItemHeight] =
    React.useState(0);

  React.useEffect(() => {
    if (messages.length === 0) return;
    // Keep track of the average message height, so that we can make educated
    // guesses at what the placeholder height should be when fetching messages
    setAverageMessageListItemHeight(
      messagesContainerRef.current.scrollHeight / messages.length
    );
  }, [messages.length]);

  useScrollListener(scrollContainerRef, () => {
    // Bounce back when scrolling to the top of the "loading" placeholder. Makes
    // it feel like you keep scrolling like normal (ish).
    if (scrollContainerRef.current.scrollTop < 10 && pendingMessagesBeforeCount)
      scrollContainerRef.current.scrollTop =
        pendingMessagesBeforeCount * averageMessageListItemHeight -
        scrollContainerRef.current.getBoundingClientRect().height;
  });

  // Fetch new messages as the user scrolls up
  useScrollListener(
    scrollContainerRef,
    (e, { direction }) => {
      if (
        // We only care about upward scroll
        direction !== "up" ||
        // Wait until we have fetched the initial batch of messages
        messages.length === 0 ||
        // No need to react if we’ve already fetched the full message history
        hasAllMessages ||
        // Wait for any pending fetch requests to finish before we fetch again
        pendingMessagesBeforeCount !== 0
      )
        return;

      const isCloseToTop =
        // ~4 viewport heights from top
        e.target.scrollTop < e.target.getBoundingClientRect().height * 4;

      if (!isCloseToTop) return;

      fetchMessages(channel.id, {
        beforeMessageId: messages[0].id,
        limit: 30,
      });
    },
    [channel.id]
  );

  const hasFetchedChannelMessagesAtLeastOnce = state.selectHasFetchedMessages(
    channel.id
  );

  // Mark channel as read when new messages arrive and when switching channels
  React.useEffect(() => {
    if (
      // Only mark as read when the page has focus
      !document.hasFocus() ||
      // Wait until the initial message batch is fetched
      !hasFetchedChannelMessagesAtLeastOnce ||
      // Only mark as read when scrolled to the bottom
      !didScrollToBottomRef.current ||
      // Don’t bother if the channel is already marked as read
      !channelHasUnread
    )
      return;

    markChannelRead(channel.id);
  }, [
    channel.id,
    channelHasUnread,
    hasFetchedChannelMessagesAtLeastOnce,
    didScrollToBottomRef,
    markChannelRead,
  ]);

  const lastMessage = messages.slice(-1)[0];

  // Keep scroll at bottom when new messages arrive
  React.useEffect(() => {
    if (lastMessage == null || !didScrollToBottomRef.current) return;
    scrollToBottom();
  }, [lastMessage, scrollToBottom, didScrollToBottomRef]);

  useWindowFocusListener(() => {
    fetchMessages(channel.id, { limit: 30 });
    if (channelHasUnread && didScrollToBottomRef.current)
      markChannelRead(channel.id);
  });

  useOnlineListener(() => {
    fetchMessages(channel.id, { limit: 30 });
    if (channelHasUnread && didScrollToBottomRef.current)
      markChannelRead(channel.id);
  });

  const submitMessage = useLatestCallback(async (blocks) => {
    setPendingReplyMessageId(null);
    if (user == null) {
      if (
        !confirm(
          "You need to verify your account to post. Sign in with your wallet to proceed."
        )
      )
        return;

      await login(walletAccountAddress);
      await actions.fetchMe();

      if (
        !confirm("Your account has been verified. Do you still wish to post?")
      )
        return;
    }

    return createMessage({
      blocks,
      replyToMessageId: pendingReplyMessageId,
    });
  });

  const throttledRegisterTypingActivity = React.useMemo(
    () =>
      throttle(() => actions.registerChannelTypingActivity(channel.id), 3000, {
        trailing: false,
      }),
    [actions, channel.id]
  );
  const handleInputChange = useLatestCallback((blocks) => {
    if (user == null) return;
    if (blocks.length > 1 || !isNodeEmpty(blocks[0]))
      throttledRegisterTypingActivity();
  });

  const channelPrefix = channel.kind === "dm" ? "@" : "#";

  const inputPlaceholder = (() => {
    if (channel.kind === "dm") return `Message ${channel.name}`;
    if (isMember) return `Message #${channel.name}`;

    const isAuthenticated = authenticationStatus === "authenticated";

    switch (channelAccessLevel) {
      case "private":
        return `Message #${channel.name}`;

      case "closed": {
        if (isAuthenticated)
          return isMember
            ? `Message #${channel.name}`
            : `Only members can post in #${channel.name}`;

        if (!hasConnectedWallet) return "Connect wallet to chat";

        const walletAddressIsMember = members.some(
          (m) =>
            m.walletAddres != null &&
            m.walletAddress.toLowerCase() === walletAccountAddress
        );

        return walletAddressIsMember
          ? "Verify account to chat"
          : `Only members can post in #${channel.name}`;
      }

      case "open": {
        if (isAuthenticated) return `Message #${channel.name}`;
        return hasConnectedWallet
          ? "Verify account to chat"
          : "Connect wallet to chat";
      }

      default:
        return "";
    }
  })();

  return (
    <div
      css={(theme) => css`
        position: relative;
        z-index: 0;
        flex: 1;
        min-width: min(30.6rem, 100vw);
        background: ${theme.colors.backgroundPrimary};
        display: flex;
        flex-direction: column;
        height: 100%;
      `}
    >
      <Header noSideMenu={noSideMenu}>{headerContent}</Header>

      <div
        css={css({
          position: "relative",
          flex: 1,
          display: "flex",
          minHeight: 0,
          minWidth: 0,
        })}
      >
        <div
          ref={scrollContainerRef}
          css={css({
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflowY: "scroll",
            overflowX: "hidden",
            minHeight: 0,
            flex: 1,
            overflowAnchor: "none",
          })}
        >
          <div
            css={css({
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              alignItems: "stretch",
              minHeight: "100%",
            })}
          >
            {hasAllMessages && (
              <div
                css={css({ padding: "6rem 1.6rem 0" })}
                style={{ paddingBottom: messages.length !== 0 ? "1rem" : 0 }}
              >
                <div
                  css={(theme) =>
                    css({
                      borderBottom: "0.1rem solid",
                      borderColor: theme.colors.backgroundModifierAccent,
                      padding: "0 0 1.5rem",
                    })
                  }
                >
                  <div
                    css={(theme) =>
                      css({
                        fontSize: theme.fontSizes.huge,
                        fontFamily: theme.fontStacks.headers,
                        fontWeight: "500",
                        color: theme.colors.textHeader,
                        margin: "0 0 0.5rem",
                      })
                    }
                  >
                    Welcome to {channelPrefix}
                    {channel.name}!
                  </div>
                  <div
                    css={(theme) =>
                      css({
                        fontSize: theme.fontSizes.channelMessages,
                        color: theme.colors.textDimmed,
                      })
                    }
                  >
                    This is the start of {channelPrefix}
                    {channel.name}. {channel.description}
                    {channel.kind === "topic" &&
                      channel.isAdmin &&
                      members.length <= 1 &&
                      channelAccessLevel != null && (
                        <div
                          css={(theme) =>
                            css({
                              color: theme.colors.textHighlight,
                              fontSize: theme.fontSizes.default,
                              marginTop: "1rem",
                            })
                          }
                        >
                          {channelAccessLevel === "open" ? (
                            <>
                              This channel is open for anyone to join. Share its
                              URL to help people find it!
                            </>
                          ) : (
                            <>
                              Add members with the &ldquo;/add-member&rdquo;
                              command.
                            </>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </div>
            )}
            {!hasAllMessages && messages.length > 0 && (
              <OnScreenTrigger
                callback={() => {
                  // This should only happen on huge viewports where all messages from the
                  // initial fetch fit in view without a scrollbar. All other cases should be
                  // covered by the scroll listener
                  fetchMessages(channel.id, {
                    beforeMessageId: messages[0].id,
                    limit: 30,
                  });
                }}
              />
            )}
            {pendingMessagesBeforeCount > 0 && (
              <div
                css={css({
                  height: `${
                    pendingMessagesBeforeCount * averageMessageListItemHeight
                  }px`,
                })}
              />
            )}
            <div
              ref={messagesContainerRef}
              css={(theme) =>
                css({
                  minHeight: 0,
                  fontSize: theme.fontSizes.channelMessages,
                  fontWeight: "400",
                })
              }
            >
              {messages.map((m, i, ms) => (
                <ChannelMessage
                  key={m.id}
                  channel={channel}
                  message={m}
                  previousMessage={ms[i - 1]}
                  hasPendingReply={pendingReplyMessageId === m.id}
                  initReply={initReply}
                  members={members}
                  getMember={getMember}
                  isAdmin={isAdmin}
                  hasTouchFocus={touchFocusedMessageId === m.id}
                  giveTouchFocus={
                    inputDeviceCanHover ? undefined : setTouchFocusedMessageId
                  }
                  compact={compact}
                />
              ))}
              <div css={css({ height: "1.6rem" })} />
            </div>
          </div>
        </div>
      </div>
      <div css={css({ padding: "0 1.6rem 2.4rem", position: "relative" })}>
        <NewMessageInput
          ref={inputRef}
          disabled={disableInput}
          context={channel.kind}
          serverId={channel.serverId}
          channelId={channel.id}
          replyingToMessage={
            pendingReplyMessageId == null
              ? null
              : state.selectMessage(pendingReplyMessageId)
          }
          cancelReply={cancelReply}
          uploadImage={actions.uploadImage}
          submit={submitMessage}
          placeholder={inputPlaceholder}
          members={members}
          getMember={getMember}
          onInputChange={handleInputChange}
        />
        {typingMembers.length > 0 && (
          <TypingIndicator members={typingMembers} />
        )}
      </div>
    </div>
  );
};

const TypingIndicator = ({ members }) => (
  <div
    css={(theme) =>
      css({
        position: "absolute",
        left: 0,
        bottom: 0,
        padding: "0 1.5rem 0.4rem 6.5rem",
        pointerEvents: "none",
        color: theme.colors.textHeaderSecondary,
        width: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        lineHeight: 1.4,
        fontSize: theme.fontSizes.tiny,
        strong: { fontWeight: "600" },
      })
    }
  >
    {/* <svg width="24.5" height="7"> */}
    {/*   <g> */}
    {/*     <circle cx="3.5" cy="3.5" r="3.5" fill="currentColor" /> */}
    {/*     <circle cx="12.25" cy="3.5" r="3.5" fill="currentColor" /> */}
    {/*     <circle cx="21" cy="3.5" r="3.5" fill="currentColor" /> */}
    {/*   </g> */}
    {/* </svg> */}
    <span aria-live="polite" aria-atomic="true">
      {members.length === 1 ? (
        <strong>{members[0].displayName}</strong>
      ) : members.length === 2 ? (
        <>
          {members[0].displayName} and {members[1].displayName}
        </>
      ) : (
        members.map((m, i, ms) => {
          if (i === 0) return <strong key={m.id}>{m.displayName}</strong>;
          const isLast = i === ms.length - 1;
          if (isLast)
            return (
              <React.Fragment key={m.id}>
                {" "}
                , and<strong>{m.displayName}</strong>
              </React.Fragment>
            );
          return (
            <React.Fragment key={m.id}>
              {" "}
              , <strong>{m.displayName}</strong>
            </React.Fragment>
          );
        })
      )}{" "}
      is typing...
    </span>
  </div>
);

const NewMessageInput = React.memo(
  React.forwardRef(function NewMessageInput_(
    {
      submit,
      uploadImage,
      disabled,
      replyingToMessage,
      cancelReply,
      context,
      serverId,
      channelId,
      onInputChange,
      ...props
    },
    editorRef
  ) {
    const [pendingMessage, setPendingMessage] = React.useState(() => [
      createEmptyParagraph(),
    ]);

    const [isPending, setPending] = React.useState(false);

    const [imageUploads, setImageUploads] = React.useState([]);

    const isEmptyMessage =
      imageUploads.length === 0 && pendingMessage.every(isNodeEmpty);

    const fileInputRef = React.useRef();
    const uploadPromiseRef = React.useRef();
    const previousPendingMessageRef = React.useRef(pendingMessage);

    React.useEffect(() => {
      if (previousPendingMessageRef.current !== pendingMessage) {
        onInputChange(pendingMessage);
      }
      previousPendingMessageRef.current = pendingMessage;
    }, [pendingMessage, onInputChange]);

    const {
      execute: executeCommand,
      isCommand,
      commands,
    } = useCommands({ context, serverId, channelId });

    const executeMessage = async () => {
      const blocks = cleanNodes(pendingMessage);

      const isEmpty = blocks.every(isNodeEmpty);

      if (
        isEmpty &&
        // We want to allow "empty" messages if it has attachements
        imageUploads.length === 0
      )
        return;

      const messageString = editorRef.current.string();

      if (messageString.startsWith("/")) {
        const [commandName, ...args] = messageString
          .slice(1)
          .split(" ")
          .map((s) => s.trim())
          .filter(Boolean);

        if (isCommand(commandName)) {
          setPending(true);
          try {
            await executeCommand(commandName, {
              submit,
              args,
              editor: editorRef.current,
            });
          } catch (e) {
            alert(e.message);
          }
          setPending(false);
          return;
        }
      }

      // Regular submit if we don’t have pending file uploads
      if (imageUploads.length === 0 && uploadPromiseRef.current == null) {
        editorRef.current.clear();
        return submit(blocks);
      }

      const submitWithAttachments = (attachments) => {
        editorRef.current.clear();
        setImageUploads([]);

        const attachmentsBlock = {
          type: "attachments",
          children: attachments.map((u) => ({
            type: "image-attachment",
            url: u.url,
            width: u.width,
            height: u.height,
          })),
        };

        return submit([...blocks, attachmentsBlock]);
      };

      if (uploadPromiseRef.current == null)
        return submitWithAttachments(imageUploads);

      // Craziness otherwise
      try {
        setPending(true);
        const attachments = await uploadPromiseRef.current.then();
        // Only mark as pending during the upload phase. We don’t want to wait
        // for the message creation to complete since the UI is optimistic
        // and adds the message right away
        setPending(false);
        submitWithAttachments(attachments);
      } catch (e) {
        setPending(false);
        return Promise.reject(e);
      }
    };

    React.useEffect(() => {
      if (isPending) return;
      editorRef.current.focus();
    }, [isPending, editorRef]);

    return (
      <div css={css({ position: "relative" })}>
        {replyingToMessage && (
          <div
            css={(theme) =>
              css({
                position: "absolute",
                bottom: "100%",
                left: 0,
                width: "100%",
                display: "flex",
                alignItems: "center",
                background: theme.colors.backgroundSecondary,
                borderTopLeftRadius: "0.7rem",
                borderTopRightRadius: "0.7rem",
                padding: "0.6rem 1rem 0.6rem 1.1rem",
                fontSize: "1.2rem",
                color: "rgb(255 255 255 / 54%)",
              })
            }
          >
            <div css={css({ flex: 1, paddingTop: "0.2rem" })}>
              Replying to{" "}
              <span css={css({ fontWeight: "500" })}>
                {replyingToMessage.author?.displayName}
              </span>
            </div>
            <button
              onClick={cancelReply}
              css={(theme) =>
                css({
                  color: theme.colors.interactiveNormal,
                  cursor: "pointer",
                  ":hover": { color: theme.colors.interactiveHover },
                })
              }
            >
              <CrossCircleIcon style={{ width: "1.6rem", height: "auto" }} />
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeMessage();
            editorRef.current.focus();
          }}
          css={(theme) =>
            css({
              padding: "1rem",
              maxHeight: "60vh",
              overflow: "auto",
              background: theme.colors.channelInputBackground,
              borderRadius: "0.7rem",
              borderTopLeftRadius: replyingToMessage ? 0 : undefined,
              borderTopRightRadius: replyingToMessage ? 0 : undefined,
              fontSize: theme.fontSizes.channelMessages,
              "[role=textbox] [data-slate-placeholder]": {
                color: "rgb(255 255 255 / 40%)",
                opacity: "1 !important",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              },
              // Prevents iOS zooming in on input fields
              "@supports (-webkit-touch-callout: none)": {
                "[role=textbox]": { fontSize: "1.6rem" },
              },
            })
          }
          // TODO: Nicer pending state
          style={{ opacity: isPending ? 0.5 : 1 }}
        >
          <div
            css={{
              display: "grid",
              gridTemplateColumns: "auto minmax(0,1fr) auto",
              gridGap: "1.2rem",
              alignItems: "flex-start",
              paddingLeft: "0.3rem",
            }}
          >
            <button
              type="button"
              onClick={() => {
                fileInputRef.current.click();
              }}
              disabled={disabled || isPending}
              css={(theme) =>
                css({
                  cursor: "pointer",
                  color: theme.colors.interactiveNormal,
                  svg: {
                    display: "block",
                    width: "2.4rem",
                    height: "auto",
                  },
                  "&[disabled]": { pointerEvents: "none", opacity: 0.5 },
                  ":hover": {
                    color: theme.colors.interactiveHover,
                  },
                })
              }
            >
              <PlusCircleIcon />
            </button>

            <MessageInput
              ref={editorRef}
              initialValue={pendingMessage}
              onChange={(value) => {
                setPendingMessage(value);
              }}
              onKeyDown={(e) => {
                if (
                  !e.isDefaultPrevented() &&
                  !e.shiftKey &&
                  e.key === "Enter"
                ) {
                  e.preventDefault();
                  executeMessage();
                }

                if (!e.isDefaultPrevented() && e.key === "Escape") {
                  e.preventDefault();
                  cancelReply();
                }
              }}
              commands={commands}
              disabled={disabled || isPending}
              {...props}
            />

            <button
              disabled={isEmptyMessage || isPending}
              css={(theme) =>
                css({
                  color: theme.colors.primaryLight,
                  padding: "0.2rem",
                  cursor: "pointer",
                  ":hover": { filter: "brightness(1.1) saturate(1.1)" },
                  ":disabled": {
                    pointerEvents: "none",
                    color: theme.colors.disabledMessageSubmitButton,
                  },
                })
              }
              type="submit"
            >
              <svg width="20" height="20" viewBox="0 0 20 20">
                <path
                  fill="currentColor"
                  stroke="currentColor"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M2.25 2.25 17.75 10l-15.5 7.75v-4.539a1.5 1.5 0 0 1 1.46-1.5l6.54-.171a1.54 1.54 0 0 0 0-3.08l-6.54-.172a1.5 1.5 0 0 1-1.46-1.5V2.25Z"
                />
              </svg>
            </button>
          </div>

          {imageUploads.length !== 0 && (
            <div
              css={css({
                overflow: "auto",
                paddingTop: "1.2rem",
                pointerEvents: isPending ? "none" : "all",
              })}
            >
              <AttachmentList
                items={imageUploads}
                remove={({ url }) => {
                  setImageUploads((fs) => fs.filter((f) => f.url !== url));
                }}
              />
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => {
              editorRef.current.focus();

              const filesToUpload = [...e.target.files];

              setImageUploads((fs) => [
                ...fs,
                ...filesToUpload.map((f) => ({
                  name: encodeURIComponent(f.name),
                  url: URL.createObjectURL(f),
                })),
              ]);

              fileInputRef.current.value = "";

              let lastImageUploads = imageUploads;

              // Buckle up!
              uploadPromiseRef.current = Promise.all([
                uploadPromiseRef.current ?? Promise.resolve(),
                ...filesToUpload.map((file) =>
                  Promise.all([
                    getImageFileDimensions(file),
                    uploadImage({ files: [file] }).catch(() => {
                      setImageUploads((fs) => {
                        const newImageUploads = fs.filter(
                          (f) => f.name !== file.name
                        );
                        lastImageUploads = newImageUploads;
                        return newImageUploads;
                      });
                      const error = new Error(
                        `Could not upload file "${file.name}"`
                      );
                      alert(error.message);
                      return Promise.reject(error);
                    }),
                  ]).then(([dimensions, [uploadedFile]]) => {
                    setImageUploads((fs) => {
                      const newImageUploads = fs.map((f) => {
                        if (!uploadedFile.filename.endsWith(f.name)) return f;
                        return {
                          id: uploadedFile.id,
                          name: uploadedFile.filename,
                          url: uploadedFile.variants.find((url) =>
                            url.endsWith("/public")
                          ),
                          previewUrl: f.url,
                          ...dimensions,
                        };
                      });

                      lastImageUploads = newImageUploads;
                      return newImageUploads;
                    });
                  })
                ),
              ]).then(() => {
                uploadPromiseRef.current = null;
                return lastImageUploads;
              });
            }}
            hidden
          />
          <input type="submit" hidden />
        </form>
      </div>
    );
  })
);

const AttachmentList = ({ items, remove }) => (
  <div
    css={(theme) =>
      css({
        display: "grid",
        gridAutoColumns: "max-content",
        gridAutoFlow: "column",
        justifyContent: "flex-start",
        gridGap: "1rem",
        img: {
          display: "block",
          width: "6rem",
          height: "6rem",
          borderRadius: "0.5rem",
          objectFit: "cover",
          background: theme.colors.backgroundSecondary,
        },
      })
    }
  >
    {items.map(({ id, url, previewUrl }) => (
      <div
        key={url}
        css={css({
          position: "relative",
          ".delete-button": { opacity: 0 },
          ":hover .delete-button": { opacity: 1 },
        })}
      >
        <button
          type="button"
          onClick={() => {
            window.open(url, "_blank");
          }}
          css={css({
            display: "block",
            cursor: "pointer",
          })}
        >
          <img
            src={url}
            style={{
              transition: "0.1s opacity",
              opacity: id == null ? 0.7 : 1,
              background: previewUrl == null ? undefined : `url(${previewUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        </button>

        {id == null && (
          <div
            style={{
              pointerEvents: "none",
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translateX(-50%) translateY(-50%)",
            }}
            css={(theme) => css({ color: theme.colors.interactiveNormal })}
          >
            <Spinner />
          </div>
        )}

        <button
          type="button"
          className="delete-button"
          css={(theme) =>
            css({
              position: "absolute",
              top: 0,
              right: 0,
              transform: "translateX(50%) translateY(-50%)",
              cursor: "pointer",
              background: theme.colors.channelInputBackground,
              borderRadius: "50%",
              boxShadow: `0 0 0 0.2rem ${theme.colors.channelInputBackground}`,
              svg: {
                width: "2.2rem",
                height: "auto",
                color: theme.colors.interactiveNormal,
              },
              ":hover svg": {
                color: theme.colors.interactiveHover,
              },
            })
          }
          onClick={() => {
            remove({ url });
          }}
        >
          <PlusCircleIcon style={{ transform: "rotate(45deg" }} />
        </button>
      </div>
    ))}
  </div>
);

const Heading = ({ component: Component = "div", children, ...props }) => (
  <Component
    css={(theme) =>
      css({
        fontSize: theme.fontSizes.headerDefault,
        fontWeight: theme.text.weights.header,
        color: theme.colors.textHeader,
        fontFamily: theme.fontStacks.headers,
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        userSelect: "text",
        cursor: "default",
      })
    }
    {...props}
  >
    {children}
  </Component>
);

const Channel = ({ compact, noSideMenu }) => {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const { status: authenticationStatus } = useAuth();
  const { state, actions } = useAppScope();
  const { isFloating: isSideMenuFloating } = useSideMenu();

  const user = state.selectMe();

  const {
    connect: connectWallet,
    // cancel: cancelWalletConnectionAttempt,
    // canConnect: canConnectWallet,
    accountAddress,
    accountEnsName,
    // chain,
    isConnecting: isConnectingWallet,
    // error: walletError,
    // switchToEthereumMainnet,
  } = useWallet();

  const {
    login,
    status: loginStatus,
    // error: loginError
  } = useWalletLogin();

  const [notFound, setNotFound] = React.useState(false);
  const [isMembersDialogOpen, setMembersDialogOpen] = React.useState(false);

  const isMenuTogglingEnabled = !noSideMenu && isSideMenuFloating;

  const {
    fetchChannel,
    fetchChannelMembers,
    fetchChannelPublicPermissions,
    fetchApps,
  } = actions;

  const fetchMessages = useMessageFetcher(params.channelId);

  const channel = state.selectChannel(params.channelId);
  const channelAccessLevel = state.selectChannelAccessLevel(params.channelId);
  const isChannelStarred = state.selectIsChannelStarred(params.channelId);

  const members = state.selectChannelMembers(params.channelId);
  const isFetchingMembers = members.some((m) => m.walletAddress == null);
  const isMember = user != null && members.some((m) => m.id === user.id);

  const createMessage = useLatestCallback(
    async ({ blocks, replyToMessageId }) => {
      if (
        channel.memberUserIds != null &&
        !channel.memberUserIds.includes(user?.id)
      )
        await actions.joinChannel(params.channelId);

      return actions.createMessage({
        server: channel.kind === "server" ? channel.serverId : undefined,
        channel: params.channelId,
        content: stringifyMessageBlocks(blocks),
        blocks,
        replyToMessageId,
      });
    }
  );

  React.useEffect(() => {
    setNotFound(false);
    // Timeout to prevent this stalling other requests
    setTimeout(() => {
      fetchChannel(params.channelId).catch((e) => {
        if (e.code === 404) {
          setNotFound(true);
          return;
        }
        throw e;
      });
    }, 0);
  }, [params.channelId, fetchChannel]);

  useFetch(() => fetchChannelMembers(params.channelId), [params.channelId]);
  useFetch(
    () => fetchChannelPublicPermissions(params.channelId),
    [params.channelId]
  );
  useFetch(
    authenticationStatus === "not-authenticated"
      ? () => fetchApps(params.channelId)
      : undefined,
    [params.channelId]
  );

  React.useEffect(() => {
    fetchMessages(params.channelId, { limit: 30 });
  }, [params.channelId, fetchMessages]);

  useInterval(
    () => {
      fetchMessages(params.channelId, { limit: 20 });
    },
    {
      // Only long-poll fetch when user is logged out, or when not a member
      delay:
        authenticationStatus === "not-authenticated" ||
        (user != null && !isMember)
          ? 5000
          : 0,
      requireFocus: true,
      requireOnline: true,
    }
  );

  const theme = useTheme();
  const isEmbedded = searchParams.get("mode") === "embedded";
  const hideConnectButton = searchParams.get("hide-connect-button") != null;

  const headerContent = React.useMemo(
    () =>
      channel == null ? null : (
        <>
          {!isMenuTogglingEnabled &&
            (channel.avatar == null ? (
              <>
                {!isEmbedded && (
                  <div
                    css={(theme) =>
                      css({
                        color: theme.colors.textMuted,
                        marginRight: "0.6rem",
                      })
                    }
                  >
                    {channel.kind === "dm" ? (
                      <AtSignIcon style={{ width: "2.2rem" }} />
                    ) : (
                      <HashIcon style={{ width: "1.6rem" }} />
                    )}
                  </div>
                )}
              </>
            ) : (
              <a href={channel.avatar} rel="noreferrer" target="_blank">
                <Avatar
                  url={channel.avatar}
                  size="2.4rem"
                  pixelSize={24}
                  css={css({ marginRight: "1.1rem" })}
                />
              </a>
            ))}
          {!isEmbedded && <Heading>{channel?.name}</Heading>}
          <div style={{ flex: 1, minWidth: 0 }}>
            {channel.description != null && (
              <div
                css={(theme) =>
                  css({
                    color: theme.colors.textHeaderSecondary,
                    marginLeft: "1.1rem",
                    padding: "0 1.1rem",
                    borderLeft: "1px solid",
                    borderColor: "hsl(0 0% 100% / 20%)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    userSelect: "text",
                    cursor: "default",
                  })
                }
              >
                {channel.description}
              </div>
            )}
          </div>

          {user != null && (
            <>
              <button
                onClick={() => {
                  if (isChannelStarred) {
                    actions.unstarChannel(channel.id);
                    return;
                  }

                  actions.starChannel(channel.id);
                }}
                css={(theme) =>
                  css({
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "0.3rem",
                    width: "3.3rem",
                    height: "2.8rem",
                    padding: 0,
                    transition: "background 20ms ease-in",
                    marginRight: "0.2rem",
                    ":hover": {
                      background: theme.colors.backgroundModifierHover,
                    },
                  })
                }
              >
                {isChannelStarred ? (
                  <StarIcon style={{ color: "rgb(202, 152, 73)" }} />
                ) : (
                  <StrokedStarIcon />
                )}
              </button>

              {!isFetchingMembers && members.length !== 0 && (
                <>
                  <MembersDisplayButton
                    onClick={() => {
                      setMembersDialogOpen(true);
                    }}
                    members={members}
                  />
                  <Dialog
                    isOpen={isMembersDialogOpen}
                    onRequestClose={() => {
                      setMembersDialogOpen(false);
                    }}
                    style={{ display: "flex", flexDirection: "column" }}
                    underlayProps={{
                      css: css({
                        padding: "2.8rem 1.5rem",
                        "@media (min-width: 600px)": {
                          padding: "2.8rem",
                        },
                      }),
                    }}
                  >
                    {({ titleProps }) => (
                      <MembersDirectoryDialog
                        members={members}
                        titleProps={titleProps}
                      />
                    )}
                  </Dialog>
                </>
              )}
            </>
          )}

          {authenticationStatus === "not-authenticated" &&
            ((!hideConnectButton && isConnectingWallet) ||
            loginStatus === "requesting-signature" ? (
              <div
                css={(theme) =>
                  css({
                    display: "flex",
                    color: theme.colors.textDimmed,
                  })
                }
              >
                Check your wallet...{" "}
                <Spinner size="1.8rem" style={{ marginLeft: "1rem" }} />
              </div>
            ) : accountAddress != null ? (
              <span
                css={(theme) =>
                  css({
                    display: "flex",
                    alignItems: "center",
                    fontSize: theme.fontSizes.default,
                    paddingLeft: "0.5rem",
                    overflow: "hidden",
                  })
                }
              >
                <span
                  css={css({
                    flex: 1,
                    minWidth: 0,
                    userSelect: "text",
                    cursor: "default",
                    whiteSpace: "nowrap",
                    overflow: "auto",
                  })}
                >
                  <a
                    href={`https://etherscan.io/address/${accountAddress}`}
                    rel="noreferrer"
                    target="_blank"
                    css={(theme) =>
                      css({
                        display: "inline-flex",
                        alignItems: "center",
                        color: theme.colors.linkColor,
                        ":hover": { color: theme.colors.linkColorHighlight },
                        ":hover [data-avatar]": { opacity: 0.9 },
                      })
                    }
                  >
                    {accountEnsName}{" "}
                    {accountEnsName == null ? (
                      truncateAddress(accountAddress)
                    ) : (
                      <>({truncateAddress(accountAddress)})</>
                    )}
                    <Avatar
                      data-avatar
                      walletAddress={accountAddress}
                      size="2.6rem"
                      style={{ marginLeft: "0.5rem" }}
                    />
                  </a>
                </span>
                <Button
                  variant={theme.name === "nouns.tv" ? "primary" : "default"}
                  onClick={() => {
                    login(accountAddress);
                  }}
                  style={{ marginLeft: "1.2rem" }}
                >
                  Verify account
                </Button>
              </span>
            ) : !hideConnectButton ? (
              <Button
                variant={theme.name === "nouns.tv" ? "primary" : "default"}
                size="default"
                onClick={connectWallet}
              >
                Connect wallet
              </Button>
            ) : null)}
        </>
      ),
    [
      isEmbedded,
      hideConnectButton,
      loginStatus,
      theme,
      isFetchingMembers,
      accountAddress,
      accountEnsName,
      login,
      user,
      authenticationStatus,
      connectWallet,
      isConnectingWallet,
      actions,
      isMenuTogglingEnabled,
      channel,
      members,
      isChannelStarred,
      isMembersDialogOpen,
    ]
  );

  if (notFound)
    return (
      <div
        css={(theme) =>
          css({
            background: theme.colors.backgroundPrimary,
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          })
        }
      >
        Not found
      </div>
    );

  if (channel == null)
    return (
      <div
        css={(theme) =>
          css({
            background: theme.colors.backgroundPrimary,
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          })
        }
      >
        <Spinner size="2.4rem" />
      </div>
    );

  const typingChannelMembers = state.selectChannelTypingMembers(
    params.channelId
  );

  return (
    <ChannelBase
      compact={compact}
      noSideMenu={noSideMenu}
      channel={channel}
      members={members}
      typingMembers={typingChannelMembers}
      createMessage={createMessage}
      isAdmin={channel?.isAdmin}
      accessLevel={channelAccessLevel}
      headerContent={headerContent}
    />
  );
};

const OnScreenTrigger = ({ callback }) => {
  const ref = React.useRef();
  const callbackRef = React.useRef(callback);

  const isOnScreen = useIsOnScreen(ref);

  React.useEffect(() => {
    callbackRef.current = callback;
  });

  React.useEffect(() => {
    if (isOnScreen) callbackRef.current();
  }, [isOnScreen]);

  return <div ref={ref} />;
};

export const Header = ({ noSideMenu, children }) => {
  const { isFloating: isSideMenuFloating, toggle: toggleMenu } = useSideMenu();
  const isMenuTogglingEnabled = !noSideMenu && isSideMenuFloating;
  return (
    <div
      css={(theme) =>
        css({
          height: theme.mainHeader.height,
          padding: "0 1.6rem",
          display: "flex",
          alignItems: "center",
          boxShadow: theme.mainHeader.shadow,
          WebkitAppRegion: isNative ? "drag" : undefined,
          minWidth: 0,
          width: "100%",
          ...(theme.mainHeader.floating
            ? {
                position: "absolute",
                top: 0,
                left: 0,
                background:
                  "linear-gradient(180deg, #191919 0%, #191919d9 50%,  transparent 100%)",
                zIndex: "2",
              }
            : {}),
        })
      }
    >
      {isMenuTogglingEnabled && (
        <button
          onClick={() => {
            toggleMenu();
          }}
          css={css({
            background: "none",
            border: 0,
            color: "white",
            cursor: "pointer",
            padding: "0.8rem 0.6rem",
            marginLeft: "-0.6rem",
            marginRight: "calc(-0.6rem + 1.6rem)",
          })}
        >
          <HamburgerMenuIcon
            css={(theme) =>
              css({
                fill: theme.colors.interactiveNormal,
                width: "1.5rem",
                ":hover": { fill: theme.colors.interactiveHover },
              })
            }
          />
        </button>
      )}
      {children}
    </div>
  );
};
const compareMembersByOwnerOnlineStatusAndDisplayName = (m1, m2) => {
  if (m1.isOwner !== m2.isOwner) return m1.isOwner ? -1 : 1;

  if (m1.onlineStatus !== m2.onlineStatus)
    return m1.onlineStatus === "online" ? -1 : 1;

  const [name1, name2] = [m1, m2].map((m) => m.displayName?.toLowerCase());

  const [name1IsAddress, name2IsAddress] = [name1, name2].map(
    (n) => n != null && n.startsWith("0x") && n.includes("...")
  );

  if (!name1IsAddress && name2IsAddress) return -1;
  if (name1IsAddress && !name2IsAddress) return 1;

  if (name1 < name2) return -1;
  if (name1 > name2) return 1;
  return 0;
};

const MembersDisplayButton = React.forwardRef(({ onClick, members }, ref) => {
  const sortedMembers = React.useMemo(
    () => sort(compareMembersByOwnerOnlineStatusAndDisplayName, members),
    [members]
  );

  const memberCount = members.length;
  const onlineMemberCount = members.filter(
    (m) => m.onlineStatus === "online"
  ).length;

  const membersToDisplay = sortedMembers.slice(0, 3);

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          ref={ref}
          onClick={onClick}
          css={(theme) =>
            css({
              display: "flex",
              alignItems: "center",
              padding: "0.4rem 0.6rem",
              borderRadius:
                theme.avatars.borderRadius === "50%" ? "0.3rem" : "0.4rem",
              boxShadow:
                theme.avatars.borderRadius === "50%"
                  ? "none"
                  : "0 0 0 0.1rem hsl(0 0% 100% / 18%)",
              cursor: "pointer",
              ":hover": {
                background: theme.colors.backgroundModifierHover,
                boxShadow:
                  theme.avatars.borderRadius === "50%"
                    ? "none"
                    : "0 0 0 0.1rem hsl(0 0% 100% / 25%)",
              },
            })
          }
        >
          {membersToDisplay.map((user, i) => (
            <Avatar
              key={user.id}
              url={user?.profilePicture?.small}
              walletAddress={user?.walletAddress}
              size="2rem"
              pixelSize={20}
              css={(theme) =>
                css({
                  marginLeft: i === 0 ? 0 : "-0.4rem",
                  boxShadow: `0 0 0 0.2rem ${theme.colors.backgroundPrimary}`,
                  position: "relative",
                  zIndex: `calc(${i} * -1)`,
                  borderRadius: theme.avatars.borderRadius,
                })
              }
            />
          ))}

          <div
            css={(theme) =>
              css({
                marginLeft: "0.4rem",
                padding: "0 0.3rem",
                fontSize: theme.fontSizes.small,
                color: theme.colors.textHeaderSecondary,
              })
            }
          >
            {members.length}
          </div>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Content sideOffset={5}>
        View all members of this channel
        <div css={(theme) => css({ color: theme.colors.textMuted })}>
          {onlineMemberCount === memberCount
            ? "All members online"
            : `${onlineMemberCount} ${
                onlineMemberCount === 1 ? "member" : "members"
              } online`}
        </div>
      </Tooltip.Content>
    </Tooltip.Root>
  );
});

const MembersDirectoryDialog = ({ members, titleProps }) => {
  const [query, setQuery] = React.useState("");

  const filteredMembers = React.useMemo(() => {
    if (query.trim() === "")
      return sort(compareMembersByOwnerOnlineStatusAndDisplayName, members);

    const q = query.trim().toLowerCase();
    const getSearchTokens = (m) => [m.displayName, m.walletAddress];

    const unorderedFilteredMembers = members.filter((member) =>
      getSearchTokens(member).some((t) => t.toLowerCase().includes(q))
    );

    const orderedFilteredMembers = sort((m1, m2) => {
      const [i1, i2] = [m1, m2].map((m) =>
        Math.min(
          ...getSearchTokens(m)
            .map((t) => t.indexOf(q))
            .filter((index) => index !== -1)
        )
      );

      if (i1 < i2) return -1;
      if (i1 > i2) return 1;
      return 0;
    }, unorderedFilteredMembers);

    return orderedFilteredMembers;
  }, [members, query]);

  const memberCount = members.length;
  const onlineMemberCount = members.filter(
    (m) => m.onlineStatus === "online"
  ).length;

  return (
    <>
      <div
        css={css({
          padding: "1.5rem 1.5rem 0",
          "@media (min-width: 600px)": {
            padding: "2rem 2rem 0",
          },
        })}
      >
        <header
          css={css({
            display: "grid",
            gridTemplateColumns: "auto auto",
            gridGap: "1rem",
            alignItems: "flex-end",
            justifyContent: "flex-start",
            margin: "0 0 1.5rem",
          })}
        >
          <h1
            css={(theme) =>
              css({ fontSize: theme.fontSizes.large, lineHeight: "1.2" })
            }
            {...titleProps}
          >
            Members
          </h1>
          <div
            css={(theme) =>
              css({
                color: theme.colors.textMuted,
                fontSize: theme.fontSizes.small,
              })
            }
          >
            {onlineMemberCount === 0 ? (
              memberCount
            ) : (
              <>
                {onlineMemberCount} of {memberCount} online
              </>
            )}
          </div>
          {/* <Dialog.Close */}
          {/*   css={css({ */}
          {/*     padding: "0.8rem", */}
          {/*     display: "block", */}
          {/*     margin: "0 auto", */}
          {/*   })} */}
          {/* > */}
          {/*   close */}
          {/* </Dialog.Close> */}
        </header>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
          }}
          placeholder="Find members"
          css={(theme) =>
            css({
              position: "relative",
              color: "white",
              background: theme.colors.backgroundSecondary,
              fontSize: "1.5rem",
              fontWeight: "400",
              borderRadius: "0.3rem",
              padding: "0.5rem 0.7rem",
              width: "100%",
              outline: "none",
              border: 0,
              "&:focus": {
                boxShadow: `0 0 0 0.2rem ${theme.colors.primary}`,
              },
              // Prevents iOS zooming in on input fields
              "@supports (-webkit-touch-callout: none)": {
                fontSize: "1.6rem",
              },
            })
          }
        />
      </div>
      <div css={css({ flex: 1, overflow: "auto", padding: "1.3rem 0" })}>
        <ul>
          {filteredMembers.map((member) => {
            const truncatedAddress =
              member.walletAddress == null
                ? null
                : truncateAddress(member.walletAddress);
            return (
              <li key={member.id} css={css({ display: "block" })}>
                <button
                  css={(theme) =>
                    css({
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "auto minmax(0,1fr)",
                      gridGap: "1rem",
                      alignItems: "center",
                      lineHeight: "1.4",
                      padding: "0.5rem 1.5rem",
                      ":not(:first-of-type)": {
                        marginTop: "0.1rem",
                      },
                      ":hover": {
                        background: theme.colors.backgroundModifierSelected,
                      },
                      cursor: "pointer",
                      "@media (min-width: 600px)": {
                        gridGap: "1.5rem",
                        padding: "0.7rem 2rem",
                      },
                    })
                  }
                  onClick={() => {
                    navigator.clipboard
                      .writeText(member.walletAddress)
                      .then(() => {
                        alert(
                          "Close your eyes and imagine a beautiful profile dialog/popover appearing"
                        );
                      });
                  }}
                >
                  <Avatar
                    url={member.profilePicture?.small}
                    walletAddress={member.walletAddress}
                    size="3.6rem"
                    pixelSize={36}
                    borderRadius="0.3rem"
                  />
                  <div>
                    <div css={css({ display: "flex", alignItems: "center" })}>
                      {member.displayName}
                      {member.isOwner && (
                        <span
                          css={(theme) =>
                            css({
                              fontSize: theme.fontSizes.tiny,
                              color: theme.colors.textMuted,
                              background: theme.colors.backgroundModifierHover,
                              padding: "0.1rem 0.3rem",
                              borderRadius: "0.3rem",
                              marginLeft: "0.7rem",
                            })
                          }
                        >
                          Channel owner
                        </span>
                      )}

                      {member.onlineStatus === "online" && (
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <div
                              css={css({
                                display: "inline-flex",
                                padding: "0.5rem 0.2rem",
                                marginLeft: "0.6rem",
                                position: "relative",
                              })}
                            >
                              <div
                                css={(theme) =>
                                  css({
                                    width: "0.7rem",
                                    height: "0.7rem",
                                    borderRadius: "50%",
                                    background: theme.colors.onlineIndicator,
                                  })
                                }
                              />
                            </div>
                          </Tooltip.Trigger>
                          <Tooltip.Content
                            side="top"
                            align="center"
                            sideOffset={6}
                          >
                            User online
                          </Tooltip.Content>
                        </Tooltip.Root>
                      )}
                    </div>
                    {member.displayName !== truncatedAddress && (
                      <div
                        css={(theme) =>
                          css({
                            fontSize: theme.fontSizes.small,
                            color: theme.colors.textMuted,
                          })
                        }
                      >
                        {truncatedAddress}
                      </div>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
};

export default (props) => {
  const { status } = useAuth();
  if (status === "loading") return null;
  return <Channel {...props} compact={location.search.includes("compact=1")} />;
};
