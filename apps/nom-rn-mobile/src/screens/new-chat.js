import { isAddress as isEthereumAccountAddress } from "viem";
import React from "react";
import { View, Text, Pressable, Keyboard, FlatList } from "react-native";
import { useEnsAddress } from "wagmi";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "@react-navigation/native";
import * as Shades from "@shades/common";
import theme from "../theme";
import UserProfilePicture from "../components/user-profile-picture";
import Input from "../components/input";
import {
  Globe as GlobeIcon,
  Lock as LockIcon,
  EyeOff as EyeOffIcon,
} from "../components/icons";

const {
  useSelectors,
  useActions,
  useMe,
  useUsers,
  useMemberChannels,
  useStarredUsers,
  useStarredUserIds,
  useUserWithWalletAddress,
} = Shades.app;
const { useLatestCallback } = Shades.react;
const { unique } = Shades.utils.array;
const { truncateAddress } = Shades.utils.ethereum;
const { search: searchUsers } = Shades.utils.user;

export const options = {
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
        navigation.navigate("Channel list");
      }}
    >
      <Text style={{ color: tintColor, fontSize: 16 }}>Cancel</Text>
    </Pressable>
  );
};

const groupTypeOptions = [
  {
    label: "Open",
    description: "Anyone can see and join",
    link: "New Group",
    icon: <GlobeIcon style={{ color: "white" }} />,
  },
  {
    label: "Closed",
    description: "Anyone can see but not join",
    link: "New Closed",
    icon: <LockIcon style={{ color: "white" }} />,
  },
  {
    label: "Private",
    description: "Only members can see",
    link: "New Private",
    icon: <EyeOffIcon style={{ color: "white" }} />,
  },
];

export const useFilteredUsers = ({ query }) => {
  const actions = useActions();
  const { fetchUsers } = actions;

  const me = useMe();
  const memberChannels = useMemberChannels();
  const channelMemberUserIds = React.useMemo(
    () =>
      unique(
        memberChannels
          .flatMap((c) => c.memberUserIds)
          .filter((id) => id !== me.id)
      ),
    [memberChannels, me.id]
  );
  const starredUserIds = useStarredUserIds();
  const starredUsers = useStarredUsers();

  const userIds = React.useMemo(
    () => unique([...starredUserIds, ...channelMemberUserIds]),
    [starredUserIds, channelMemberUserIds]
  );
  const usersWithoutStarredInfo = useUsers(userIds);
  const users = React.useMemo(
    () =>
      usersWithoutStarredInfo.map((u) => {
        if (!starredUserIds.includes(u.id)) return u;
        return { ...u, isStarred: true };
      }),
    [usersWithoutStarredInfo, starredUserIds]
  );

  const trimmedQuery = React.useDeferredValue(query.trim());

  const { data: ensAddress, isLoading: isLoadingEns } = useEnsAddress({
    name: trimmedQuery,
    enabled: trimmedQuery.endsWith(".eth"),
  });

  const showEnsLoading = isLoadingEns && !trimmedQuery.startsWith("0x");

  const queryAddress =
    ensAddress ??
    (isEthereumAccountAddress(trimmedQuery) ? trimmedQuery : null);

  const queryAddressUser = useUserWithWalletAddress(queryAddress);

  const filteredUsers = React.useMemo(() => {
    if (trimmedQuery.length <= 1) return starredUsers;

    const filteredUsers = searchUsers(users, trimmedQuery);

    if (queryAddress == null) return filteredUsers;

    return [
      {
        id: queryAddress,
        walletAddress: queryAddress,
        displayName: queryAddressUser?.displayName,
        ensName: ensAddress == null ? null : trimmedQuery,
      },
      ...filteredUsers.filter(
        (u) => u.walletAddress.toLowerCase() !== queryAddress.toLowerCase()
      ),
    ];
  }, [
    users,
    queryAddressUser,
    starredUsers,
    trimmedQuery,
    ensAddress,
    queryAddress,
  ]);

  React.useEffect(() => {
    fetchUsers(starredUserIds);
  }, [fetchUsers, starredUserIds]);

  React.useEffect(() => {
    fetchUsers(channelMemberUserIds);
  }, [fetchUsers, channelMemberUserIds]);

  return { users: filteredUsers, starredUsers, isLoading: showEnsLoading };
};

const useKeyboardStatus = () => {
  const [status, setStatus] = React.useState("did-hide");

  React.useEffect(() => {
    const listeners = [];

    listeners.push(
      Keyboard.addListener("keyboardWillHide", () => {
        setStatus("will-hide");
      })
    );
    listeners.push(
      Keyboard.addListener("keyboardDidHide", () => {
        setStatus("did-hide");
      })
    );
    listeners.push(
      Keyboard.addListener("keyboardWillShow", () => {
        setStatus("will-show");
      })
    );
    listeners.push(
      Keyboard.addListener("keyboardDidShow", () => {
        setStatus("did-show");
      })
    );

    return () => {
      for (const l of listeners) l.remove();
    };
  }, []);

  return status;
};

export const useAsyncDismissKeyboard = () => {
  const keyboardStatus = useKeyboardStatus();

  const dismiss = useLatestCallback(
    () =>
      new Promise((resolve) => {
        if (keyboardStatus === "did-hide") {
          resolve();
          return;
        }

        const listener = Keyboard.addListener("keyboardDidHide", () => {
          resolve();
          listener.remove();
        });

        Keyboard.dismiss();
      })
  );

  return dismiss;
};

const NewChat = ({ navigation }) => {
  const selectors = useSelectors();

  const inputRef = React.useRef();

  const [pendingInput, setPendingInput] = React.useState("");

  const { users: filteredUsers, isLoading: isLoadingUsers } = useFilteredUsers({
    query: pendingInput,
  });

  const [hasPendingSubmit, setPendingSubmit] = React.useState(false);

  const dismissKeyboard = useAsyncDismissKeyboard();

  const dmAddress = (address) => {
    setPendingSubmit(true);

    dismissKeyboard().then(() => {
      const user = selectors.selectUserFromWalletAddress(address);
      const dmChannel =
        user == null ? null : selectors.selectDmChannelFromUserId(user.id);

      if (dmChannel != null) {
        navigation.replace("Channel", { channelId: dmChannel.id });
        return;
      }

      navigation.replace("Channel", { walletAddress: address });
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingBottom: 5 }}>
        <Input
          ref={inputRef}
          value={pendingInput}
          placeholder="ENS or wallet address"
          onChangeText={setPendingInput}
          disabled={hasPendingSubmit}
          keyboardType="web-search"
        />
      </View>

      <FlatList
        data={[
          isLoadingUsers && { type: "loader" },
          ...(pendingInput.trim().length > 0 || isLoadingUsers
            ? []
            : [
                { type: "section-title", title: "Create group" },
                ...groupTypeOptions.map((o, i, os) => ({
                  ...o,
                  type: "group-option",
                  separete: i === os.length - 1 && filteredUsers.length !== 0,
                })),
                filteredUsers.length > 0 && {
                  type: "section-title",
                  title: "Message directly",
                },
              ].filter(Boolean)),
          ...filteredUsers,
        ].filter(Boolean)}
        keyExtractor={(item) => {
          switch (item.type) {
            case "group-option":
              return item.label;
            case "loader":
              return "loader";
            case "section-title":
              return item.title;
            default:
              return item.id;
          }
        }}
        renderItem={({ item, index }) => {
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
                  <Text style={{ color: theme.colors.textDimmed }}>
                    Loading...
                  </Text>
                </View>
              );
            case "section-title":
              return (
                <View
                  style={{
                    height: index === 0 ? 40 : 60,
                    justifyContent: "flex-end",
                  }}
                >
                  <Text
                    style={{
                      paddingHorizontal: 16,
                      paddingBottom: 5,
                      fontSize: 14,
                      fontWeight: "600",
                      color: "hsl(0,0%,40%)",
                    }}
                  >
                    {item.title}
                  </Text>
                </View>
              );
            case "group-option":
              return (
                <ListItem
                  onPress={() => {
                    navigation.navigate(item.link);
                  }}
                  icon={
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: "hsl(0,0%,14%)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {item.icon}
                    </View>
                  }
                  title={item.label}
                  subtitle={item.description}
                  arrowRight
                />
              );
            default:
              return (
                <UserListItem
                  address={item.walletAddress}
                  displayName={item.displayName}
                  ensName={item.ensName}
                  profilePicture={item.profilePicture}
                  onSelect={() => {
                    dmAddress(item.walletAddress);
                  }}
                  arrowRight
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

export const UserListItem = ({
  displayName,
  ensName: specifiedEnsName,
  address,
  status,
  profilePicture,
  disabled,
  blocked,
  onSelect,
  arrowRight,
  rightColumn,
}) => {
  // const { data: fetchedEnsName } = useEnsName({
  //   address,
  //   enabled: ensName == null,
  // });
  const ensName = specifiedEnsName; // ?? fetchedEnsName;
  const userDisplayName = displayName ?? ensName;

  const truncatedAddress = truncateAddress(address);
  const title = userDisplayName ?? truncatedAddress;
  const subtitle =
    title === truncatedAddress
      ? null
      : ensName == null || title === ensName
      ? truncateAddress(address)
      : `${ensName} (${truncateAddress(address)})`;

  return (
    <ListItem
      onPress={onSelect}
      title={[title, blocked && "(blocked)"].filter(Boolean).join(" ")}
      truncateSubtitle
      subtitle={subtitle}
      icon={
        <View style={{ position: "relative" }}>
          <UserProfilePicture
            transparent
            user={{ walletAddress: address, profilePicture }}
            size={38}
          />
          {status === "online" && (
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: "hsl(139, 47.3%, 43.9%)",
                position: "absolute",
                right: -1,
                bottom: -1,
                borderWidth: 3,
                borderColor: theme.colors.background,
              }}
            />
          )}
        </View>
      }
      disabled={disabled}
      dimmed={blocked}
      arrowRight={arrowRight}
      rightColumn={rightColumn}
    />
  );
};

const ListItem = ({
  title,
  subtitle,
  icon,
  rightColumn,
  truncateSubtitle,
  arrowRight,
  borderColor = theme.colors.backgroundLight,
  dimmed,
  ...props
}) => {
  return (
    <Pressable
      style={({ pressed }) => ({
        backgroundColor: pressed ? theme.colors.backgroundLighter : undefined,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        opacity: props.disabled || dimmed ? 0.5 : 1,
      })}
      {...props}
    >
      {icon != null && (
        <View
          style={{
            width: 38,
            height: 60,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 12,
          }}
        >
          {icon}
        </View>
      )}
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          borderColor,
          borderBottomWidth: 1,
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            minHeight: 60,
            paddingVertical: 10,
          }}
        >
          <Text
            style={{
              color: "white",
              fontSize: 16,
              fontWeight: "600",
              lineHeight: 18,
              paddingTop: 2,
            }}
          >
            {title}
          </Text>
          {subtitle != null && (
            <Text
              numberOfLines={truncateSubtitle ? 1 : undefined}
              ellipsizeMode="tail"
              style={{
                color: theme.colors.textDimmed,
                fontSize: 12,
                fontWeight: "400",
                lineHeight: 17,
                marginTop: 1,
              }}
            >
              {subtitle}
            </Text>
          )}
        </View>
        {rightColumn != null && (
          <View style={{ height: 60, justifyContent: "center" }}>
            {rightColumn}
          </View>
        )}
        {arrowRight && (
          <View
            style={{ height: 60, justifyContent: "center", paddingLeft: 10 }}
          >
            <Svg
              width="18"
              height="18"
              viewBox="0 0 12 12"
              fill={theme.colors.textDefault}
              style={{ transform: [{ rotateZ: "-90deg" }] }}
            >
              <Path d="M6.02734 8.80274C6.27148 8.80274 6.47168 8.71484 6.66211 8.51465L10.2803 4.82324C10.4268 4.67676 10.5 4.49609 10.5 4.28125C10.5 3.85156 10.1484 3.5 9.72363 3.5C9.50879 3.5 9.30859 3.58789 9.15234 3.74902L6.03223 6.9668L2.90722 3.74902C2.74609 3.58789 2.55078 3.5 2.33105 3.5C1.90137 3.5 1.55469 3.85156 1.55469 4.28125C1.55469 4.49609 1.62793 4.67676 1.77441 4.82324L5.39258 8.51465C5.58789 8.71973 5.78808 8.80274 6.02734 8.80274Z" />
            </Svg>
          </View>
        )}
      </View>
    </Pressable>
  );
};

export default NewChat;
