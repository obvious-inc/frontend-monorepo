import React from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  LayoutAnimation,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useEnsName } from "wagmi";
import * as Shades from "@shades/common";
import theme from "../theme";
import UserProfilePicture from "../components/user-profile-picture";
import Input from "../components/input";
import {
  Globe as GlobeIcon,
  Lock as LockIcon,
  EyeOff as EyeOffIcon,
} from "../components/icons";

const { reverse } = Shades.utils.array;
const { search: searchChannels } = Shades.utils.channel;
const { truncateAddress } = Shades.utils.ethereum;

const { useAppScope } = Shades.app;

const { textDefault, textDimmed } = theme.colors;

export const options = {};

const ChannelList = ({ navigation }) => {
  const { state } = useAppScope();

  const user = state.selectMe();
  const truncatedAddress =
    user?.walletAddress == null ? null : truncateAddress(user.walletAddress);

  const { data: ensName } = useEnsName({ address: user.walletAddress });

  const channels = state.selectMemberChannels();
  const starredChannels = state.selectStarredChannels();

  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredChannels = React.useMemo(
    () =>
      searchChannels(
        searchQuery,
        channels.map((c) => ({
          ...c,
          members: state.selectChannelMembers(c.id),
        }))
      ),
    [channels, searchQuery, state]
  );

  const [collapsedIds, setCollapsedIds] = React.useState([]);

  const userDisplayName = user.hasCustomDisplayName
    ? user.displayName
    : ensName ?? truncatedAddress;

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <Pressable
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: 60,
          paddingHorizontal: 20,
        }}
        onPress={() => {
          navigation.navigate("Account modal");
        }}
      >
        <View
          style={{
            width: 30,
            height: 30,
            alignItems: "center",
            justifyContent: "center",
            marginRight: 8,
          }}
        >
          <UserProfilePicture transparent user={user} size={26} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: textDefault,
              fontSize: 18,
              fontWeight: "500",
              lineHeight: 20,
            }}
          >
            {userDisplayName}
          </Text>
          {userDisplayName !== truncatedAddress && (
            <Text
              style={{
                color: textDimmed,
                fontSize: 12,
                fontWeight: "400",
                lineHeight: 14,
              }}
            >
              {ensName == null || ensName === userDisplayName
                ? truncatedAddress
                : `${ensName} (${truncatedAddress})`}
            </Text>
          )}
        </View>
        <View>
          <Pressable
            hitSlop={20}
            onPress={() => {
              navigation.navigate("Create channel");
            }}
            style={{
              width: 20,
              height: 20,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
              borderWidth: 2,
              borderColor: textDefault,
            }}
          >
            <Svg width="14" height="14" viewBox="0 0 14 14" fill={textDefault}>
              <Path d="M2 7.16357C2 7.59692 2.36011 7.95093 2.78735 7.95093H6.37622V11.5398C6.37622 11.9731 6.73022 12.3271 7.16357 12.3271C7.59692 12.3271 7.95093 11.9731 7.95093 11.5398V7.95093H11.5398C11.9731 7.95093 12.3271 7.59692 12.3271 7.16357C12.3271 6.73022 11.9731 6.37622 11.5398 6.37622H7.95093V2.78735C7.95093 2.36011 7.59692 2 7.16357 2C6.73022 2 6.37622 2.36011 6.37622 2.78735V6.37622H2.78735C2.36011 6.37622 2 6.73022 2 7.16357Z" />
            </Svg>
          </Pressable>
        </View>
      </Pressable>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: 20 }}
        stickyHeaderIndices={[0]}
        stickyHeaderHiddenOnScroll
      >
        <View
          style={{
            paddingHorizontal: 16,
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            paddingVertical: 5,
            backgroundColor: theme.colors.background,
            marginBottom: 5,
          }}
        >
          <Input
            placeholder="Search"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {searchQuery.trim().length >= 2 ? (
          <>
            {filteredChannels.map((c) => (
              <ChannelItem
                key={c.id}
                id={c.id}
                onPress={() => {
                  navigation.navigate("Channel", { channelId: c.id });
                }}
              />
            ))}
          </>
        ) : (
          <>
            {starredChannels.length !== 0 && (
              <CollapsableSection
                title="Starred"
                expanded={!collapsedIds.includes("starred")}
                onToggleExpanded={() => {
                  LayoutAnimation.configureNext(
                    LayoutAnimation.Presets.easeInEaseOut
                  );
                  setCollapsedIds((ids) =>
                    ids.includes("starred")
                      ? ids.filter((id) => id !== "starred")
                      : [...ids, "starred"]
                  );
                }}
              >
                {starredChannels.map((c) => (
                  <ChannelItem
                    key={c.id}
                    id={c.id}
                    onPress={() => {
                      navigation.navigate("Channel", { channelId: c.id });
                    }}
                  />
                ))}
              </CollapsableSection>
            )}

            {channels.length !== 0 && (
              <CollapsableSection
                title="Channels"
                expanded={!collapsedIds.includes("channels")}
                onToggleExpanded={() => {
                  LayoutAnimation.configureNext(
                    LayoutAnimation.Presets.easeInEaseOut
                  );
                  setCollapsedIds((ids) =>
                    ids.includes("channels")
                      ? ids.filter((id) => id !== "channels")
                      : [...ids, "channels"]
                  );
                }}
              >
                {channels.map((c) => (
                  <ChannelItem
                    key={c.id}
                    id={c.id}
                    onPress={() => {
                      navigation.navigate("Channel", { channelId: c.id });
                    }}
                  />
                ))}
              </CollapsableSection>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export const ChannelItem = ({ id, onPress }) => {
  const { state } = useAppScope();
  const name = state.selectChannelName(id);
  const hasUnread = state.selectChannelHasUnread(id);
  const notificationCount = state.selectChannelMentionCount(id);

  return (
    <ListItem
      onPress={onPress}
      notificationCount={notificationCount}
      title={
        <Text style={{ color: hasUnread ? "white" : undefined }}>{name}</Text>
      }
      icon={<ChannelPicture transparent channelId={id} size={26} />}
    />
  );
};

const CollapsableSection = ({
  title,
  expanded,
  onToggleExpanded,
  children,
}) => (
  <>
    <View style={{ marginTop: 5 }} />
    <View
      style={{
        paddingRight: 8,
        paddingLeft: 22,
        height: 34,
        alignItems: "flex-start",
        justifyContent: "center",
      }}
    >
      <Pressable
        onPress={onToggleExpanded}
        style={({ pressed }) => ({
          paddingVertical: 2,
          paddingHorizontal: 5,
          marginLeft: -4,
          marginBottom: 2,
          borderRadius: 3,
          backgroundColor: pressed ? "hsl(0,0%,16%)" : undefined,
        })}
      >
        {({ pressed }) => (
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              lineHeight: 17,
              color: pressed
                ? "rgba(255, 255, 255, 0.565)"
                : "rgba(255, 255, 255, 0.282)",
            }}
          >
            {title}
          </Text>
        )}
      </Pressable>
    </View>

    {expanded && (
      <>
        {children}
        <View style={{ marginBottom: 18 }} />
      </>
    )}
  </>
);

const ListItem = ({ icon, title, notificationCount, disabled, ...props }) => (
  <View style={{ paddingHorizontal: 4 }}>
    <Pressable
      {...props}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 3,
        paddingVertical: 2,
        paddingHorizontal: 18,
        height: 39,
        backgroundColor: pressed ? "rgba(255, 255, 255, 0.055)" : undefined,
      })}
    >
      {icon != null && (
        <View
          style={{
            width: 30,
            height: 26,
            marginRight: 6,
          }}
        >
          <View
            style={{
              color: disabled ? "rgba(255, 255, 255, 0.22)" : "gray",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
            }}
          >
            {icon}
          </View>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "500",
            color: disabled ? "red" : textDimmed,
            lineHeight: 26,
          }}
        >
          {title}
        </Text>
      </View>
      {notificationCount > 0 && <NotificationBadge count={notificationCount} />}
    </Pressable>
  </View>
);

const NotificationBadge = ({ count }) => (
  <View
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.notificationRed,
      height: 20,
      minWidth: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
    }}
  >
    <Text
      style={{
        color: "white",
        fontSize: 12,
        lineHeight: 13.5,
        fontWeight: "600",
      }}
    >
      {count}
    </Text>
  </View>
);

export const ChannelPicture = React.memo(
  ({
    channelId,
    size = 18,
    background = theme.colors.backgroundLighter,
    transparent,
  }) => {
    const { state } = useAppScope();
    const channel = state.selectChannel(channelId);
    const channelName = state.selectChannelName(channelId);
    const placeholder = () => (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: background,
          overflow: "hidden",
        }}
      />
    );

    if (channel == null) return placeholder();

    if (channel.image != null)
      return (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: background,
            overflow: "hidden",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image
            source={{ uri: channel.image }}
            style={{ width: "100%", height: "100%" }}
          />
        </View>
      );

    switch (channel.kind) {
      case "dm": {
        const user = state.selectMe();
        const memberUsers = state.selectChannelMembers(channelId);
        const memberUsersExcludingMe = memberUsers.filter(
          (u) => user == null || u.id !== user.id
        );
        const isFetchingMembers = memberUsers.some(
          (m) => m.walletAddress == null
        );

        if (isFetchingMembers) return placeholder();

        if (memberUsersExcludingMe.length <= 1)
          return (
            <UserProfilePicture
              transparent={transparent}
              size={size}
              user={memberUsersExcludingMe[0] ?? memberUsers[0]}
            />
          );

        return (
          <View
            style={{
              width: size,
              height: size,
              position: "relative",
            }}
          >
            {reverse(memberUsersExcludingMe.slice(0, 2)).map((user, i) => {
              const borderWidth = 3;
              const smallSize = size * (3 / 4) + borderWidth * 2;
              const diff = size - smallSize;
              return (
                <UserProfilePicture
                  key={user.id}
                  size={smallSize}
                  user={user}
                  background={background}
                  transparent={transparent}
                  style={{
                    position: "absolute",
                    top: i === 0 ? borderWidth * -1 : diff + borderWidth,
                    left: i === 0 ? borderWidth + 2 : borderWidth * -1,
                    borderWidth,
                    borderColor: theme.colors.background,
                  }}
                />
              );
            })}
          </View>
        );
      }

      default: {
        return (
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: background,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: textDimmed, fontSize: 11 }}>
              {
                // Emojis: https://dev.to/acanimal/how-to-slice-or-get-symbols-from-a-unicode-string-with-emojis-in-javascript-lets-learn-how-javascript-represent-strings-h3a
                [...channelName][0]?.toUpperCase()
              }
            </Text>
          </View>
        );
      }
    }
  }
);

export const ChannelPermissionIcon = ({ channelId, ...props }) => {
  const { state } = useAppScope();
  const permissionType = state.selectChannelAccessLevel(channelId);

  const componentByPermissionType = {
    open: GlobeIcon,
    closed: LockIcon,
    private: EyeOffIcon,
  };

  const Component = componentByPermissionType[permissionType];

  if (Component == null) throw new Error();

  return <Component {...props} />;
};

export default ChannelList;
