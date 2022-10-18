import { useEnsAddress } from "wagmi";
import { utils as ethersUtils } from "ethers";
import React from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import * as Shades from "@shades/common";
import { UserListItem, HorizontalUserListItem } from "./new-chat";

const { useAppScope } = Shades.app;
const { useLatestCallback } = Shades.react;
const { unique } = Shades.utils.array;

const textDefault = "hsl(0,0%,83%)";
const textDimmed = "hsl(0,0%,50%)";

export const options = {
  headerTintColor: textDefault,
  title: "New Open Chat",
  headerRight: () => (
    <View>
      <Text style={{ color: textDimmed, fontSize: 16 }}>Create</Text>
    </View>
  ),
};

const NewOpen = () => {
  const headerHeight = useHeaderHeight();
  const { actions, state } = useAppScope();

  const me = state.selectMe();
  const memberChannels = state.selectMemberChannels();
  const channelMemberUserIds = unique(
    memberChannels.flatMap((c) => c.memberUserIds)
  );
  const users = state
    .selectUsers(channelMemberUserIds)
    .filter(
      (u) => u.walletAddress.toLowerCase() !== me.walletAddress.toLowerCase()
    );

  const inputRef = React.useRef();

  const [members, setMembers] = React.useState([]);
  const hasMembers = members.length !== 0;

  const [pendingInput, setPendingInput] = React.useState("");
  const trimmedInput = pendingInput.trim();

  const suffix = trimmedInput.split(".").slice(-1)[0];
  const bareEnsNameQuery = trimmedInput.split(".").slice(0, -1).join(".");
  const hasIncompleteEnsSuffix = "eth".startsWith(suffix);
  const ensNameQuery = trimmedInput.endsWith(".eth")
    ? trimmedInput
    : `${hasIncompleteEnsSuffix ? bareEnsNameQuery : trimmedInput}.eth`;

  const {
    data: ensAddress,
    // isLoading: isLoadingEns
  } = useEnsAddress({
    name: ensNameQuery,
    enabled: trimmedInput.length >= 2,
  });

  // const showEnsLoading = isLoadingEns && !ensNameQuery.startsWith("0x");

  const queryAddress =
    ensAddress ?? (ethersUtils.isAddress(trimmedInput) ? trimmedInput : null);

  const filteredUsers = React.useMemo(() => {
    if (trimmedInput.length < 3) return users;

    const queryWords = trimmedInput
      .toLowerCase()
      .split(" ")
      .map((s) => s.trim());

    const match = (user, query) =>
      user.displayName.toLowerCase().includes(query);

    return users.filter(
      (u) =>
        queryWords.some((q) => match(u, q)) &&
        (queryAddress == null ||
          u.walletAddress.toLowerCase() !== queryAddress.toLowerCase())
    );
  }, [users, trimmedInput, queryAddress]);

  const maybeUser =
    queryAddress == null
      ? null
      : state.selectUserFromWalletAddress(queryAddress);

  const insets = useSafeAreaInsets();

  const fetchStarredUsers = useLatestCallback(() =>
    actions.fetchUsers(channelMemberUserIds)
  );

  React.useEffect(() => {
    fetchStarredUsers();
  }, [fetchStarredUsers]);

  return (
    <KeyboardAvoidingView
      key="new-chat-avoid"
      behavior="padding"
      // No idea why this works. Accident?
      keyboardVerticalOffset={headerHeight - insets.bottom}
      style={{ flex: 1 }}
    >
      {hasMembers && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: 11,
              paddingHorizontal: 8,
            }}
          >
            {members.map((address) => (
              <HorizontalUserListItem
                key={address}
                address={address}
                onPress={() => {
                  setMembers((ms) =>
                    ms.filter((a) => a.toLowerCase() !== address.toLowerCase())
                  );
                }}
              />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={{ paddingHorizontal: 16 }}>
        <View
          style={{
            justifyContent: "center",
            paddingLeft: 16,
            paddingRight: 5,
            paddingVertical: 8,
            backgroundColor: "hsl(0,0%,14%)",
            borderRadius: 12,
            width: "100%",
          }}
        >
          <TextInput
            ref={inputRef}
            autoFocus
            value={pendingInput}
            placeholder="ENS or wallet address"
            onChangeText={setPendingInput}
            placeholderTextColor={textDimmed}
            keyboardAppearance="dark"
            keyboardType="web-search"
            clearButtonMode="while-editing"
            autoCapitalize="none"
            returnKeyType="done"
            style={{
              width: "100%",
              color: textDefault,
              fontSize: 16,
              lineHeight: 20,
              paddingVertical: 2,
            }}
          />
        </View>
        {/* <Text style={{ marginTop: 16, color: "hsl(0,0%,50%)", fontSize: 14 }}> */}
        {/*   Find groups Add members by their ENS name or wallet address. */}
        {/* </Text> */}
      </View>

      <FlatList
        data={
          queryAddress == null
            ? filteredUsers
            : [
                {
                  id: queryAddress,
                  walletAddress: queryAddress,
                  displayName: maybeUser?.displayName,
                  ensName: ensAddress == null ? null : ensNameQuery,
                },
                ...filteredUsers,
              ]
        }
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <UserListItem
            address={item.walletAddress}
            displayName={item.displayName}
            ensName={item.ensName}
            onSelect={() => {
              setMembers((ms) =>
                ms.includes(item.walletAddress.toLowerCase())
                  ? ms.filter((a) => a !== item.walletAddress.toLowerCase())
                  : [...ms, item.walletAddress.toLowerCase()]
              );
            }}
          />
        )}
        keyboardShouldPersistTaps="handled"
        style={{ paddingVertical: 10 }}
      />

      {/* {isLoadingEns && showEnsLoading && ( */}
      {/*   <View */}
      {/*     style={{ */}
      {/*       height: 61, */}
      {/*       justifyContent: "center", */}
      {/*       alignItems: "center", */}
      {/*     }} */}
      {/*   > */}
      {/*     <Text style={{ color: textDimmed }}>Loading...</Text> */}
      {/*   </View> */}
      {/* )} */}
    </KeyboardAvoidingView>
  );
};

export default NewOpen;
