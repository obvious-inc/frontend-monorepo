import { View, Text } from "react-native";
import * as Shades from "@shades/common";

const { useAppScope } = Shades.app;

export const options = { presentation: "modal" };

const ChannelDetailsModal = ({ route }) => {
  const { state } = useAppScope();
  const channel = state.selectChannel(route.params.channelId);
  return (
    <View
      style={{
        backgroundColor: "hsl(0,0%,10%)",
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 16, color: "hsl(0,0%,30%)" }}>
        {channel?.name ?? "..."}
      </Text>
    </View>
  );
};

export default ChannelDetailsModal;
