import React from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { SvgXml, G, Path } from "react-native-svg";
import * as Shades from "@shades/common";
import * as Localization from "expo-localization";
import FormattedDate from "../components/formatted-date";

const { useAppScope } = Shades.app;
const { stringifyBlocks } = Shades.utils.message;
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
  const { fetchChannelMembers, fetchChannelPublicPermissions } = actions;

  const channel = state.selectChannel(params.channelId);

  const messages = useChannelMessages({ channelId });

  React.useEffect(() => {
    fetchChannelMembers(channelId);
    fetchChannelPublicPermissions(channelId);
  }, [channelId, fetchChannelMembers, fetchChannelPublicPermissions]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "hsl(0, 0%, 8%)" }}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ChannelHeader title={channel.name} />
        <ChannelMessagesScrollView messages={messages} />
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
  <View
    style={{
      paddingHorizontal: 16,
      paddingVertical: 18,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: "rgba(0,0,0,0.8)",
    }}
  >
    <Text style={{ color: "white", fontSize: 18, fontWeight: "600" }}>
      <Text style={{ color: "rgba(255,255,255,0.3)" }}>#</Text> {title}
    </Text>
  </View>
);

const ChannelMessagesScrollView = ({ messages }) => {
  const scrollViewRef = React.useRef();

  const lastMessage = messages.slice(-1)[0];

  React.useEffect(() => {
    if (lastMessage == null) return;
    // Broken way of scrolling down when switching between channels
    scrollViewRef.current.scrollToEnd({ animated: false });
  }, [lastMessage]);

  return (
    <ScrollView
      ref={scrollViewRef}
      style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.02)" }}
      contentContainerStyle={{ justifyContent: "flex-end" }}
    >
      {messages.map((m) => (
        <Message key={m.id} message={m} />
      ))}
    </ScrollView>
  );
};

const Message = ({ message: m }) => {
  const avatarSvgString = usePlaceholderAvatarSvg(m.author?.walletAddress, {
    enabled: m.author?.walletAddress != null,
  });

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
              {avatarSvgString != null && (
                <SvgXml xml={avatarSvgString} width="100%" height="100%" />
              )}
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
                lineHeight: 16,
                color: "rgba(255,255,255,0.443)",
              }}
            >
              <FormattedDate value={new Date(m.created_at)} locale={locale} />
            </Text>
          </View>
        )}
        <Text
          selectable
          style={{ fontSize: 16, color: "white", lineHeight: 24 }}
        >
          {m.isSystemMessage ? (
            <SystemMessageContent message={m} />
          ) : m.isAppMessage ? (
            "App message"
          ) : (
            stringifyBlocks(m.content)
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
      return null;
    // throw new Error();
  }
};

const ChannelMessageInput = ({ placeholder, onSubmit }) => {
  const inputRef = React.useRef();
  return (
    <View style={{ padding: 10 }}>
      <TextInput
        ref={inputRef}
        placeholder={placeholder}
        blurOnSubmit
        returnKeyType="send"
        onSubmitEditing={(e) => {
          const content = e.nativeEvent.text;
          inputRef.current.clear();
          onSubmit(content);
        }}
        placeholderTextColor="hsla(0,0%,100%,0.5)"
        keyboardAppearance="dark"
        style={{
          fontSize: 16,
          color: "white",
          backgroundColor: "hsla(0,0%,100%,0.05)",
          paddingHorizontal: 20,
          paddingVertical: 15,
          borderRadius: 26,
        }}
      />
    </View>
  );
};

export default Channel;
