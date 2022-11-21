import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import * as ImagePicker from "expo-image-picker";
import React from "react";
import { useEnsName } from "wagmi";
import {
  Text,
  View,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Pressable,
  InputAccessoryView,
  Modal,
  AppState,
  Alert,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useFocusEffect,
  useRoute,
  useNavigation,
} from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import Svg, { G, Path } from "react-native-svg";
import { FlashList } from "@shopify/flash-list";
import * as Shades from "@shades/common";
import * as Localization from "expo-localization";
import theme from "../theme";
import useAppActiveListener from "../hooks/app-active-listener";
import useOnlineListener from "../hooks/online-listener";
import FormattedDate from "../components/formatted-date";
import RichText from "../components/rich-text";
import UserProfilePicture from "../components/user-profile-picture";
import MessageModalContent from "./message-modal";
import { ChannelPicture } from "./channel-list";
import {
  Globe as GlobeIcon,
  Emoji as EmojiIcon,
  CrossCircle as CrossCircleIcon,
} from "../components/icons";

const { useLatestCallback } = Shades.react;
const { useAppScope, useMessageEmbeds } = Shades.app;
const {
  message: messageUtils,
  url: urlUtils,
  ethereum: ethereumUtils,
} = Shades.utils;

const ONE_MINUTE_IN_MILLIS = 1000 * 60;

const { textDefault, background } = theme.colors;

// export const options = {
//   headerMode: "screen",
//   headerShown: true,
//   // headerTitle: () => "", // <Text>hi</Text>,
//   headerStyle: { backgroundColor: background },
//   // headerShadowVisible: false,
//   header: () => <DefaultStackHeader />,
//   gestureResponseDistance: 800,
//   // fullScreenGestureEnabled: true,
//   // detachPreviousScreen: false,
// };
export const options = {
  headerShown: true,
  headerTitle: () => "", // <Text>hi</Text>,
  headerStyle: { backgroundColor: background },
  headerShadowVisible: false,
  headerLeft: () => (
    <View style={{ marginLeft: -16 }}>
      <HeaderLeft />
    </View>
  ),
  headerRight: () => <HeaderRight />,
  lazy: false,
};

// Region might return `null` on Android
const locale = ["en", Localization.region].filter(Boolean).join("-");

const useFetch = (fetcher_, deps) => {
  const fetcher = useLatestCallback(fetcher_);

  useFocusEffect(
    React.useCallback(() => {
      fetcher();
      // eslint-disable-next-line
    }, deps)
  );

  useAppActiveListener(() => {
    fetcher();
  });

  useOnlineListener(() => {
    fetcher();
  });
};

const useChannelMessages = ({ channelId }) => {
  const { actions, state } = useAppScope();
  const { fetchMessages } = actions;

  const messages = state.selectChannelMessages(channelId);

  useFetch(() => {
    if (channelId == null) return;
    return fetchMessages(channelId);
  }, [channelId, fetchMessages]);

  const sortedMessages = messages.sort(
    (m1, m2) => new Date(m1.created_at) - new Date(m2.created_at)
  );

  return sortedMessages;
};

const useChannelName = () => {
  const { params } = useRoute();
  const { state } = useAppScope();

  const { channelId, walletAddress } = params;

  const { data: ensName } = useEnsName({
    address: walletAddress,
    enabled: walletAddress != null,
  });

  if (channelId == null)
    return ensName ?? ethereumUtils.truncateAddress(walletAddress);

  return state.selectChannelName(channelId);
};

const HeaderLeft = () => {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { state } = useAppScope();

  const { channelId } = params;

  const channel = state.selectChannel(channelId);
  const channelName = useChannelName();
  const memberCount = channel?.memberUserIds.length ?? 0;

  const windowWidth = Dimensions.get("window").width;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 10,
      }}
    >
      <View style={{ width: 38, justifyContent: "center", marginRight: 12 }}>
        <Pressable
          onPress={() => {
            navigation.goBack();
          }}
          style={{
            width: 32,
            height: 32,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {({ pressed }) => (
            <Svg
              width="34"
              height="34"
              viewBox="0 0 15 15"
              fill="none"
              style={{
                position: "relative",
                left: 3,
                color: pressed ? "gray" : "white", // "rgb(35, 131, 226)"
              }}
            >
              <Path
                d="M8.81809 4.18179C8.99383 4.35753 8.99383 4.64245 8.81809 4.81819L6.13629 7.49999L8.81809 10.1818C8.99383 10.3575 8.99383 10.6424 8.81809 10.8182C8.64236 10.9939 8.35743 10.9939 8.1817 10.8182L5.1817 7.81819C5.09731 7.73379 5.0499 7.61933 5.0499 7.49999C5.0499 7.38064 5.09731 7.26618 5.1817 7.18179L8.1817 4.18179C8.35743 4.00605 8.64236 4.00605 8.81809 4.18179Z"
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
              />
            </Svg>
          )}
        </Pressable>
      </View>
      {(channel != null || channelId == null) && (
        <Pressable
          onPress={() => {
            navigation.navigate("Channel details modal", {
              screen: "Root",
              params: {
                channelId,
              },
            });
          }}
          style={{ flexDirection: "row", alignItems: "center" }}
        >
          {({ pressed }) => (
            <>
              {(channel?.kind === "dm" || channel?.image != null) && (
                <View style={{ marginRight: 10 }}>
                  <ChannelPicture
                    transparent
                    channelId={params.channelId}
                    size={32}
                  />
                </View>
              )}
              <View style={{ maxWidth: windowWidth - 150 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: pressed ? "hsl(0,0%,50%)" : "white",
                    fontSize: 16,
                    fontWeight: "600",
                    lineHeight: 18,
                  }}
                >
                  {channelName}
                </Text>
                {memberCount > 1 && (
                  <Text
                    style={{
                      color: "gray",
                      fontSize: 11.5,
                      fontWeight: "400",
                      lineHeight: 14,
                    }}
                  >
                    {memberCount} {memberCount === 1 ? "member" : "members"}
                  </Text>
                )}
              </View>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
};

const HeaderRight = () => {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { state } = useAppScope();

  const hasOpenReadAccess = state.selectChannelHasOpenReadAccess(
    params.channelId
  );

  return (
    <View>
      {hasOpenReadAccess && (
        <Pressable
          onPress={() => {
            navigation.navigate("Channel details modal", {
              screen: "Root",
              params: {
                channelId: params.channelId,
              },
            });
          }}
          style={{ padding: 4 }}
        >
          {({ pressed }) => (
            <GlobeIcon
              style={{
                color: pressed
                  ? theme.colors.textMuted
                  : theme.colors.textDimmed,
              }}
            />
          )}
        </Pressable>
      )}
    </View>
  );
};

const Channel = ({ navigation, route: { params } }) => {
  const [pendingMessage, setPendingMessage] = React.useState("");

  const [selectedMessageId, setSelectedMessageId] = React.useState(null);
  const [editingMessageId, setEditingMessageId] = React.useState(null);
  const [replyTargetMessageId, setReplyTargetMessageId] = React.useState(null);

  const { channelId, walletAddress: dmUserWalletAddress } = params;
  const { state, actions } = useAppScope();
  const {
    fetchChannelMembers,
    fetchChannelPermissions,
    fetchChannelPublicPermissions,
    fetchMessages,
    markChannelRead,
  } = actions;

  const channelName = useChannelName();

  const messages = useChannelMessages({ channelId });
  const headerHeight = useHeaderHeight();

  const inputRef = React.useRef();
  const scrollViewRef = React.useRef();

  useFetch(() => {
    if (channelId == null) return;
    return fetchChannelMembers(channelId);
  }, [channelId, fetchChannelMembers]);

  useFetch(() => {
    if (channelId == null) return;
    return fetchChannelPublicPermissions(channelId);
  }, [channelId, fetchChannelPublicPermissions]);

  useFetch(() => {
    if (channelId == null) return;
    return fetchChannelPermissions(channelId);
  }, [channelId, fetchChannelPermissions]);

  const didScrollToBottomRef = React.useRef(true);

  const fetchMoreMessages = useLatestCallback(() => {
    if (channelId == null) return;
    if (messages.length === 0) return;
    return fetchMessages(channelId, {
      beforeMessageId: messages[0].id,
      limit: 30,
    });
  });

  const channelHasUnread = state.selectChannelHasUnread(channelId);
  const hasFetchedChannelMessagesAtLeastOnce =
    state.selectHasFetchedMessages(channelId);

  // Mark channel as read when new messages arrive
  React.useEffect(() => {
    if (channelId == null) return;

    if (
      // Only mark as read when the app is active
      AppState.currentState !== "active" ||
      // Wait until the initial message batch is fetched
      !hasFetchedChannelMessagesAtLeastOnce ||
      // Only mark as read when scrolled to the bottom
      !didScrollToBottomRef.current ||
      // Don’t bother if the channel is already marked as read
      !channelHasUnread
    )
      return;

    markChannelRead(channelId);
  }, [
    channelId,
    channelHasUnread,
    hasFetchedChannelMessagesAtLeastOnce,
    didScrollToBottomRef,
    markChannelRead,
  ]);

  const handleScrolledToBottom = () => {
    if (channelId == null) return;
    if (AppState.currentState !== "active" || !channelHasUnread) return;
    markChannelRead(channelId);
  };

  React.useEffect(() => {
    if (editingMessageId == null && replyTargetMessageId == null) return;
    inputRef.current.focus();
  }, [editingMessageId, replyTargetMessageId]);

  const replyTargetMessage = state.selectMessage(replyTargetMessageId);

  return (
    <>
      <SafeAreaView
        edges={["left", "right", "bottom"]}
        style={{ flex: 1, backgroundColor: background }}
      >
        <KeyboardAvoidingView
          behavior="padding"
          keyboardVerticalOffset={headerHeight}
          style={{ flex: 1 }}
        >
          <ChannelMessagesScrollView
            ref={scrollViewRef}
            messages={messages}
            onEndReached={fetchMoreMessages}
            getMember={state.selectUser}
            onScroll={(e) => {
              const isAtBottom = e.nativeEvent.contentOffset.y === 0;
              didScrollToBottomRef.current = isAtBottom;

              if (isAtBottom) handleScrolledToBottom();
            }}
            focusedMessageId={editingMessageId ?? replyTargetMessageId}
            selectMessage={(id) => {
              setSelectedMessageId(id);
            }}
            selectUser={(id) => {
              navigation.navigate("User modal", { userId: id });
            }}
          />
          {editingMessageId != null && (
            <InputHeader
              message="Editing message"
              onCancel={() => {
                setEditingMessageId(null);
                setPendingMessage("");
                inputRef.current.blur();
              }}
            />
          )}
          {replyTargetMessageId != null && (
            <InputHeader
              message={
                <>
                  Replying to{" "}
                  <Text style={{ color: textDefault, fontWeight: "600" }}>
                    {replyTargetMessage?.author?.displayName ?? "..."}
                  </Text>
                </>
              }
              onCancel={() => {
                setReplyTargetMessageId(null);
                inputRef.current.blur();
              }}
            />
          )}
          <ChannelMessageInput
            ref={inputRef}
            placeholder={channelName == null ? "..." : `Message ${channelName}`}
            pendingMessage={pendingMessage}
            setPendingMessage={setPendingMessage}
            onSubmit={(content, { images } = {}) => {
              const createBlocks = (content) => {
                if (content == null || content.trim() === "") return [];

                const paragraphContentElements = content
                  .split(" ")
                  .reduce((els, word) => {
                    const prev = els[els.length - 1];

                    if (urlUtils.validate(word)) {
                      if (prev != null) prev.text = `${prev.text} `;
                      const url = new URL(word);
                      return [...els, { type: "link", url: url.href }];
                    }

                    if (prev == null || prev.type === "link")
                      return [
                        ...els,
                        { text: prev == null ? word : ` ${word}` },
                      ];

                    prev.text = `${prev.text} ${word}`;

                    return els;
                  }, []);

                return [
                  messageUtils.createParagraphElement(paragraphContentElements),
                ];
              };

              const blocks = createBlocks(content);

              if (images != null && images.length > 0)
                blocks.push({
                  type: "attachments",
                  children: images.map(({ url, width, height }) => ({
                    type: "image-attachment",
                    url,
                    width,
                    height,
                  })),
                });

              if (blocks.length === 0) throw new Error();

              if (editingMessageId != null) {
                setEditingMessageId(null);
                inputRef.current.blur();
                return actions.updateMessage(editingMessageId, { blocks });
              }

              if (replyTargetMessageId != null) {
                setReplyTargetMessageId(null);
                scrollViewRef.current.scrollToIndex({
                  index: 0,
                  animated: true,
                });
                return actions.createMessage({
                  channel: channelId,
                  replyToMessageId: replyTargetMessageId,
                  blocks,
                });
              }

              if (channelId != null)
                return actions.createMessage({ channel: channelId, blocks });

              return actions
                .createDmChannel({
                  memberWalletAddresses: [dmUserWalletAddress],
                })
                .then((c) => {
                  navigation.setParams({
                    channelId: c.id,
                    walletAddress: undefined,
                  });
                  return actions.createMessage({ channel: c.id, blocks });
                });
            }}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        visible={selectedMessageId != null}
        onRequestClose={() => {
          setSelectedMessageId(null);
        }}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <MessageModalContent
          messageId={selectedMessageId}
          startEdit={() => {
            setReplyTargetMessageId(null);
            setEditingMessageId(selectedMessageId);
            const message = state.selectMessage(selectedMessageId);
            setSelectedMessageId(null);
            keyboardShouldPersistTaps = "always";
            setPendingMessage(messageUtils.stringifyBlocks(message.content));
          }}
          startReply={() => {
            setEditingMessageId(null);
            setReplyTargetMessageId(selectedMessageId);
            setSelectedMessageId(null);
          }}
          deleteMessage={() => {
            Alert.alert(
              "Delete message",
              "Are you sure you want to delete this message?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => {
                    actions.removeMessage(selectedMessageId);
                    setSelectedMessageId(null);
                  },
                },
              ]
            );
          }}
          dismiss={() => {
            setSelectedMessageId(null);
          }}
        />
      </Modal>
    </>
  );
};

const InputHeader = ({ message, onCancel }) => (
  <View
    style={{
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: "hsl(0,0%,12%)",
      flexDirection: "row",
      alignItems: "center",
    }}
  >
    {onCancel != null && (
      <Pressable onPress={onCancel}>
        <Svg
          width="18"
          height="18"
          viewBox="0 0 14 14"
          style={{ color: "hsl(0,0%,50%)", marginRight: 10 }}
        >
          <Path
            fill="currentColor"
            d="M7.02799 0.333252C3.346 0.333252 0.361328 3.31792 0.361328 6.99992C0.361328 10.6819 3.346 13.6666 7.02799 13.6666C10.71 13.6666 13.6947 10.6819 13.6947 6.99992C13.6947 3.31792 10.7093 0.333252 7.02799 0.333252ZM10.166 9.19525L9.22333 10.1379L7.02799 7.94325L4.83266 10.1379L3.89 9.19525L6.08466 6.99992L3.88933 4.80459L4.832 3.86259L7.02733 6.05792L9.22266 3.86259L10.1653 4.80459L7.97066 6.99992L10.166 9.19525Z"
          />
        </Svg>
      </Pressable>
    )}
    <Text style={{ color: "hsl(0,0%,50%)" }}>{message}</Text>
  </View>
);

const ChannelMessagesScrollView = React.forwardRef(
  (
    {
      messages: messages_,
      onEndReached,
      getMember,
      onScroll,
      selectMessage,
      selectUser,
      focusedMessageId,
    },
    scrollViewRef
  ) => {
    const messages = React.useMemo(() => {
      const ms = messages_.map((m) => ({
        ...m,
        highlighted: focusedMessageId === m.id,
      }));
      return [...ms].reverse();
    }, [messages_, focusedMessageId]);

    const focusedMessageIndex = React.useMemo(() => {
      if (focusedMessageId == null) return -1;
      return messages.findIndex((m) => m.id === focusedMessageId);
    }, [focusedMessageId, messages]);

    React.useEffect(() => {
      if (focusedMessageIndex === -1) return;
      scrollViewRef.current.scrollToIndex({
        index: focusedMessageIndex,
        animated: true,
      });
    }, [focusedMessageIndex, scrollViewRef]);

    return (
      <FlashList
        ref={scrollViewRef}
        inverted
        data={messages}
        renderItem={({ item, index }) => (
          <Message
            message={item}
            previousMessage={messages[index + 1]}
            getMember={getMember}
            selectMessage={selectMessage}
            selectUser={selectUser}
            highlight={item.highlighted}
          />
        )}
        estimatedItemSize={120}
        onEndReached={onEndReached}
        onEndReachedThreshold={1}
        onScroll={onScroll}
        contentContainerStyle={{ paddingVertical: 10 }}
      />
    );
  }
);

const Message = ({
  message,
  previousMessage,
  getMember,
  selectMessage,
  selectUser,
  highlight,
}) => {
  const m = message;

  const createdAtDate = React.useMemo(
    () => new Date(message.created_at),
    [message.created_at]
  );

  const showSimplifiedMessage =
    !m.isReply &&
    previousMessage != null &&
    previousMessage.authorId === m.authorId &&
    createdAtDate - new Date(previousMessage.created_at) <
      5 * ONE_MINUTE_IN_MILLIS;

  const handlePressInteractiveMessageElement = (el) => {
    switch (el.type) {
      case "image-attachment":
        // TODO
        break;
      case "user":
        selectUser(el.ref);
        break;
      case "link":
        Linking.openURL(el.url);
        break;
      default:
        throw new Error();
    }
  };

  return (
    <Pressable
      unstable_pressDelay={50}
      delayLongPress={180}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        selectMessage(m.id);
      }}
      style={({ pressed }) => ({
        paddingHorizontal: 10,
        paddingTop: showSimplifiedMessage ? 0 : 12,
        paddingBottom: 8,
        backgroundColor: highlight
          ? "rgba(63,137,234,0.17)"
          : pressed
          ? "rgba(255, 255, 255, 0.055)"
          : undefined,
      })}
    >
      {message.isReply && (
        <RepliedMessage
          key={m.id}
          message={message.repliedMessage}
          getMember={getMember}
          onPressInteractiveMessageElement={
            handlePressInteractiveMessageElement
          }
        />
      )}

      <View
        style={{
          flexDirection: "row",
        }}
      >
        <View style={{ width: 38, marginRight: 12 }}>
          {m.isSystemMessage || m.isAppMessage ? (
            <View style={{ alignSelf: "center", paddingTop: 4 }}>
              <Svg
                height={18}
                width={18}
                style={{
                  width: 15,
                  color: m.isSystemMessage
                    ? "#e588f8"
                    : "hsl(139, 47.3%, 43.9%)",
                }}
              >
                <G fill="none" fillRule="evenodd">
                  <Path d="M18 0H0v18h18z" />
                  <Path
                    d="M0 8h14.2l-3.6-3.6L12 3l6 6-6 6-1.4-1.4 3.6-3.6H0"
                    fill="currentColor"
                  />
                </G>
              </Svg>
            </View>
          ) : showSimplifiedMessage ? null : (
            <View style={{ paddingTop: 2 }}>
              <Pressable
                hitSlop={10}
                onPress={() => {
                  selectUser(m.author.id);
                }}
              >
                <UserProfilePicture
                  transparent
                  user={message.author}
                  size={38}
                />
              </Pressable>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          {m.isSystemMessage ? null : m.isAppMessage ? null : showSimplifiedMessage ? null : (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-start",
                alignItems: "flex-end",
                marginBottom: 2,
              }}
            >
              <Pressable
                hitSlop={10}
                onPress={() => {
                  selectUser(m.author.id);
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    lineHeight: 20,
                    color: textDefault,
                    fontWeight: "600",
                    marginRight: 7,
                  }}
                >
                  {m.author?.display_name}
                </Text>
              </Pressable>
              <Text
                style={{
                  fontSize: 10.5,
                  lineHeight: 18,
                  color: "rgba(255,255,255,0.443)",
                }}
              >
                <FormattedDate
                  value={new Date(m.created_at)}
                  hour="numeric"
                  minute="numeric"
                  day="numeric"
                  month="short"
                  locale={locale}
                />
              </Text>
            </View>
          )}
          {m.isSystemMessage ? (
            <Text
              // selectable
              style={{ fontSize: 16, color: textDefault, lineHeight: 24 }}
            >
              <SystemMessageContent message={m} selectUser={selectUser} />
            </Text>
          ) : (
            <>
              <Text
                // selectable
                style={{ fontSize: 16, color: textDefault, lineHeight: 24 }}
              >
                <RichText
                  key={m.id}
                  blocks={m.content}
                  getMember={getMember}
                  onPressInteractiveElement={
                    handlePressInteractiveMessageElement
                  }
                  textStyle={{
                    fontSize: 16,
                    lineHeight: 24,
                    color: textDefault,
                  }}
                />
              </Text>

              {m.embeds?.length > 0 && <Embeds messageId={m.id} />}
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
};

const Embeds = React.memo(({ messageId }) => {
  const embeds = useMessageEmbeds(messageId);

  return (
    <View style={{ marginTop: 5 }}>
      {embeds.map((embed, i) => (
        <Embed key={embed.url} index={i} {...embed} />
      ))}
    </View>
  );
});

const Embed = ({
  title,
  description,
  sub,
  image,
  url,
  favicon,
  hostname,
  siteName,
  // video,
  // metatags,
  index,
}) => {
  const textStyles = { fontSize: 16, lineHeight: 24, color: textDefault };
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "stretch",
        marginTop: index === 0 ? 0 : 10,
      }}
    >
      <View
        style={{
          width: 4,
          backgroundColor: theme.colors.backgroundLighter,
          borderRadius: 2,
        }}
      />
      <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {favicon != null && (
            <Image
              source={{ uri: favicon }}
              style={{
                width: 16,
                height: 16,
                borderRadius: 2,
                marginRight: 8,
              }}
            />
          )}
          <Text style={textStyles} numberOfLines={1}>
            {title === siteName ? hostname : siteName}
          </Text>
        </View>
        <View style={{ flexDirection: "row" }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              onPress={() => {
                Linking.openURL(url);
              }}
              numberOfLines={1}
              style={{ ...textStyles, color: theme.colors.textBlue }}
            >
              {title}
            </Text>
            {description != null && (
              <Text numberOfLines={5} style={textStyles}>
                {description}
              </Text>
            )}
            {sub != null && (
              <Text
                numberOfLines={1}
                style={{
                  ...textStyles,
                  marginTop: 2,
                  fontSize: 10,
                  lineHeight: 16,
                  color: theme.colors.textDimmed,
                }}
              >
                {sub}
              </Text>
            )}
          </View>
          {image != null && (
            <View style={{ marginLeft: 10, paddingTop: 5 }}>
              <Image
                source={{ uri: image }}
                style={{
                  width: 50,
                  aspectRatio: 1,
                  borderRadius: 3,
                }}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const RepliedMessage = ({
  message,
  getMember,
  onPressInteractiveMessageElement,
}) => {
  const authorMember = message?.author;
  const showAvatar =
    (message != null || !message?.deleted) && authorMember?.profilePicture;

  const textStyles = {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textDimmed,
  };

  return (
    <View
      style={{
        position: "relative",
        paddingLeft: 50,
        marginBottom: 3,
      }}
    >
      <View
        style={{
          position: "absolute",
          right: "100%",
          top: "50%",
          paddingRight: 3,
          marginTop: -1,
        }}
      >
        <View
          style={{
            width: 29,
            height: 13,
            borderTopWidth: 2,
            borderLeftWidth: 2,
            borderColor: "hsl(0,0%,20%)",
            borderTopStartRadius: 4,
          }}
        />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {showAvatar && (
          <UserProfilePicture
            user={authorMember}
            size={18}
            style={{ marginRight: 5 }}
          />
        )}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={textStyles}>
            {message?.deleted ? (
              <Text
                style={{
                  fontStyle: "italic",
                  color: "rgba(255,255,255,0.3)",
                }}
              >
                Message deleted
              </Text>
            ) : (
              <>
                <Text style={{ fontWeight: "500" }}>
                  {authorMember == null ? "..." : authorMember.displayName}
                </Text>{" "}
                <RichText
                  inline
                  blocks={message?.content ?? []}
                  getMember={getMember}
                  onPressInteractiveElement={onPressInteractiveMessageElement}
                  textStyle={textStyles}
                />
              </>
            )}
          </Text>
        </View>
      </View>
    </View>
  );
};

const MemberDisplayName = ({ userId, selectUser }) => {
  const { state } = useAppScope();
  const user = state.selectUser(userId);
  return (
    <Text
      onPress={() => {
        selectUser(userId);
      }}
      style={{ color: textDefault, fontWeight: "600" }}
    >
      {user?.displayName}
    </Text>
  );
};

const SystemMessageContent = ({ message, selectUser }) => {
  const textStyles = {
    fontSize: 16,
    lineHeight: 24,
  };

  switch (message.type) {
    case "user-invited": {
      const isMissingData = [
        message.inviter?.displayName,
        message.author?.displayName,
      ].some((n) => n == null);

      return (
        <Text style={{ ...textStyles, opacity: isMissingData ? 0 : 1 }}>
          <MemberDisplayName
            userId={message.inviterUserId}
            selectUser={selectUser}
          />{" "}
          added{" "}
          <MemberDisplayName
            userId={message.authorUserId}
            selectUser={selectUser}
          />{" "}
          to the channel.
        </Text>
      );
    }

    case "member-joined": {
      const isMissingData = message.author?.displayName == null;
      return (
        <Text style={{ ...textStyles, opacity: isMissingData ? 0 : 1 }}>
          <MemberDisplayName
            userId={message.authorUserId}
            selectUser={selectUser}
          />{" "}
          joined the channel. Welcome!
        </Text>
      );
    }

    case "channel-updated": {
      const updates = Object.entries(message.updates);
      if (updates.length == 0 || updates.length > 1) {
        return (
          <>
            <MemberDisplayName
              userId={message.authorUserId}
              selectUser={selectUser}
            />{" "}
            updated the channel.
          </>
        );
      }

      let [field, value] = updates[0];

      // Nested switch case baby!
      switch (field) {
        case "description": {
          const newDescription = (value ?? "") === "" ? null : value;
          return (
            <>
              <MemberDisplayName
                userId={message.authorUserId}
                selectUser={selectUser}
              />{" "}
              {newDescription == null ? (
                "cleared the channel topic."
              ) : (
                <>set the channel topic: {newDescription}</>
              )}
            </>
          );
        }

        case "name": {
          const newName = (value ?? "") === "" ? null : value;
          return (
            <>
              <MemberDisplayName
                userId={message.authorUserId}
                selectUser={selectUser}
              />{" "}
              {newName == null ? (
                <>cleared the channel {field}.</>
              ) : (
                <>
                  set the channel {field}: {newName}
                </>
              )}
            </>
          );
        }

        default:
          return (
            <>
              <MemberDisplayName
                userId={message.authorUserId}
                selectUser={selectUser}
              />{" "}
              updated the channel {field}.
            </>
          );
      }
    }

    // case "app-installed": {
    //   const isMissingData = [
    //     message.installer?.displayName,
    //     message.app?.name,
    //   ].some((n) => n == null);

    //   return (
    //     <span
    //       css={(theme) =>
    //         css({
    //           color: theme.colors.channelDefault,
    //           opacity: isMissingData ? 0 : 1,
    //         })
    //       }
    //     >
    //       <MemberDisplayNameWithPopover user={message.installer} /> installed a
    //       new app:{" "}
    //       <InlineAppDisplayName displayName={message.app?.name ?? "..."} />
    //     </span>
    //   );
    // }

    default:
      return (
        <Text style={{ fontSize: 16, lineHeight: 24 }}>
          System message type {`"${message.type}"`}. Might implement thoon. No
          promises.
        </Text>
      );
    // throw new Error();
  }
};

const ChannelMessageInput = React.forwardRef(
  ({ pendingMessage, setPendingMessage, placeholder, onSubmit }, inputRef) => {
    const { actions } = useAppScope();
    // const containerWidthValue = React.useRef(new Animated.Value(0)).current;
    // const containerWidth = containerWidthValue.interpolate({
    //   inputRange: [0, 1],
    //   outputRange: [0, 54],
    // });

    // React.useEffect(() => {
    //   if (pendingMessage.trim() === "") {
    //     Animated.timing(containerWidthValue, {
    //       toValue: 0,
    //       duration: 120,
    //       useNativeDriver: false,
    //     }).start();
    //     return;
    //   }

    //   Animated.timing(containerWidthValue, {
    //     toValue: 1,
    //     duration: 180,
    //     useNativeDriver: false,
    //   }).start();
    // }, [pendingMessage, containerWidthValue]);

    const [images, setImages] = React.useState([]);

    const pickImage = async () => {
      // No permissions request is necessary for launching the image library
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        quality: 0.01,
        // mediaTypes: ImagePicker.MediaTypeOptions.All,
        // allowsEditing: true,
        // aspect: [4, 3],
      });

      if (result.canceled) return;

      console.log(result);

      const newImages = [
        ...images,
        ...result.assets
          // Remove duplicates
          .filter((a) => !images.some((i) => i.assetUrl === a.uri))
          .map((a) => ({
            assetUrl: a.uri,
            fileName: [a.assetId, a.fileName].join("."),
            width: a.width,
            height: a.height,
          })),
      ];

      setImages(newImages);

      const files = await Promise.all(
        newImages.map(async (i) => {
          const blob = await fetch(i.assetUrl).then((r) => r.blob());
          return { uri: i.assetUrl, type: blob.type, name: i.fileName };
        })
      );

      const uploadedFiles = await actions.uploadImage({ files });

      setImages((images) =>
        images.map((i) => {
          const uploadedFile = uploadedFiles.find((u) =>
            decodeURIComponent(u.filename).endsWith(i.fileName)
          );

          if (uploadedFile == null) return i;

          return { ...i, url: uploadedFile.urls.large };
        })
      );
    };

    const hasPendingImages = images.some((i) => i.url == null);
    const hasUploadedImages = images.length > 0 && !hasPendingImages;
    const hasPostableContent =
      pendingMessage.trim() !== "" || hasUploadedImages;
    const canSubmit = !hasPendingImages && hasPostableContent;

    return (
      <>
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 15,
            paddingVertical: 5,
            paddingBottom: 0,
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            borderTopWidth: 1,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: theme.colors.backgroundLighter,
            marginLeft: -1,
            marginRight: -1,
          }}
        >
          <TextInput
            ref={inputRef}
            value={pendingMessage}
            placeholder={placeholder}
            multiline
            onChangeText={setPendingMessage}
            placeholderTextColor="hsla(0,0%,100%,0.5)"
            keyboardAppearance="dark"
            inputAccessoryViewID="message-input"
            style={{
              flex: 1,
              fontSize: 16,
              color: textDefault,
              paddingTop: 11,
              paddingBottom: 11,
              lineHeight: 20,
              borderRadius: 12,
              // Prevent placeholder controling input height
              maxHeight: pendingMessage.trim() === "" ? 42 : undefined,
            }}
          />
        </View>
        <InputAccessoryView nativeID="message-input">
          {images.length !== 0 && (
            <ScrollView
              horizontal
              keyboardShouldPersistTaps="always"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ flexDirection: "row", padding: 10 }}
            >
              {images.map((image, i) => (
                <View
                  key={image.fileName}
                  style={{ position: "relative", marginLeft: i === 0 ? 0 : 10 }}
                >
                  <Image
                    source={{ uri: image.assetUrl }}
                    style={{
                      width: 70,
                      height: 70,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: theme.colors.backgroundLighter,
                    }}
                  />
                  {image.url == null && (
                    <View
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        width: "100%",
                        height: "100%",
                        borderRadius: 10,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "hsla(0,0%,0%,0.2)",
                      }}
                    >
                      <ActivityIndicator color="white" />
                    </View>
                  )}
                  <Pressable
                    hitSlop={10}
                    onPress={() => {
                      setImages((is) =>
                        is.filter((i) => i.assetUrl !== image.assetUrl)
                      );
                    }}
                    style={{
                      position: "absolute",
                      right: -11,
                      top: -11,
                      backgroundColor: theme.colors.background,
                      padding: 2,
                      borderRadius: 11,
                    }}
                  >
                    <CrossCircleIcon
                      width="20"
                      height="20"
                      style={{
                        color: theme.colors.textDefault,
                      }}
                    />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
          <View
            style={{
              flexDirection: "row",
              padding: 10,
              paddingVertical: 8,
              paddingTop: 0,
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                paddingHorizontal: 5,
                alignItems: "center",
                justifyContent: "flex-start",
              }}
            >
              <Pressable
                hitSlop={5}
                style={{ marginRight: 15 }}
                onPress={() => {
                  // setPendingMessage((m) => m + "🥓");
                  pickImage();
                }}
              >
                <EmojiIcon
                  width="22"
                  height="22"
                  style={{ color: theme.colors.textDefault }}
                />
              </Pressable>
              <Pressable
                style={({ pressed }) => ({
                  backgroundColor: pressed
                    ? theme.colors.backgroundLight
                    : undefined,
                  borderColor: theme.colors.textMuted,
                  borderWidth: 1.5,
                  paddingVertical: 3,
                  paddingHorizontal: 4.5,
                  borderRadius: 5,
                })}
                onPress={async () => {
                  const response = await actions.searchGifs(pendingMessage);
                  const imageUrl =
                    response[Math.floor(Math.random() * response.length)].src;

                  Image.getSize(imageUrl, (width, height) => {
                    onSubmit(null, {
                      images: [{ url: imageUrl, width, height }],
                    });
                  });
                }}
              >
                <Text
                  style={{
                    color: theme.colors.textDefault,
                    fontSize: 12,
                    fontWeight: "700",
                    letterSpacing: 0.5,
                    lineHeight: 17,
                  }}
                >
                  GIF
                </Text>
              </Pressable>
            </View>
            <View>
              <Pressable
                onPressIn={() => {
                  inputRef.current.focus();
                }}
                onPress={() => {
                  onSubmit(pendingMessage, { images });
                  setPendingMessage("");
                  setImages([]);
                }}
                disabled={!canSubmit}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: canSubmit ? "#007ab3" : "transparent", // BLUE,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  style={{
                    position: "relative",
                    left: 2,
                    color: canSubmit ? "white" : "hsl(0,0%,26%)",
                  }}
                >
                  <Path
                    fill="currentColor"
                    stroke="currentColor"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M2.25 2.25 17.75 10l-15.5 7.75v-4.539a1.5 1.5 0 0 1 1.46-1.5l6.54-.171a1.54 1.54 0 0 0 0-3.08l-6.54-.172a1.5 1.5 0 0 1-1.46-1.5V2.25Z"
                  />
                </Svg>
              </Pressable>
            </View>
          </View>
        </InputAccessoryView>
      </>
    );
  }
);

export default Channel;
