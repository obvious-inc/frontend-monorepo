import * as Clipboard from "expo-clipboard";
import { View, Alert } from "react-native";
import * as Shades from "@shades/common";
import { SectionedActionList } from "./account-modal";

const { useAppScope } = Shades.app;
const { message: messageUtils } = Shades.utils;

const MessageModal = ({
  dismiss,
  messageId,
  startEdit,
  startReply,
  deleteMessage,
}) => {
  const { state, actions } = useAppScope();
  const me = state.selectMe();
  const message = state.selectMessage(messageId);

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

      <SectionedActionList items={actionSections} />
    </View>
  );
};

export default MessageModal;
