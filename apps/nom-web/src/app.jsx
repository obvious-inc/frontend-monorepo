import Pusher from "pusher-js";
import React from "react";
import {
  createCacheStore,
  AppStoreProvider,
  CacheStoreProvider,
  useAuth,
  useActions,
  useAfterActionListener,
} from "@shades/common/app";
import {
  useWindowFocusOrDocumentVisibleListener,
  useWindowOnlineListener,
  ErrorBoundary,
} from "@shades/common/react";
import { array as arrayUtils, reloadPageOnce } from "@shades/common/utils";
import * as apis from "@shades/common/apis";

const LazyApp = React.lazy(() => import("./app-lazy"));

const useIFrameMessenger = () => {
  useAfterActionListener(
    window === window.parent
      ? null
      : (action) => {
          window.parent.postMessage({ action }, "*");
        },
  );
};

const App = () => {
  const { status: authStatus } = useAuth();
  const actions = useActions();

  const {
    fetchClientBootData,
    fetchUserChannels,
    fetchUserChannelsReadStates,
    fetchStarredItems,
    fetchPubliclyReadableChannels,
    fetchPreferences,
    fetchUsers,
  } = actions;

  useIFrameMessenger();

  React.useEffect(() => {
    if (authStatus !== "authenticated") return;
    fetchClientBootData().then(({ user: me, channels }) => {
      if (channels.length <= 1) fetchPubliclyReadableChannels();

      fetchPreferences();

      // Fetch the first 3 users for each DM so that we can render avatars
      fetchUsers(
        arrayUtils.unique(
          channels
            .filter((c) => c.kind === "dm")
            .flatMap((c) =>
              c.memberUserIds.filter((id) => id !== me.id).slice(0, 3),
            ),
        ),
      );
    });
  }, [
    authStatus,
    fetchClientBootData,
    fetchPubliclyReadableChannels,
    fetchPreferences,
    fetchUsers,
  ]);

  React.useEffect(() => {
    if (authStatus === "not-authenticated") fetchPubliclyReadableChannels();
  }, [authStatus, fetchPubliclyReadableChannels]);

  useWindowFocusOrDocumentVisibleListener(() => {
    if (authStatus !== "authenticated") return;
    fetchUserChannels();
    fetchUserChannelsReadStates();
    fetchStarredItems();
  });

  useWindowOnlineListener(
    () => {
      if (authStatus !== "authenticated") return;
      fetchUserChannels();
      fetchUserChannelsReadStates();
      fetchStarredItems();
    },
    { requireFocus: true },
  );

  return (
    <ErrorBoundary
      onError={() => {
        reloadPageOnce();
      }}
    >
      <React.Suspense fallback={null}>
        <LazyApp />
      </React.Suspense>
    </ErrorBoundary>
  );
};

const cacheStore = createCacheStore({
  namespace: "nom",
  storage: window.localStorage,
});

const api = apis.nomLegacy({
  apiOrigin: "/api",
  cloudflareAccountHash: import.meta.env.PUBLIC_CLOUDFLARE_ACCOUNT_HASH,
  cacheStore,
  Pusher,
  pusherKey: import.meta.env.PUBLIC_PUSHER_KEY,
});

export default function Root() {
  return (
    <React.StrictMode>
      <CacheStoreProvider store={cacheStore}>
        <AppStoreProvider api={api}>
          <App />
        </AppStoreProvider>
      </CacheStoreProvider>
    </React.StrictMode>
  );
}
