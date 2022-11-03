import * as Clipboard from "expo-clipboard";
import React from "react";
import { View, Text } from "react-native";
import * as Shades from "@shades/common";
import theme from "../theme";
import { WEB_APP_ENDPOINT } from "../config";
import { ModalActionButtonGroup } from "./account-modal";
import { ChannelPicture } from "./channel-list";

const { useAppScope } = Shades.app;

export const options = { presentation: "modal" };

const ChannelDetailsModal = ({ navigation, route }) => {
  const { state, actions } = useAppScope();
  const { channelId } = route.params;
  const channel = state.selectChannel(channelId);
  const isStarredChannel = state.selectIsChannelStarred(channelId);
  const memberCount = channel.memberUserIds.length;

  const [hasPendingStarRequest, setPendingStarRequest] = React.useState(false);

  const buttonActions = [
    {
      key: "copy-link",
      label: "Copy link",
      onPress: () => {
        Clipboard.setStringAsync(
          `${WEB_APP_ENDPOINT}/channels/${route.params.channelId}`
        ).then(() => {
          navigation.goBack();
        });
      },
    },
    {
      key: "star-channel",
      label: isStarredChannel ? "Unstar" : "Star",
      disabled: hasPendingStarRequest,
      onPress: () => {
        setPendingStarRequest(true);
        const promise = isStarredChannel
          ? actions.unstarChannel(channelId)
          : actions.starChannel(channelId);
        promise.finally(() => {
          setPendingStarRequest(false);
        });
      },
    },
    { key: "members", label: "Members", disabled: true, onPress: () => {} },
  ];

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
          alignItems: "flex-start",
          marginBottom: 20,
        }}
      >
        <View style={{ marginRight: 12 }}>
          <ChannelPicture channelId={route.params.channelId} size={38} />
        </View>
        <View style={{ flex: 1, justifyContent: "center", minHeight: 38 }}>
          <Text
            style={{
              color: "white",
              fontSize: 16,
              fontWeight: "600",
              lineHeight: 18,
              paddingTop: 2,
            }}
          >
            {channel.name}
          </Text>
          {(channel.description?.trim() ?? "") !== "" && (
            <Text
              style={{
                color: theme.colors.textDimmed,
                fontSize: 12,
                fontWeight: "400",
                lineHeight: 17,
                marginTop: 1,
              }}
            >
              {channel.description}
            </Text>
          )}
        </View>
      </View>

      <View>
        <Text
          style={{
            color: theme.colors.textDimmed,
            fontSize: 14,
            fontWeight: "400",
            lineHeight: 18,
            marginBottom: 20,
          }}
        >
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </Text>
      </View>

      <ModalActionButtonGroup actions={buttonActions} />
    </View>
  );
};

export default ChannelDetailsModal;
