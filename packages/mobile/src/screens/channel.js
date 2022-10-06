import Constants from "expo-constants";
import React from "react";
import {
  Text,
  View,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Pressable,
  Animated,
  InputAccessoryView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { SvgXml, G, Path } from "react-native-svg";
import { FlashList } from "@shopify/flash-list";
import { useEnsAvatar } from "wagmi";
import * as Shades from "@shades/common";
import * as Localization from "expo-localization";
import FormattedDate from "../components/formatted-date";
import RichText from "../components/rich-text";

const CLOUDFLARE_ACCOUNT_HASH =
  Constants.expoConfig.extra.cloudflareAccountHash;

const { useLatestCallback } = Shades.react;
const { useAppScope } = Shades.app;
const { generatePlaceholderAvatarSvgString } = Shades.nouns;

// Region might return `null` on Android
const locale = ["en", Localization.region].filter(Boolean).join("-");

const usePlaceholderAvatarSvg = (walletAddress, { enabled = true } = {}) => {
  const [generatedPlaceholderAvatar, setGeneratedPlaceholderAvatar] =
    React.useState(null);

  React.useEffect(() => {
    if (!enabled || walletAddress == null) return;
    generatePlaceholderAvatarSvgString(walletAddress).then((url) => {
      setGeneratedPlaceholderAvatar(url);
    });
  }, [enabled, walletAddress]);

  return generatedPlaceholderAvatar;
};

const useChannelMessages = ({ channelId }) => {
  const { actions, state } = useAppScope();

  const messages = state.selectChannelMessages(channelId);

  React.useEffect(() => {
    actions.fetchMessages(channelId);
  }, [actions, channelId]);

  const sortedMessages = messages.sort(
    (m1, m2) => new Date(m1.created_at) - new Date(m2.created_at)
  );

  return sortedMessages;
};

const Channel = ({ route: { params } }) => {
  const { channelId } = params;
  const { state, actions } = useAppScope();
  const { fetchChannelMembers, fetchChannelPublicPermissions, fetchMessages } =
    actions;

  const channel = state.selectChannel(params.channelId);

  const messages = useChannelMessages({ channelId });

  React.useEffect(() => {
    fetchChannelMembers(channelId);
    fetchChannelPublicPermissions(channelId);
  }, [channelId, fetchChannelMembers, fetchChannelPublicPermissions]);

  const fetchMoreMessages = useLatestCallback(() => {
    if (messages.length === 0) return;
    return fetchMessages(channel.id, {
      beforeMessageId: messages[0].id,
      limit: 30,
    });
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "rgb(25,25,25)" }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ChannelHeader title={channel.name} />
        <ChannelMessagesScrollView
          messages={messages}
          onEndReached={fetchMoreMessages}
          getMember={state.selectUser}
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

const ChannelHeader = ({ title }) => (
  <View style={{ paddingHorizontal: 16, paddingVertical: 18 }}>
    <Text style={{ color: "white", fontSize: 18, fontWeight: "600" }}>
      <Text style={{ color: "rgba(255,255,255,0.3)" }}>#</Text> {title}
    </Text>
  </View>
);

const ChannelMessagesScrollView = ({
  messages: messages_,
  onEndReached,
  getMember,
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
      renderItem={({ item }) => (
        <Message message={item} getMember={getMember} />
      )}
      estimatedItemSize={120}
      onEndReached={onEndReached}
      onEndReachedThreshold={1}
    />
  );
};

const useProfilePicture = (user) => {
  const customUrl =
    user == null
      ? null
      : user.profilePicture.cloudflareId == null
      ? user.profilePicture.small
      : `https://imagedelivery.net/${CLOUDFLARE_ACCOUNT_HASH}/${user.profilePicture.cloudflareId}/avatar`;

  const { data: ensAvatarUrl, isLoading: isLoadingEnsAvatar } = useEnsAvatar({
    addressOrName: user?.walletAddress,
    enabled: customUrl == null && user?.walletAddress != null,
  });

  const placeholderSvgString = usePlaceholderAvatarSvg(user?.walletAddress, {
    enabled:
      customUrl == null && !isLoadingEnsAvatar && user?.walletAddress != null,
  });

  const avatarUrl = customUrl ?? ensAvatarUrl;

  const type =
    avatarUrl != null
      ? "url"
      : placeholderSvgString != null
      ? "svg-string"
      : null;

  switch (type) {
    case "url":
      return { type, url: avatarUrl };
    case "svg-string":
      return { type, string: placeholderSvgString };
    default:
      return null;
  }
};

const Message = ({ message: m, getMember }) => {
  const profilePicture = useProfilePicture(m.author);

  return (
    <View
      style={{
        flexDirection: "row",
        paddingHorizontal: 10,
        paddingVertical: 10,
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
        ) : (
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
        {m.isSystemMessage ? null : m.isAppMessage ? null : (
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
          selectable
          style={{ fontSize: 16, color: "white", lineHeight: 24 }}
        >
          {m.isSystemMessage ? (
            <SystemMessageContent message={m} />
          ) : (
            <RichText key={m.id} blocks={m.content} getMember={getMember} />
          )}
        </Text>
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
