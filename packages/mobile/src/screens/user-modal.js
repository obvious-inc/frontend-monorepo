import { View, Text } from "react-native";
import * as Shades from "@shades/common";

const { useAppScope } = Shades.app;

export const options = { presentation: "modal" };

const UserModal = ({ route }) => {
  const { state } = useAppScope();
  const user = state.selectUser(route.params.userId);

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
        {user?.displayName}
      </Text>
    </View>
  );
};

export default UserModal;
