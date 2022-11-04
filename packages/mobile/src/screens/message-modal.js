import { View } from "react-native";
import * as Shades from "@shades/common";
import { SectionedActionList } from "./account-modal";

const { useAppScope } = Shades.app;

const textDanger = "#de554f";

const MessageModal = ({ messageId, startEdit, startReply, deleteMessage }) => {
  const { state } = useAppScope();
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
      ].filter(Boolean),
    },
    {
      items: [
        isOwnMessage && {
          key: "delete-message",
          label: "Delete message",
          onPress: deleteMessage,
          textColor: textDanger,
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
