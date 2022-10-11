import * as Haptics from "expo-haptics";
import React from "react";
import {
  Text,
  View,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Pressable,
  InputAccessoryView,
  Alert,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useFocusEffect,
  useRoute,
  useNavigation,
} from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import Svg, { SvgXml, G, Path } from "react-native-svg";
import { FlashList } from "@shopify/flash-list";
import * as Shades from "@shades/common";
import * as Localization from "expo-localization";
import useProfilePicture from "../hooks/profile-picture";
import FormattedDate from "../components/formatted-date";
import RichText from "../components/rich-text";
import { ChannelPicture } from "./channel-list";

const handleUnimplementedPress = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  Alert.alert("THOON");
};

const { useLatestCallback } = Shades.react;
const { useAppScope } = Shades.app;

const ONE_MINUTE_IN_MILLIS = 1000 * 60;

const background = "hsl(0,0%,10%)";

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
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {(channel.kind === "dm" || channel.avatar != null) && (
          <View style={{ marginRight: 10 }}>
            <ChannelPicture channelId={params.channelId} size={32} />
          </View>
        )}
        <View>
          <Text
            style={{
              color: "white",
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
      </View>
    </View>
  );
};

const Channel = ({ route: { params } }) => {
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

  return (
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
          messages={messages}
          onEndReached={fetchMoreMessages}
          getMember={state.selectUser}
          onScroll={(e) => {
            const isAtBottom = e.nativeEvent.contentOffset.y === 0;
            didScrollToBottomRef.current = isAtBottom;

            if (isAtBottom) handleScrolledToBottom();
          }}
        />
        <ChannelMessageInput
          placeholder={`Message #${channel.name}`}
          onSubmit={(content) =>
            actions.createMessage({
              channel: channelId,
              content,
            })
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const ChannelMessagesScrollView = ({
  messages: messages_,
  onEndReached,
  getMember,
  onScroll,
}) => {
  const scrollViewRef = React.useRef();

  const messages = React.useMemo(() => {
    return [...messages_].reverse();
  }, [messages_]);

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
        />
      )}
      estimatedItemSize={120}
      onEndReached={onEndReached}
      onEndReachedThreshold={1}
      onScroll={onScroll}
    />
  );
};

const Message = ({ message, previousMessage, getMember }) => {
  const profilePicture = useProfilePicture(message.author);
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

  return (
    <Pressable
      unstable_pressDelay={50}
      delayLongPress={180}
      onLongPress={handleUnimplementedPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        paddingHorizontal: 10,
        paddingVertical: 10,
        paddingTop: showSimplifiedMessage ? 0 : undefined,
        backgroundColor: pressed ? "rgba(255, 255, 255, 0.055)" : undefined,
      })}
    >
      <View style={{ width: 38, marginRight: 12 }}>
        {m.isSystemMessage || m.isAppMessage ? (
          <View style={{ alignSelf: "center", paddingTop: 4 }}>
            <Svg
              height={18}
              width={18}
              style={{
                width: 15,
                color: m.isSystemMessage ? "#e588f8" : "hsl(139, 47.3%, 43.9%)",
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
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: "rgba(255, 255, 255, 0.055)",
                overflow: "hidden",
              }}
            >
              {profilePicture?.type === "url" ? (
                <Image
                  source={{ uri: profilePicture.url }}
                  style={{ width: "100%", height: "100%" }}
                />
              ) : profilePicture?.type === "svg-string" ? (
                <SvgXml
                  xml={profilePicture.string}
                  width="100%"
                  height="100%"
                />
              ) : null}
            </View>
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
            <Text
              style={{
                fontSize: 16,
                lineHeight: 20,
                color: "white",
                fontWeight: "600",
                marginRight: 7,
              }}
            >
              {m.author?.display_name}
            </Text>
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
          style={{ fontSize: 16, color: "white", lineHeight: 24 }}
        >
          {m.isSystemMessage ? (
            <SystemMessageContent message={m} />
          ) : (
            <RichText key={m.id} blocks={m.content} getMember={getMember} />
          )}
        </Text>
      </View>
    </Pressable>
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

const ChannelMessageInput = ({ placeholder, onSubmit }) => {
  const inputRef = React.useRef();
  const [pendingMessage, setPendingMessage] = React.useState("");

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
            color: "white",
            backgroundColor: "hsla(0,0%,100%,0.05)",
            paddingHorizontal: 16,
            paddingTop: 11,
            paddingBottom: 11,
            lineHeight: 20,
            borderRadius: 22,
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
};

export default Channel;
