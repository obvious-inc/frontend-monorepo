import {
  API_ENDPOINT,
  WEB_APP_ENDPOINT,
  PUSHER_KEY,
  INFURA_PROJECT_ID,
} from "./config";
import {
  WagmiConfig,
  createClient as createWagmiClient,
  configureChains as configureWagmiChains,
} from "wagmi";
import { mainnet as mainnetChain } from "wagmi/chains";
import { infuraProvider } from "wagmi/providers/infura";
import { publicProvider } from "wagmi/providers/public";
import React from "react";
import { View, Text, Pressable } from "react-native";
import {
  NavigationContainer,
  DarkTheme as ReactNavigationDarkTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
// import { createStackNavigator } from "@react-navigation/stack";
import { WebView } from "react-native-webview";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Pusher from "pusher-js/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Shades from "@shades/common";
import useOnlineListener from "./hooks/online-listener";
import useAppActiveListener from "./hooks/app-active-listener";
import Channel, { options as channelScreenOptions } from "./screens/channel";
import ChannelList, {
  options as channelListScreenOptions,
} from "./screens/channel-list";
import AccountModal, {
  options as accountModalOptions,
} from "./screens/account-modal";
import ChannelDetailsModal, {
  options as channelDetailsModalOptions,
} from "./screens/channel-details-modal";
import UserModal, { options as userModalOptions } from "./screens/user-modal";
import NewPrivateScreen, {
  options as newPrivateScreenOptions,
} from "./screens/new-private-channel";

const textDimmed = "hsl(0,0%,50%)";
const textBlue = "hsl(199, 100%, 46%)";

const {
  AuthProvider,
  useAuth,
  ServerConnectionProvider,
  useAppScope,
  AppScopeProvider,
  useServerConnection,
} = Shades.app;
const { useLatestCallback } = Shades.react;
const { unique } = Shades.utils.array;

const { provider } = configureWagmiChains(
  [mainnetChain],
  [infuraProvider({ apiKey: INFURA_PROJECT_ID }), publicProvider()]
);

const wagmiClient = createWagmiClient({
  autoConnect: true,
  provider,
  storage: null,
});

// const NativeStackNavigator = createStackNavigator();
const NativeStackNavigator = createNativeStackNavigator();

const useServerEventListener = (listener_) => {
  const serverConnection = useServerConnection();

  const listener = useLatestCallback(listener_);

  React.useEffect(() => {
    const removeListener = serverConnection.addListener((...args) => {
      listener(...args);
    });

    return () => {
      removeListener();
    };
  }, [listener, serverConnection]);
};

const App = () => {
  const { status: authStatus, setAccessToken, setRefreshToken } = useAuth();
  const { state, actions, dispatch } = useAppScope();
  const me = state.selectMe();

  const {
    fetchClientBootData,
    fetchUserChannels,
    fetchUserChannelsReadStates,
    fetchStarredItems,
    fetchUsers,
  } = actions;

  const channels = state.selectMemberChannels();

  const bootClient = useLatestCallback(() =>
    fetchClientBootData().then(({ channels }) => {
      const dmUserIds = unique(
        channels.filter((c) => c.kind === "dm").flatMap((c) => c.members)
      );
      return fetchUsers(dmUserIds);
    })
  );

  const updateClient = useLatestCallback(() =>
    Promise.all([
      fetchUserChannels(),
      fetchUserChannelsReadStates(),
      fetchStarredItems(),
    ])
  );

  React.useEffect(() => {
    if (authStatus !== "authenticated") return;
    bootClient();
  }, [authStatus, bootClient]);

  useAppActiveListener(() => {
    if (authStatus !== "authenticated") return;
    updateClient();
  });

  useOnlineListener(() => {
    if (authStatus !== "authenticated") return;
    updateClient();
  });

  useServerEventListener((name, data) => {
    if (authStatus !== "authenticated") return;
    dispatch({ type: ["server-event", name].join(":"), data, user: me });
  });

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
  if (authStatus === "loading" || me == null || channels.length === 0)
    return <View style={{ backgroundColor: "hsl(0,0%,10%)", flex: 1 }} />;

  return (
    <NativeStackNavigator.Navigator
      initialRouteName="Channel list"
      screenOptions={{ headerShown: false }}
    >
      <NativeStackNavigator.Screen
        name="Channel list"
        component={ChannelList}
        options={channelListScreenOptions}
      />
      <NativeStackNavigator.Screen
        name="Channel"
        component={Channel}
        initialParams={{ channelId: channels[0].id }}
        options={channelScreenOptions}
      />
      <NativeStackNavigator.Screen
        name="Account modal"
        component={AccountModal}
        options={accountModalOptions}
      />
      <NativeStackNavigator.Screen
        name="Channel details modal"
        component={ChannelDetailsModal}
        options={channelDetailsModalOptions}
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

const CreateChannelModalStack = () => (
  <NativeStackNavigator.Navigator
    initialRouteName="New Channel"
    screenOptions={{
      headerShadowVisible: false,
      headerBackTitleVisible: false,
      headerTintColor: textBlue,
      headerTitleStyle: { color: "white" },
      headerStyle: { backgroundColor: "hsl(0,0%,10%)" },
      contentStyle: { backgroundColor: "hsl(0,0%,10%)" },
    }}
  >
    <NativeStackNavigator.Screen
      name="New Channel"
      component={NewChannel}
      options={{
        headerShadowVisible: true,
        headerStyle: { backgroundColor: "hsl(0,0%,12%)" },
        headerLeft: () => (
          <View>
            <Text style={{ color: textBlue, fontSize: 16 }}>Cancel</Text>
          </View>
        ),
      }}
    />
    <NativeStackNavigator.Screen name="New Open" component={NewOpen} />
    <NativeStackNavigator.Screen name="New Closed" component={NewClosed} />
    <NativeStackNavigator.Screen
      name="New Private"
      component={NewPrivateScreen}
      options={newPrivateScreenOptions}
    />
  </NativeStackNavigator.Navigator>
);

const NewChannel = ({ navigation }) => (
  <View
    style={{
      flex: 1,
      backgroundColor: "hsl(0,0%,10%)",
    }}
  >
    {[
      { label: "Open", description: "Anyone can see and join" },
      { label: "Closed", description: "Anyone can see but not join" },
      {
        label: "Private",
        description: "Only members can see",
        link: "New Private",
      },
    ].map((item, i, items) => (
      <Pressable
        key={i}
        disabled={item.link == null}
        onPress={() => {
          navigation.navigate(item.link);
        }}
        style={({ pressed }) => ({
          height: 64,
          flexDirection: "row",
          alignItems: "stretch",
          backgroundColor: pressed ? "hsl(0,0%,16%)" : "hsl(0,0%,12%)",
          borderColor: "hsl(0,0%,14%)",
          borderBottomWidth: i === items.length - 1 ? 1 : 0,
        })}
      >
        <View
          style={{ width: 64, alignItems: "center", justifyContent: "center" }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: "hsl(0,0%,18%)",
            }}
          />
        </View>
        <View
          style={{
            flex: 1,
            borderTopWidth: i === 0 ? 0 : 1,
            borderColor: "hsl(0,0%,14%)",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: "white",
              fontSize: 16,
              lineHeight: 22,
              fontWeight: "500",
            }}
          >
            {item.label}
          </Text>
          <Text style={{ color: textDimmed, fontSize: 12, lineHeight: 15 }}>
            {item.description}
          </Text>
        </View>
      </Pressable>
    ))}
  </View>
);

const NewOpen = () => <View />;
const NewClosed = () => <View />;

const SignInView = ({ onSuccess, onError }) => (
  // Web login for now
  <WebView
    incognito
    source={{ uri: WEB_APP_ENDPOINT }}
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
    if (this.state.errorInfo) {
      // Error path
      return (
        <View>
          <Text>Something went wrong.</Text>
          <Text>{this.state.error && this.state.error.toString()}</Text>
          <Text>{this.state.errorInfo.componentStack}</Text>
        </View>
      );
    }

    // Normally, just render children
    return this.props.children;
  }
}

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

  if (initialState == "not-set") return null;

  return (
    <ErrorBoundary>
      <WagmiConfig client={wagmiClient}>
        <SafeAreaProvider>
          <NavigationContainer
            initialState={initialState}
            onStateChange={(state) => {
              AsyncStorage.setItem(
                NAVIGATION_STATE_STORAGE_KEY,
                JSON.stringify(state)
              );
            }}
            theme={ReactNavigationDarkTheme}
          >
            <AuthProvider apiOrigin={API_ENDPOINT} tokenStorage={AsyncStorage}>
              <AppScopeProvider>
                <ServerConnectionProvider
                  Pusher={Pusher}
                  pusherKey={PUSHER_KEY}
                >
                  <App />
                </ServerConnectionProvider>
              </AppScopeProvider>
            </AuthProvider>
          </NavigationContainer>
        </SafeAreaProvider>
      </WagmiConfig>
    </ErrorBoundary>
  );
};
