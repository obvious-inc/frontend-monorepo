import * as Haptics from "expo-haptics";
import React from "react";
import {
  Text,
  View,
  TextInput,
  KeyboardAvoidingView,
  Pressable,
  InputAccessoryView,
  Modal,
  AppState,
  Alert,
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
import FormattedDate from "../components/formatted-date";
import RichText from "../components/rich-text";
import { ChannelPicture, UserProfilePicture } from "./channel-list";
import MessageModalContent from "./message-modal";

const { useLatestCallback } = Shades.react;
const { useAppScope } = Shades.app;
const { message: messageUtils } = Shades.utils;

const ONE_MINUTE_IN_MILLIS = 1000 * 60;

const background = "hsl(0,0%,10%)";
const textDefault = "hsl(0,0%,83%)";

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
  // fullScreenGestureEnabled: true,
};

// Region might return `null` on Android
const locale = ["en", Localization.region].filter(Boolean).join("-");

const useChannelMessages = ({ channelId }) => {
  const { actions, state } = useAppScope();
  const { fetchMessages } = actions;

  const messages = state.selectChannelMessages(channelId);

  // React.useEffect(() => {
  //   actions.fetchMessages(channelId);
  // }, [actions, channelId]);
  useFocusEffect(
    React.useCallback(() => {
      fetchMessages(channelId);
    }, [channelId, fetchMessages])
  );

  const sortedMessages = messages.sort(
    (m1, m2) => new Date(m1.created_at) - new Date(m2.created_at)
  );

  return sortedMessages;
};

// const DefaultStackHeader = () => {
//   return (
//     <SafeAreaView edges={["top"]} style={{ backgroundColor: background }}>
//       <View
//         style={{
//           height: 48,
//           flexDirection: "row",
//           alignItems: "center",
//         }}
//       >
//         <HeaderLeft />
//       </View>
//     </SafeAreaView>
//   );
// };

const HeaderLeft = () => {
  const { params } = useRoute();
  const navigation = useNavigation();
  const { state } = useAppScope();
  const channel = state.selectChannel(params.channelId);
  const memberCount = channel.memberUserIds.length;

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
      <Pressable
        onPress={() => {
          navigation.navigate("Channel details modal", {
            channelId: params.channelId,
          });
        }}
        style={{ flexDirection: "row", alignItems: "center" }}
      >
        {({ pressed }) => (
          <>
            {(channel.kind === "dm" || channel.avatar != null) && (
              <View style={{ marginRight: 10 }}>
                <ChannelPicture
                  transparent
                  channelId={params.channelId}
                  size={32}
                />
              </View>
            )}
            <View>
              <Text
                style={{
                  color: pressed ? "hsl(0,0%,50%)" : "white",
                  fontSize: 16,
                  fontWeight: "600",
                  lineHeight: 18,
                }}
              >
                {channel.name}
              </Text>
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
            </View>
          </>
        )}
      </Pressable>
    </View>
  );
};

const Channel = ({ navigation, route: { params } }) => {
  const [pendingMessage, setPendingMessage] = React.useState("");

  const [selectedMessageId, setSelectedMessageId] = React.useState(null);
  const [editingMessageId, setEditingMessageId] = React.useState(null);
  const [replyTargetMessageId, setReplyTargetMessageId] = React.useState(null);

  const { channelId } = params;
  const { state, actions } = useAppScope();
  const {
    fetchChannelMembers,
    fetchChannelPublicPermissions,
    fetchMessages,
    markChannelRead,
  } = actions;

  const channel = state.selectChannel(params.channelId);

  const messages = useChannelMessages({ channelId });
  const headerHeight = useHeaderHeight();

  const inputRef = React.useRef();
  const scrollViewRef = React.useRef();

  useFocusEffect(
    React.useCallback(() => {
      fetchChannelMembers(channelId);
      fetchChannelPublicPermissions(channelId);
    }, [channelId, fetchChannelMembers, fetchChannelPublicPermissions])
  );

  const didScrollToBottomRef = React.useRef(true);

  const fetchMoreMessages = useLatestCallback(() => {
    if (messages.length === 0) return;
    return fetchMessages(channel.id, {
      beforeMessageId: messages[0].id,
      limit: 30,
    });
  });

  const channelHasUnread = state.selectChannelHasUnread(channel.id);
  const hasFetchedChannelMessagesAtLeastOnce = state.selectHasFetchedMessages(
    channel.id
  );

  // Mark channel as read when new messages arrive
  React.useEffect(() => {
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

    markChannelRead(channel.id);
  }, [
    channel.id,
    channelHasUnread,
    hasFetchedChannelMessagesAtLeastOnce,
    didScrollToBottomRef,
    markChannelRead,
  ]);

  const handleScrolledToBottom = () => {
    if (AppState.currentState !== "active" || !channelHasUnread) return;
    markChannelRead(channel.id);
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
            placeholder={`Message #${channel.name}`}
            pendingMessage={pendingMessage}
            setPendingMessage={setPendingMessage}
            onSubmit={(content) => {
              if (editingMessageId != null) {
                setEditingMessageId(null);
                inputRef.current.blur();
                return actions.updateMessage(editingMessageId, { content });
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
                  content,
                });
              }

              return actions.createMessage({
                channel: channelId,
                content,
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
          <Text
            // selectable
            style={{ fontSize: 16, color: textDefault, lineHeight: 24 }}
          >
            {m.isSystemMessage ? (
              <SystemMessageContent message={m} />
            ) : (
              <RichText
                key={m.id}
                blocks={m.content}
                getMember={getMember}
                onPressInteractiveElement={handlePressInteractiveMessageElement}
                textStyle={{
                  fontSize: 16,
                  lineHeight: 24,
                  color: textDefault,
                }}
              />
            )}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const RepliedMessage = ({ message, getMember }) => {
  const authorMember = message?.author;
  const showAvatar =
    (message != null || !message?.deleted) && authorMember?.profilePicture;

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
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{ fontSize: 13, color: "hsl(0,0%,50%)" }}
          >
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
                {authorMember == null ? (
                  <Text style={{ fontWeight: "500" }}>...</Text>
                ) : (
                  <Text style={{ fontWeight: "500" }}>
                    {authorMember.displayName}
                  </Text>
                )}{" "}
                <Text style={{ color: "hsl(0,0%,50%)" }}>
                  <RichText
                    inline
                    blocks={message?.content ?? []}
                    getMember={getMember}
                  />
                </Text>
              </>
            )}
          </Text>
        </View>
      </View>
    </View>
  );
};

const SystemMessageContent = ({ message }) => {
  switch (message.type) {
    // case "user-invited": {
    //   const isMissingData = [
    //     message.inviter?.displayName,
    //     message.author?.displayName,
    //   ].some((n) => n == null);

    //   return (
    //     <Text style={{ opacity: isMissingData ? 0 : 1 }}>
    //       <MemberDisplayNameWithPopover user={message.inviter} /> added{" "}
    //       <MemberDisplayNameWithPopover user={message.author} /> to the channel.
    //     </Text>
    //   );
    // }

    case "member-joined": {
      const isMissingData = message.author?.displayName == null;
      return (
        <Text
          style={{
            fontSize: 16,
            lineHeight: 24,
            opacity: isMissingData ? 0 : 1,
          }}
        >
          {/* <MemberDisplayNameWithPopover user={message.author} /> */}
          <Text style={{ fontWeight: "600" }}>
            {message.author?.displayName}
          </Text>{" "}
          joined the channel. Welcome!
        </Text>
      );
    }

    //     case "channel-updated": {
    //       const updates = Object.entries(message.updates);
    //       if (updates.length == 0 || updates.length > 1) {
    //         return (
    //           <>
    //             <MemberDisplayNameWithPopover user={message.author} /> updated the
    //             channel.
    //           </>
    //         );
    //       }

    //       let [field, value] = updates[0];

    //       // Nested switch case baby!
    //       switch (field) {
    //         case "description":
    //           return (
    //             <>
    //               <MemberDisplayNameWithPopover user={message.author} />{" "}
    //               {(value ?? "") === "" ? (
    //                 "cleared the channel topic."
    //               ) : (
    //                 <>set the channel topic: {value}</>
    //               )}
    //             </>
    //           );
    //         case "name":
    //           return (
    //             <>
    //               <MemberDisplayNameWithPopover user={message.author} />{" "}
    //               {(value ?? "") === "" ? (
    //                 <>cleared the channel {field}.</>
    //               ) : (
    //                 <>
    //                   set the channel {field}: {value}
    //                 </>
    //               )}
    //             </>
    //           );
    //         default:
    //           return (
    //             <>
    //               <MemberDisplayNameWithPopover user={message.author} /> updated the
    //               channel {field}.
    //             </>
    //           );
    //       }
    //     }

    //     case "app-installed": {
    //       const isMissingData = [
    //         message.installer?.displayName,
    //         message.app?.name,
    //       ].some((n) => n == null);

    //       return (
    //         <span
    //           css={(theme) =>
    //             css({
    //               color: theme.colors.channelDefault,
    //               opacity: isMissingData ? 0 : 1,
    //             })
    //           }
    //         >
    //           <MemberDisplayNameWithPopover user={message.installer} /> installed a
    //           new app:{" "}
    //           <InlineAppDisplayName displayName={message.app?.name ?? "..."} />
    //         </span>
    //       );
    //     }

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

    const canSubmit = pendingMessage.trim() !== "";

    return (
      <>
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 10,
            paddingVertical: 8,
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
              backgroundColor: "hsl(0,0%,14%)",
              paddingHorizontal: 16,
              paddingTop: 11,
              paddingBottom: 11,
              lineHeight: 20,
              borderRadius: 12,
            }}
          />
        </View>
        <InputAccessoryView nativeID="message-input">
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
            <View style={{ flex: 1, paddingHorizontal: 10 }}>
              <Text style={{ color: "hsl(0,0%,44%)" }}>
                Insanely rich toolbar coming soon
              </Text>
            </View>
            <View>
              <Pressable
                onPressIn={() => {
                  inputRef.current.focus();
                }}
                onPress={() => {
                  onSubmit(pendingMessage);
                  setPendingMessage("");
                }}
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
