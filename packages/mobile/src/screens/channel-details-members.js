import React from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import Svg, { Path } from "react-native-svg";
import * as Shades from "@shades/common";
import theme from "../theme";
import { UserListItem } from "./new-chat";
import Input from "../components/input";
import { Star as StarIcon } from "../components/icons";

const { useAppScope } = Shades.app;
const { sort, comparator } = Shades.utils.array;
const { search: searchUsers } = Shades.utils.user;

export const options = {
  title: "Members",
  headerLeft: (props) => <HeaderLeft {...props} />,
};

const HeaderLeft = ({ tintColor, canGoBack }) => {
  const navigation = useNavigation();
  return (
    <Pressable
      onPress={() => {
        if (canGoBack) {
          navigation.goBack();
          return;
        }
        navigation.goBack();
      }}
    >
      <Text style={{ color: tintColor, fontSize: 16 }}>Back</Text>
    </Pressable>
  );
};

const MembersScreen = ({ navigation, route }) => {
  const { channelId } = route.params;
  const { state } = useAppScope();

  const inputRef = React.useRef();

  const [pendingInput, setPendingInput] = React.useState("");

  const me = state.selectMe();
  const members = state.selectChannelMembers(channelId);
  const starredUserIds = state.selectStarredUserIds();

  const filteredMembers = React.useMemo(() => {
    const query = pendingInput.trim();

    const unfilteredMembers = members.map((m) => {
      if (m.id === me.id)
        return { ...m, displayName: `${m.displayName} (you)` };

      if (starredUserIds.includes(m.id)) return { ...m, isStarred: true };

      return m;
    });

    if (query.length <= 1)
      return sort(
        comparator(
          (u) => u.id !== me.id && u.onlineStatus === "online",
          (u) => u.isStarred ?? false,
          (u) => {
            const hasAddressDisplayName =
              u.displayName?.startsWith("0x") && u.displayName?.includes("...");
            return !hasAddressDisplayName;
          },
          (u) => u.displayName?.toLowerCase()
        ),
        unfilteredMembers
      );

    return searchUsers(unfilteredMembers, query);
  }, [pendingInput, members, me, starredUserIds]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 5 }}>
        <Input
          ref={inputRef}
          autoFocus
          value={pendingInput}
          placeholder="Find member"
          onChangeText={setPendingInput}
          keyboardType="web-search"
        />
      </View>

      <FlatList
        data={filteredMembers}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <UserListItem
            address={item.walletAddress}
            displayName={item.displayName}
            ensName={item.ensName}
            profilePicture={item.profilePicture}
            status={item.onlineStatus}
            onSelect={() => {
              navigation.navigate("User modal", { userId: item.id });
            }}
            rightColumn={
              <View
                style={{
                  width: 44,
                  height: 20,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {item.isStarred && (
                  <StarIcon
                    width="16"
                    height="16"
                    style={{ color: theme.colors.textMuted }}
                  />
                )}
              </View>
            }
          />
        )}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: 5, paddingBottom: 20 }}
      />
    </View>
  );
};

export default MembersScreen;
