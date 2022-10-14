import * as Clipboard from "expo-clipboard";
import { View, Text } from "react-native";
import * as Shades from "@shades/common";
import { WEB_APP_ENDPOINT } from "../config";
import { ModalActionButtonGroup } from "./account-modal";
import { ChannelPicture } from "./channel-list";

const { useAppScope } = Shades.app;

const textDimmed = "hsl(0,0%,50%)";

export const options = { presentation: "modal" };

const ChannelDetailsModal = ({ navigation, route }) => {
  const { state } = useAppScope();
  const channel = state.selectChannel(route.params.channelId);
  const memberCount = channel.memberUserIds.length;

  const actions = [
    {
      label: "Copy link",
      onPress: () => {
        Clipboard.setStringAsync(
          `${WEB_APP_ENDPOINT}/channels/${route.params.channelId}`
        ).then(() => {
          navigation.goBack();
        });
      },
    },
    { label: "Star", disabled: true, onPress: () => {} },
    { label: "Members", disabled: true, onPress: () => {} },
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
                color: textDimmed,
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
            color: textDimmed,
            fontSize: 14,
            fontWeight: "400",
            lineHeight: 18,
            marginBottom: 20,
          }}
        >
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </Text>
      </View>

      <ModalActionButtonGroup actions={actions} />
    </View>
  );
};

export default ChannelDetailsModal;
