import { useEnsAddress } from "wagmi";
import { utils as ethersUtils } from "ethers";
import React from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  LayoutAnimation,
  Pressable,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import * as Shades from "@shades/common";
import { Input, UserListItem } from "./new-chat";
import { HorizontalUserListItem } from "./new-closed-channel";

const { useAppScope } = Shades.app;
const { useLatestCallback } = Shades.react;
const { unique } = Shades.utils.array;

const textDefault = "hsl(0,0%,83%)";
const textDimmed = "hsl(0,0%,50%)";
const textBlue = "hsl(199, 100%, 46%)";

export const options = {
  headerTintColor: textDefault,
  title: "New Private Chat",
  headerRight: (props) => (
    <HeaderRight {...props} button={{ label: "Next", disabled: true }} />
  ),
};

const HeaderRight = ({ button: { label, disabled, onPress } }) => (
  <View>
    <Pressable disabled={disabled} onPress={onPress}>
      <Text style={{ color: disabled ? textDimmed : textBlue, fontSize: 16 }}>
        {label}
      </Text>
    </Pressable>
  </View>
);

const NewPrivate = ({ navigation }) => {
  const { actions, state } = useAppScope();

  const membersScrollViewRef = React.useRef();

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

  const { data: ensAddress, isLoading: isLoadingEns } = useEnsAddress({
    name: ensNameQuery,
    enabled: trimmedInput.length >= 2,
  });

  const showEnsLoading = isLoadingEns && !ensNameQuery.startsWith("0x");

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

  const fetchStarredUsers = useLatestCallback(() =>
    actions.fetchUsers(channelMemberUserIds)
  );

  const toggleMember = useLatestCallback((address) => {
    if (members.length === 0)
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    setMembers((ms) => {
      const nextMembers = ms.includes(address)
        ? ms.filter((a) => a !== address)
        : [...ms, address];

      const addedMember = nextMembers.length > ms.length;
      if (addedMember) {
        // Without the timeout the new item won’t yet be included
        setTimeout(() => {
          membersScrollViewRef.current?.scrollToEnd({ animated: true });
        });
      }

      return nextMembers;
    });
  });

  const removeMember = useLatestCallback((address) => {
    if (members.length === 1 && address === members[0])
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    return setMembers((ms) => ms.filter((a) => a !== address));
  });

  React.useEffect(() => {
    fetchStarredUsers();
  }, [fetchStarredUsers]);

  React.useLayoutEffect(() => {
    const hasMembers = members.length !== 0;
    navigation.setOptions({
      headerRight: () => (
        <HeaderRight
          button={{
            label: "Next",
            disabled: !hasMembers,
            onPress: () =>
              navigation.navigate("New Group", { members, type: "private" }),
          }}
        />
      ),
    });
  }, [members, navigation]);

  return (
    <View style={{ flex: 1 }}>
      {hasMembers && (
        <View>
          <ScrollView
            ref={membersScrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 11, paddingHorizontal: 8 }}
            style={{ width: "100%" }}
          >
            {members.map((address) => {
              const user = state.selectUserFromWalletAddress(address);
              return (
                <HorizontalUserListItem
                  key={address}
                  address={address}
                  displayName={user?.displayName}
                  onPress={() => {
                    removeMember(address);
                  }}
                />
              );
            })}
          </ScrollView>
        </View>
      )}

      <View style={{ paddingHorizontal: 16, paddingBottom: 5 }}>
        <Input
          ref={inputRef}
          autoFocus
          value={pendingInput}
          placeholder="ENS or wallet address"
          onChangeText={setPendingInput}
          keyboardType="web-search"
        />
        {/* <Text style={{ marginTop: 16, color: "hsl(0,0%,50%)", fontSize: 14 }}> */}
        {/*   Find groups Add members by their ENS name or wallet address. */}
        {/* </Text> */}
      </View>

      <FlatList
        data={[
          showEnsLoading && { type: "loader" },
          ...[
            queryAddress != null && {
              id: queryAddress,
              walletAddress: queryAddress,
              displayName: maybeUser?.displayName,
              ensName: ensAddress == null ? null : ensNameQuery,
            },
            ...filteredUsers,
          ]
            .filter(Boolean)
            .map((u) => {
              const isMe =
                me.walletAddress.toLowerCase() ===
                u.walletAddress.toLowerCase();
              const isSelected =
                isMe || members.includes(u.walletAddress.toLowerCase());

              return { ...u, isSelected, isMe };
            }),
        ].filter(Boolean)}
        keyExtractor={(item) => (item.type === "loader" ? "loader" : item.id)}
        renderItem={({ item }) => {
          switch (item.type) {
            case "loader":
              return (
                <View
                  style={{
                    height: 61,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: textDimmed }}>Loading...</Text>
                </View>
              );
            default:
              return (
                <UserListItem
                  address={item.walletAddress}
                  displayName={item.displayName}
                  ensName={item.ensName}
                  onSelect={() => {
                    toggleMember(item.walletAddress.toLowerCase());
                  }}
                  disabled={item.isMe}
                  rightColumn={
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: item.isSelected
                          ? textBlue
                          : "hsl(0,0%,20%)",
                        backgroundColor: item.isSelected ? textBlue : undefined,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {item.isSelected && (
                        <Svg
                          width="12"
                          height="12"
                          viewBox="0 0 16 16"
                          fill="hsl(0,0%,10%)"
                        >
                          <Path d="M6.6123 14.2646C7.07715 14.2646 7.43945 14.0869 7.68555 13.7109L14.0566 3.96973C14.2344 3.69629 14.3096 3.44336 14.3096 3.2041C14.3096 2.56152 13.8311 2.09668 13.1748 2.09668C12.7236 2.09668 12.4434 2.26074 12.1699 2.69141L6.57812 11.5098L3.74121 7.98926C3.48828 7.68848 3.21484 7.55176 2.83203 7.55176C2.16895 7.55176 1.69043 8.02344 1.69043 8.66602C1.69043 8.95312 1.7793 9.20605 2.02539 9.48633L5.55273 13.7588C5.84668 14.1074 6.1748 14.2646 6.6123 14.2646Z" />
                        </Svg>
                      )}
                    </View>
                  }
                />
              );
          }
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingTop: 5, paddingBottom: 20 }}
      />
    </View>
  );
};

export default NewPrivate;
