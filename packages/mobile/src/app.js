import Constants from "expo-constants";
import React from "react";
import { View, useWindowDimensions } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createDrawerNavigator } from "@react-navigation/drawer";
import { WebView } from "react-native-webview";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Pusher from "pusher-js/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Shades from "@shades/common";
import Channel from "./screens/channel";

const { unique } = Shades.utils.array;
const {
  AuthProvider,
  useAuth,
  ServerConnectionProvider,
  useAppScope,
  AppScopeProvider,
} = Shades.app;

const API_ENDPOINT = Constants.expoConfig.extra.apiEndpoint;
const WEB_APP_ENDPOINT = Constants.expoConfig.extra.webAppEndpoint;
const PUSHER_KEY = Constants.expoConfig.extra.pusherKey;

const Drawer = createDrawerNavigator();

const createDrawerScreenOptions = ({ dimensions }) => ({
  headerShown: false,
  drawerType: "back",
  swipeEdgeWidth: dimensions.width,
  swipeMinDistance: Math.floor(dimensions.width / 2),
  drawerStyle: {
    backgroundColor: "hsl(0, 0%, 8%)",
    width: dimensions.width - Math.floor(dimensions.width / 5),
  },
  drawerInactiveTintColor: "hsla(0, 0%, 100%, 0.5)",
  drawerActiveTintColor: "#fff",
  drawerActiveBackgroundColor: "hsla(0, 0%, 100%, 0.08)",
  drawerItemStyle: {
    borderRadius: 6,
    margin: 0,
    paddingVertical: 0,
    paddingHorizontal: 6,
  },
  drawerLabelStyle: {
    paddingVertical: 0,
    margin: 0,
  },
});

const App = () => {
  const dimensions = useWindowDimensions();

  const { status: authStatus, setAccessToken } = useAuth();
  const { state, actions } = useAppScope();

  const {
    fetchClientBootData,
    fetchUsers,
    // fetchUserChannels,
    // fetchUserChannelsReadStates,
    // fetchStarredItems,
  } = actions;

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

  if (authStatus === "not-authenticated")
    return (
      <SignInView
        onSuccess={(token) => {
          setAccessToken(token);
        }}
      />
    );

  // Loading screen
  if (authStatus === "loading" || user == null || channels.length === 0)
    return <View style={{ backgroundColor: "hsl(0,0%,8%)", flex: 1 }} />;

  return (
    <Drawer.Navigator
      initialRouteName={channels[0].name}
      screenOptions={createDrawerScreenOptions({ dimensions })}
    >
      {channels.map((c) => (
        <Drawer.Screen
          key={c.id}
          name={[c.name, c.id].join(":")}
          component={Channel}
          initialParams={{ channelId: c.id }}
          options={{ title: c.name }}
        />
      ))}
    </Drawer.Navigator>
  );
};

const SignInView = ({ onSuccess }) => (
  // Web login for now
  <WebView
    incognito
    source={{ uri: WEB_APP_ENDPOINT }}
    onMessage={(e) => {
      const accessToken = e.nativeEvent.data;
      if (accessToken != null) onSuccess(accessToken);
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
        <div>
          <h2>Something went wrong.</h2>
          <details style={{ whiteSpace: "pre-wrap" }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    // Normally, just render children
    return this.props.children;
  }
}

export default () => (
  <ErrorBoundary>
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
  </ErrorBoundary>
);
