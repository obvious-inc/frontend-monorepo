import Pusher from "pusher-js";
import React from "react";
import { createRoot } from "react-dom/client";
import {
  createCacheStore,
  AppStoreProvider,
  CacheStoreProvider,
  useAuth,
  useActions,
} from "@shades/common/app";
import * as apis from "@shades/common/apis";
import { array as arrayUtils } from "@shades/common/utils";
import "./reset.css";
import "./index.css";

const LazyApp = React.lazy(() => import("./app"));

const App = () => {
  const { status: authStatus } = useAuth();
  const actions = useActions();

  const { fetchClientBootData, fetchPreferences, fetchChannelMembers } =
    actions;

  React.useEffect(() => {
    if (authStatus !== "authenticated") return;
    fetchClientBootData("private-only").then(({ channels }) => {
      fetchPreferences();

      const dmChannelIds = arrayUtils.unique(
        channels.filter((c) => c.kind === "dm").map((c) => c.id)
      );
      for (const id of dmChannelIds) fetchChannelMembers(id);
    });
  }, [authStatus, fetchClientBootData, fetchPreferences, fetchChannelMembers]);

  return (
    <React.Suspense fallback={null}>
      <LazyApp />
    </React.Suspense>
  );
};

let cacheStoreStorage;
try {
  // This might throw in contexts where storage access isn’t allowed
  cacheStoreStorage = window.localStorage;
} catch (e) {
  console.warn(e);
}

const cacheStore = createCacheStore({ storage: cacheStoreStorage });

const api = apis.nomLegacy({
  apiOrigin: "/api",
  cloudflareAccountHash: process.env.CLOUDFLARE_ACCT_HASH,
  cacheStore,
  Pusher,
  pusherKey: process.env.PUSHER_KEY,
});

const container = document.getElementById("app-mount");

createRoot(container).render(
  <React.StrictMode>
    <CacheStoreProvider store={cacheStore}>
      <AppStoreProvider api={api}>
        <App />
      </AppStoreProvider>
    </CacheStoreProvider>
  </React.StrictMode>
);
