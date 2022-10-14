import React from "react";
import { View } from "react-native";
import * as Shades from "@shades/common";
import { ModalActionButtonGroup } from "./account-modal";

const { useAppScope } = Shades.app;

const textDanger = "#de554f";

const MessageModal = ({ messageId, startEdit, startReply, deleteMessage }) => {
  const { state } = useAppScope();
  const me = state.selectMe();
  const message = state.selectMessage(messageId);

  if (message == null) return null;

  const isOwnMessage = me.id === message.authorId;

  const actionSections = [
    [
      isOwnMessage && { label: "Edit message", onPress: startEdit },
      { label: "Reply", onPress: startReply },
    ].filter(Boolean),
    [
      isOwnMessage && {
        label: "Delete message",
        onPress: deleteMessage,
        textColor: textDanger,
      },
    ].filter(Boolean),
  ].filter((as) => as.length > 0);

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

      {actionSections.map((actions, i) => (
        <React.Fragment key={i}>
          {i !== 0 && <View style={{ height: 20 }} />}
          <ModalActionButtonGroup actions={actions} />
        </React.Fragment>
      ))}
    </View>
  );
};

export default MessageModal;
