import React from "react";
import { View } from "react-native";
import * as Shades from "@shades/common";
import { ModalActionButton } from "./account-modal";

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
      isOwnMessage && { label: "Edit message", run: startEdit },
      { label: "Reply", run: startReply },
    ].filter(Boolean),
    [
      isOwnMessage && {
        label: "Delete message",
        run: deleteMessage,
        danger: true,
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

      {actionSections.map((actions, i) => {
        const isFirstSection = i === 0;

        return actions.map((a, i, as) => {
          const isFirst = i === 0;
          const isLast = i === as.length - 1;
          const radius = 12;
          return (
            <React.Fragment key={[a.label, i].join(":")}>
              {!isFirstSection && (
                <View
                  style={{
                    height: 1,
                    background: "hsl(0,0%,12%)",
                    marginVertical: 10,
                  }}
                />
              )}
              <ModalActionButton
                label={a.label}
                onPress={a.run}
                textColor={a.danger ? textDanger : undefined}
                style={({ pressed }) => {
                  const style = {
                    backgroundColor: pressed
                      ? "hsl(0,0%,14%)"
                      : "hsl(0,0%,12%)",
                    borderRadius: 0,
                  };
                  if (isFirst) {
                    style.borderTopLeftRadius = radius;
                    style.borderTopRightRadius = radius;
                  }
                  if (isLast) {
                    style.borderBottomLeftRadius = radius;
                    style.borderBottomRightRadius = radius;
                  }
                  if (!isLast) {
                    style.borderColor = "hsl(0,0%,14%)";
                    style.borderBottomWidth = 1;
                  }

                  return style;
                }}
              />
            </React.Fragment>
          );
        });
      })}
    </View>
  );
};

export default MessageModal;
