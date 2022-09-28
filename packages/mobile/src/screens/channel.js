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
import { useAppScope } from "@shades/common";
import * as Localization from "expo-localization";
import FormattedDate from "../components/formatted-date";

// Region might return `null` on Android
const locale = ["en", Localization.region].filter(Boolean).join("-");

const useChannelMessages = ({ channelId }) => {
  const { actions, state } = useAppScope();

  const messages = state.selectChannelMessages(channelId);

  React.useEffect(() => {
    actions.fetchMessages({ channelId });
  }, [actions, channelId]);

  const sortedMessages = messages.sort(
    (m1, m2) => new Date(m1.created_at) - new Date(m2.created_at)
  );

  return sortedMessages;
};

const Channel = ({ route: { params } }) => {
  const { channelId } = params;
  const { state, actions } = useAppScope();

  const channel = state.selectChannel(params.channelId);

  const messages = useChannelMessages({ channelId });

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
    <Text style={{ color: "white", fontSize: 15, fontWeight: "500" }}>
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
        <View
          key={m.id}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 14,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-start",
              alignItems: "flex-end",
              marginBottom: 6,
            }}
          >
            <Text
              style={{
                lineHeight: 14,
                color: "#e588f8",
                fontWeight: "500",
                marginRight: 12,
              }}
            >
              {m.author.display_name}
            </Text>
            <Text
              style={{
                fontSize: 11,
                lineHeight: 15,
                color: "rgba(255,255,255,0.3)",
              }}
            >
              <FormattedDate value={new Date(m.created_at)} locale={locale} />
            </Text>
          </View>
          <Text selectable style={{ color: "white", lineHeight: 22 }}>
            {m.content}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
};

const ChannelMessageInput = ({ placeholder, onSubmit }) => {
  const inputRef = React.useRef();
  return (
    <View
      style={{
        padding: 16,
        backgroundColor: "rgba(255,255,255,0.03)",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "rgba(0,0,0,0.8)",
      }}
    >
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
          color: "white",
          backgroundColor: "hsla(0,0%,100%,0.065)",
          padding: 16,
          borderRadius: 30,
        }}
      />
    </View>
  );
};

export default Channel;
