import Constants from "expo-constants";
import {
  WagmiConfig,
  createClient as createWagmiClient,
  configureChains as configureWagmiChains,
} from "wagmi";
import { mainnet as mainnetChain } from "wagmi/chains";
import { infuraProvider } from "wagmi/providers/infura";
import { publicProvider } from "wagmi/providers/public";
import React from "react";
import { View, Text } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
// import { createStackNavigator } from "@react-navigation/stack";
// import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { WebView } from "react-native-webview";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Pusher from "pusher-js/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Shades from "@shades/common";
import Channel from "./screens/channel";
import ChannelList from "./screens/channel-list";

const { unique } = Shades.utils.array;
const {
  AuthProvider,
  useAuth,
  ServerConnectionProvider,
  useAppScope,
  AppScopeProvider,
  useServerConnection,
} = Shades.app;

const API_ENDPOINT = Constants.expoConfig.extra.apiEndpoint;
const WEB_APP_ENDPOINT = Constants.expoConfig.extra.webAppEndpoint;
const PUSHER_KEY = Constants.expoConfig.extra.pusherKey;
const INFURA_PROJECT_ID = Constants.expoConfig.extra.infuraProjectId;

const { provider } = configureWagmiChains(
  [mainnetChain],
  [infuraProvider({ apiKey: INFURA_PROJECT_ID }), publicProvider()]
);

const wagmiClient = createWagmiClient({
  autoConnect: true,
  provider,
  storage: null,
});

const Tab = createMaterialTopTabNavigator();

const App = () => {
  const { status: authStatus, setAccessToken, setRefreshToken } = useAuth();
  const { state, actions, dispatch } = useAppScope();
  const serverConnection = useServerConnection();

  const { fetchClientBootData, fetchUsers } = actions;

  const user = state.selectMe();
  const channels = state.selectMemberChannels();

  React.useEffect(() => {
    if (authStatus !== "authenticated") return;

    fetchClientBootData().then(({ channels }) => {
      const dmUserIds = unique(
        channels.filter((c) => c.kind === "dm").flatMap((c) => c.members)
      );
      fetchUsers(dmUserIds);
    });
  }, [authStatus, fetchClientBootData, fetchUsers]);

  React.useEffect(() => {
    if (authStatus !== "authenticated") return;

    const removeListener = serverConnection.addListener((name, data) => {
      dispatch({ type: ["server-event", name].join(":"), data, user });
    });
    return () => {
      removeListener();
    };
  }, [authStatus, user, serverConnection, dispatch]);

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
  if (authStatus === "loading" || user == null || channels.length === 0)
    return <View style={{ backgroundColor: "hsl(0,0%,8%)", flex: 1 }} />;

  return (
    <Tab.Navigator tabBar={() => null} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Channel list" component={ChannelList} />
      <Tab.Screen
        name="Channel"
        component={Channel}
        initialParams={{ channelId: channels[0].id }}
      />
    </Tab.Navigator>
  );
};

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

export default () => (
  <ErrorBoundary>
    <WagmiConfig client={wagmiClient}>
      <SafeAreaProvider>
        <NavigationContainer>
          <AuthProvider apiOrigin={API_ENDPOINT} tokenStorage={AsyncStorage}>
            <AppScopeProvider>
              <ServerConnectionProvider Pusher={Pusher} pusherKey={PUSHER_KEY}>
                <App />
              </ServerConnectionProvider>
            </AppScopeProvider>
          </AuthProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </WagmiConfig>
  </ErrorBoundary>
);
