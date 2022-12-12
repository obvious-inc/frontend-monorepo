import React from "react";
import { View, Text, Pressable, FlatList } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as Shades from "@shades/common";
import theme from "../theme";
import { UserListItem } from "./new-chat";
import Input from "../components/input";
import { Star as StarIcon } from "../components/icons";

const { useMe, useChannelMembers, useStarredUserIds, useBlockedUserIds } =
  Shades.app;
const { sort } = Shades.utils.array;
const {
  search: searchUsers,
  createDefaultComparator: createUserDefaultComparator,
} = Shades.utils.user;

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

  const inputRef = React.useRef();

  const [pendingInput, setPendingInput] = React.useState("");
  const deferredPendingInput = React.useDeferredValue(pendingInput);

  const me = useMe();
  const members = useChannelMembers(channelId);
  const starredUserIds = useStarredUserIds();
  const blockedUserIds = useBlockedUserIds();

  const filteredMembers = React.useMemo(() => {
    const query = deferredPendingInput.trim();

    const unfilteredMembers = members.map((m) => {
      if (m.id === me.id)
        return { ...m, displayName: `${m.displayName} (you)` };

      if (blockedUserIds.includes(m.id)) return { ...m, isBlocked: true };
      if (starredUserIds.includes(m.id)) return { ...m, isStarred: true };

      return m;
    });

    if (query.length <= 1)
      return sort(createUserDefaultComparator(), unfilteredMembers);

    return searchUsers(unfilteredMembers, query);
  }, [deferredPendingInput, members, me, starredUserIds, blockedUserIds]);

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
            blocked={item.isBlocked}
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
