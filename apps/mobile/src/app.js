import {
  API_ENDPOINT,
  WEB_APP_ENDPOINT,
  PUSHER_KEY,
  INFURA_PROJECT_ID,
  CLOUDFLARE_ACCOUNT_HASH,
} from "./config";
import * as Device from "expo-device";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import * as Updates from "expo-updates";
import { StatusBar } from "expo-status-bar";
import {
  WagmiConfig,
  createClient as createWagmiClient,
  configureChains as configureWagmiChains,
} from "wagmi";
import { mainnet as mainnetChain } from "wagmi/chains";
import { infuraProvider } from "wagmi/providers/infura";
import { publicProvider } from "wagmi/providers/public";
import React from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import {
  NavigationContainer,
  DarkTheme as ReactNavigationDarkTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { WebView } from "react-native-webview";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Pusher from "pusher-js/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Shades from "@shades/common";
import theme from "./theme";
import useOnlineListener from "./hooks/online-listener";
import useAppActiveListener from "./hooks/app-active-listener";
import Channel, { options as channelScreenOptions } from "./screens/channel";
import ChannelList, {
  options as channelListScreenOptions,
} from "./screens/channel-list";
import AccountModal, {
  options as accountModalOptions,
} from "./screens/account-modal";
import ChannelDetails, {
  options as channelDetailsScreenOptions,
} from "./screens/channel-details-modal";
import ChannelDetailsAddMembers, {
  options as channelDetailsAddMembersScreenOptions,
} from "./screens/channel-details-add-members";
import ChannelDetailsMembers, {
  options as channelDetailsMembersScreenOptions,
} from "./screens/channel-details-members";
import UserModal, { options as userModalOptions } from "./screens/user-modal";
import NewChatScreen, {
  options as newChatScreenOptions,
} from "./screens/new-chat";
import NewGroupScreen, {
  options as newGroupScreenOptions,
} from "./screens/new-group";
import NewPrivateChannelScreen, {
  options as newPrivateChannelScreenOptions,
} from "./screens/new-private-channel";
import NewClosedChannelScreen, {
  options as newClosedChannelScreenOptions,
} from "./screens/new-closed-channel";

const TabNavigator = createBottomTabNavigator();

const { textBlue, background } = theme.colors;

const prefix = Linking.createURL("/");

const {
  AuthProvider,
  ServerConnectionProvider,
  AppStoreProvider,
  CacheStoreProvider,
  useAuth,
  useActions,
  useMe,
  useTotalMentionCount,
} = Shades.app;
const { useLatestCallback } = Shades.react;

const { provider } = configureWagmiChains(
  [mainnetChain],
  [infuraProvider({ apiKey: INFURA_PROJECT_ID }), publicProvider()]
);

const wagmiClient = createWagmiClient({
  autoConnect: true,
  provider,
  storage: null,
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const NativeStackNavigator = createNativeStackNavigator();

const useFetch = (fetcher_, deps = []) => {
  const fetcher = useLatestCallback(fetcher_);

  React.useEffect(() => {
    fetcher();
    // eslint-disable-next-line
  }, deps);

  useAppActiveListener(() => {
    fetcher();
  });

  useOnlineListener(() => {
    fetcher();
  });
};

const App = () => {
  const { status: authStatus, setAccessToken, setRefreshToken } = useAuth();
  const actions = useActions();
  const me = useMe();

  const {
    fetchMe,
    fetchClientBootData,
    fetchUserChannels,
    fetchUserChannelsReadStates,
    fetchStarredItems,
    fetchPubliclyReadableChannels,
    registerDevicePushToken,
  } = actions;

  const updateClient = useLatestCallback(() =>
    Promise.all([
      fetchMe(),
      fetchUserChannels(),
      fetchUserChannelsReadStates(),
      fetchStarredItems(),
    ])
  );

  useFetch(() => {
    fetchPubliclyReadableChannels();
  }, [fetchPubliclyReadableChannels]);

  React.useEffect(() => {
    if (authStatus !== "authenticated") return;
    fetchClientBootData();
  }, [authStatus, fetchClientBootData]);

  useAppActiveListener(() => {
    if (authStatus !== "authenticated") return;
    updateClient();
  });

  useOnlineListener(() => {
    if (authStatus !== "authenticated") return;
    updateClient();
  });

  React.useEffect(() => {
    if (!Device.isDevice) return;

    const registerForPushNotifications = async () => {
      const { status: permissionStatus, canAskAgain } =
        await Notifications.getPermissionsAsync();

      if (permissionStatus !== "granted") {
        if (!canAskAgain) return;
        const { status: statusAfterRequest } =
          await Notifications.requestPermissionsAsync();
        if (statusAfterRequest !== "granted") return;
      }

      const { data: token } = await Notifications.getExpoPushTokenAsync();

      registerDevicePushToken(token);
    };

    registerForPushNotifications();
  }, [registerDevicePushToken]);

  const totalMentionCount = useTotalMentionCount();
  const badgeCount = authStatus === "authenticated" ? totalMentionCount : null;

  React.useEffect(() => {
    if (badgeCount == null) return;
    Notifications.setBadgeCountAsync(badgeCount);
  }, [badgeCount]);

  if (authStatus === "not-authenticated")
    return (
      <SignInView
        onSuccess={({ accessToken, refreshToken }) => {
          setAccessToken(accessToken);
          setRefreshToken(refreshToken);
        }}
        onError={() => {
          // TODO
        }}
      />
    );

  // Loading screen
  if (authStatus === "loading" || me == null)
    return <View style={{ backgroundColor: background, flex: 1 }} />;

  return (
    <NativeStackNavigator.Navigator
      initialRouteName="Channel list"
      screenOptions={{ headerShown: false }}
    >
      <NativeStackNavigator.Screen
        name="Channel list"
        component={ChannelListTabs}
      />
      <NativeStackNavigator.Screen
        name="Channel"
        component={Channel}
        // initialParams={{ channelId: channels[0].id }}
        options={channelScreenOptions}
      />
      <NativeStackNavigator.Screen
        name="Account modal"
        component={AccountModal}
        options={accountModalOptions}
      />
      <NativeStackNavigator.Screen
        name="Channel details modal"
        component={ChannelDetailsModalStack}
        options={{ presentation: "modal" }}
      />
      <NativeStackNavigator.Screen
        name="User modal"
        component={UserModal}
        options={userModalOptions}
      />
      <NativeStackNavigator.Screen
        name="Create channel"
        component={CreateChannelModalStack}
        options={{ presentation: "modal" }}
      />
    </NativeStackNavigator.Navigator>
  );
};

const ChannelListTabs = () => (
  <TabNavigator.Navigator
    initialRouteName="Channel list inner"
    screenOptions={{ headerShown: false }}
    tabBar={
      () => <View />
      // <SafeAreaView
      //   edges={["bottom"]}
      //   style={{
      //     backgroundColor: "hsl(0,0%,11%)",
      //     borderColor: "hsl(0,0%,14%)",
      //     borderTopWidth: 1,
      //   }}
      // >
      //   <View
      //     style={{
      //       height: 50,
      //       alignItems: "center",
      //       justifyContent: "center",
      //     }}
      //   >
      //     <Text style={{ color: "hsl(0,0%,50%)", fontSize: 16 }}>Tabs?</Text>
      //   </View>
      // </SafeAreaView>
    }
  >
    <TabNavigator.Screen
      name="Channel list inner"
      component={ChannelList}
      options={channelListScreenOptions}
    />
  </TabNavigator.Navigator>
);

const ChannelDetailsModalStack = () => (
  <NativeStackNavigator.Navigator
    initialRouteName="Root"
    screenOptions={{
      headerShadowVisible: false,
      headerBackTitleVisible: false,
      headerTintColor: textBlue,
      headerTitleStyle: { color: "white" },
      headerStyle: { backgroundColor: background },
      contentStyle: { backgroundColor: background },
    }}
  >
    <NativeStackNavigator.Screen
      name="Root"
      component={ChannelDetails}
      options={channelDetailsScreenOptions}
    />
    <NativeStackNavigator.Screen
      name="Members"
      component={ChannelDetailsMembers}
      options={channelDetailsMembersScreenOptions}
    />
    <NativeStackNavigator.Screen
      name="Add members"
      component={ChannelDetailsAddMembers}
      options={channelDetailsAddMembersScreenOptions}
    />
  </NativeStackNavigator.Navigator>
);

const CreateChannelModalStack = () => (
  <NativeStackNavigator.Navigator
    initialRouteName="New Chat"
    screenOptions={{
      headerShadowVisible: false,
      headerBackTitleVisible: false,
      headerTintColor: textBlue,
      headerTitleStyle: { color: "white" },
      headerStyle: { backgroundColor: background },
      contentStyle: { backgroundColor: background },
    }}
  >
    <NativeStackNavigator.Screen
      name="New Chat"
      component={NewChatScreen}
      options={newChatScreenOptions}
    />
    <NativeStackNavigator.Screen
      name="New Closed"
      component={NewClosedChannelScreen}
      options={newClosedChannelScreenOptions}
    />
    <NativeStackNavigator.Screen
      name="New Private"
      component={NewPrivateChannelScreen}
      options={newPrivateChannelScreenOptions}
    />
    <NativeStackNavigator.Screen
      name="New Group"
      component={NewGroupScreen}
      options={newGroupScreenOptions}
    />
  </NativeStackNavigator.Navigator>
);

const SignInView = ({ onSuccess, onError }) => {
  const [didLoad, setLoaded] = React.useState(false);

  return (
    // Web login for now
    <WebView
      incognito
      source={{ uri: WEB_APP_ENDPOINT }}
      startInLoadingState={true}
      renderLoading={() => (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <ActivityIndicator color={theme.colors.textMuted} />
        </View>
      )}
      style={{
        display: didLoad ? "flex" : "none",
        backgroundColor: theme.colors.background,
      }}
      onLoad={() => {
        setLoaded(true);
      }}
      onShouldStartLoadWithRequest={(event) => {
        if (!event.url.startsWith(WEB_APP_ENDPOINT)) {
          Linking.openURL(event.url);
          return false;
        }

        return true;
      }}
      onMessage={(e) => {
        try {
          const message = JSON.parse(e.nativeEvent.data);

          switch (message.type) {
            case "ns:authenticated":
              onSuccess({
                accessToken: message.payload.accessToken,
                refreshToken: message.payload.refreshToken,
              });
              break;
            case "ns:error":
              onError(new Error());
              break;
            default: // Ignore
          }
        } catch (e) {
          console.warn(e);
        }
      }}
    />
  );
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  componentDidCatch(error, errorInfo) {
    // Catch errors in any components below and re-render with error message
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });
    // You can also log error messages to an error reporting service here
  }

  render() {
    if (this.state.errorInfo)
      return (
        <ErrorView
          message={
            this.state.error == null ? null : this.state.error.toString()
          }
          stack={this.state.errorInfo.componentStack}
        />
      );

    // Normally, just render children
    return this.props.children;
  }
}

const ErrorView = ({ message, stack }) => {
  const [isReloading, setReloading] = React.useState(false);
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 10,
          paddingHorizontal: 20,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: theme.colors.textDanger,
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            Error
          </Text>
        </View>
        <Pressable
          onPress={async () => {
            setReloading(true);
            await Updates.reloadAsync();
          }}
          disabled={isReloading}
          style={({ pressed }) => ({
            backgroundColor: pressed
              ? theme.colors.backgroundLighter
              : theme.colors.backgroundLight,
            paddingVertical: 8,
            paddingHorizontal: 12,
            alignSelf: "flex-start",
            borderRadius: 3,
          })}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: isReloading
                ? theme.colors.textMuted
                : theme.colors.textDefault,
            }}
          >
            Dismiss
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: 50,
        }}
      >
        <Text
          style={{
            color: theme.colors.textDefault,
            fontSize: 14,
            fontFamily: "Menlo-Regular",
          }}
        >
          {message}
        </Text>
        <Text
          style={{
            color: theme.colors.textDefault,
            lineHeight: 14,
            fontSize: 10,
            fontFamily: "Menlo-Regular",
          }}
        >
          {stack}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const NAVIGATION_STATE_STORAGE_KEY = "NAVIGATION_STATE";

export default () => {
  const [initialState, setInitialState] = React.useState("not-set");

  React.useEffect(() => {
    if (initialState !== "not-set") return;

    const restoreNavigationState = async () => {
      try {
        const storedState = await AsyncStorage.getItem(
          NAVIGATION_STATE_STORAGE_KEY
        );

        if (storedState == null) {
          setInitialState(undefined);
          return;
        }

        setInitialState(JSON.parse(storedState));
      } catch (e) {
        console.error(e);
      } finally {
        setInitialState(undefined);
      }
    };

    restoreNavigationState();
  }, [initialState]);

  if (initialState === "not-set") return null;

  return (
    <>
      <SafeAreaProvider>
        <ErrorBoundary>
          <CacheStoreProvider asyncStorage={AsyncStorage}>
            <WagmiConfig client={wagmiClient}>
              <NavigationContainer
                initialState={initialState}
                onStateChange={(state) => {
                  if (state == null) {
                    AsyncStorage.removeItem(NAVIGATION_STATE_STORAGE_KEY);
                    return;
                  }

                  AsyncStorage.setItem(
                    NAVIGATION_STATE_STORAGE_KEY,
                    JSON.stringify(state)
                  );
                }}
                theme={ReactNavigationDarkTheme}
                linking={{
                  prefixes: [prefix],
                  config: {
                    initialRouteName: "Channel list",
                    screens: {
                      Channel: "channels/:channelId",
                    },
                  },
                  async getInitialURL() {
                    // First, you may want to do the default deep link handling
                    // Check if app was opened from a deep link
                    const url = await Linking.getInitialURL();

                    if (url != null) return url;

                    // Handle URL from expo push notifications
                    const response =
                      await Notifications.getLastNotificationResponseAsync();

                    const expoUrl =
                      response?.notification.request.content.data.url;

                    if (expoUrl != null) return prefix + expoUrl;
                  },
                  subscribe(listener) {
                    // Listen to incoming links from deep linking
                    const urlSubscription = Linking.addEventListener(
                      "url",
                      ({ url }) => {
                        listener(url);
                      }
                    );

                    // Listen to expo push notifications
                    const subscription =
                      Notifications.addNotificationResponseReceivedListener(
                        (response) => {
                          const url =
                            response.notification.request.content.data.url;

                          // Any custom logic to see whether the URL needs to be handled

                          // Let React Navigation handle the URL
                          listener(prefix + url);
                        }
                      );

                    return () => {
                      // Clean up the event listeners
                      urlSubscription.remove();
                      subscription.remove();
                    };
                  },
                }}
              >
                <AuthProvider apiOrigin={API_ENDPOINT}>
                  <AppStoreProvider
                    cloudflareAccountHash={CLOUDFLARE_ACCOUNT_HASH}
                  >
                    <ServerConnectionProvider
                      Pusher={Pusher}
                      pusherKey={PUSHER_KEY}
                    >
                      <App />
                    </ServerConnectionProvider>
                  </AppStoreProvider>
                </AuthProvider>
              </NavigationContainer>
            </WagmiConfig>
          </CacheStoreProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
      <StatusBar />
    </>
  );
};
