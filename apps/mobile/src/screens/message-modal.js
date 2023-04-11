import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { View, Alert, Pressable, Text, Dimensions } from "react-native";
import * as Shades from "@shades/common";
import { SectionedActionList } from "./account-modal";
import { AddEmojiReaction as AddEmojiReactionIcon } from "../components/icons";
import theme from "../theme";

const { useActions, useMe, useMessage, useRecentEmojis } = Shades.app;
const { message: messageUtils } = Shades.utils;

const hapticImpactLight = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

const windowWidth = Dimensions.get("window").width;

const emojiColumnCount = 6;
const emojiColumnGutter = 7;
const emojiSize = (windowWidth - 32) / emojiColumnCount - emojiColumnGutter;

const MessageModal = ({
  dismiss,
  messageId,
  startEdit,
  startReply,
  showEmojiPicker,
  deleteMessage,
}) => {
  const actions = useActions();
  const me = useMe();
  const message = useMessage(messageId);

  const recentEmojis = useRecentEmojis();

  const addReaction = (emoji) =>
    actions.addMessageReaction(messageId, { emoji });

  if (message == null) return null;

  const isOwnMessage = me.id === message.authorId;

  const actionSections = [
    {
      items: [
        isOwnMessage && {
          key: "edit-message",
          label: "Edit message",
          onPress: startEdit,
        },
        { key: "reply", label: "Reply", onPress: startReply },
        !message.isSystemMessage && {
          key: "copy-text",
          label: "Copy text",
          onPress: async () => {
            await Clipboard.setStringAsync(
              messageUtils.stringifyBlocks(message.blocks)
            );
            dismiss();
          },
        },
      ].filter(Boolean),
    },
    {
      items: [
        isOwnMessage
          ? {
              key: "delete-message",
              label: "Delete message",
              onPress: deleteMessage,
              danger: true,
            }
          : message.type === "regular" && {
              key: "report-message",
              label: "Report message",
              danger: true,
              onPress: () => {
                Alert.prompt(
                  "Report message",
                  "(Optional comment)",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Report",
                      style: "destructive",
                      onPress: async (comment) => {
                        try {
                          await actions.reportMessage(messageId, { comment });
                          dismiss();
                        } catch (e) {
                          e.response?.json().then((json) => {
                            Alert.alert(
                              "Error",
                              json?.detail ?? "Something went wrong"
                            );
                          });
                        }
                      },
                    },
                  ],
                  "plain-text"
                );
              },
            },
      ].filter(Boolean),
    },
  ].filter((s) => s.items.length > 0);

  return (
    <View
      style={{
        backgroundColor: "hsl(0,0%,10%)",
        flex: 1,
        paddingHorizontal: 16,
        paddingBottom: 20,
      }}
    >
      <View
        style={{
          alignSelf: "center",
          width: 38,
          height: 5,
          borderRadius: 2.5,
          backgroundColor: "hsl(0,0%,32%)",
          marginTop: 4,
          marginBottom: 14,
        }}
      />

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        {recentEmojis.slice(0, emojiColumnCount - 1).map((emoji) => (
          <Pressable
            key={emoji}
            onPress={() => {
              hapticImpactLight();
              addReaction(emoji);
              dismiss();
            }}
            style={({ pressed }) => ({
              width: emojiSize,
              height: emojiSize,
              borderRadius: emojiSize / 2,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed
                ? theme.colors.backgroundLighter
                : theme.colors.backgroundLight,
            })}
          >
            <Text style={{ fontSize: 25, lineHeight: 30 }}>{emoji}</Text>
          </Pressable>
        ))}

        <Pressable
          onPress={() => {
            dismiss();
            hapticImpactLight();
            showEmojiPicker();
          }}
          style={({ pressed }) => ({
            width: emojiSize,
            height: emojiSize,
            borderRadius: emojiSize / 2,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed
              ? theme.colors.backgroundLighter
              : theme.colors.backgroundLight,
          })}
        >
          <AddEmojiReactionIcon
            width="24"
            height="24"
            style={{ color: theme.colors.textDefault }}
          />
        </Pressable>
      </View>

      <SectionedActionList items={actionSections} />
    </View>
  );
};

export default MessageModal;
