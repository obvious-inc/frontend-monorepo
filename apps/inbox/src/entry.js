import React from "react";
import { createRoot } from "react-dom/client";
import {
  array as arrayUtils,
  function as functionUtils,
} from "@shades/common/utils";
import {
  AuthProvider,
  AppStoreProvider,
  CacheStoreProvider,
  useAuth,
  useActions,
} from "@shades/common/app";
import "./reset.css";
import "./index.css";

const { unique } = arrayUtils;
const { waterfall } = functionUtils;

const LazyApp = React.lazy(() => import("./app"));

const App = () => {
  const { status: authStatus } = useAuth();
  const actions = useActions();

  const { fetchClientBootData, fetchUsers, fetchMessages } = actions;

  React.useEffect(() => {
    if (authStatus !== "authenticated") return;

    fetchClientBootData().then(({ channels }) => {
      const dmUserIds = unique(
        channels.filter((c) => c.kind === "dm").flatMap((c) => c.memberUserIds)
      );
      fetchUsers(dmUserIds);

      waterfall(
        channels.map((c) =>
          Promise.all([
            fetchMessages(c.id, { limit: 1 }),
            fetchUsers(c.memberUserIds.slice(0, 3)),
          ])
        )
      );
    });
  }, [authStatus, fetchClientBootData, fetchUsers, fetchMessages]);

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

const container = document.getElementById("app-mount");

createRoot(container).render(
  <React.StrictMode>
    <CacheStoreProvider syncStorage={cacheStoreStorage}>
      <AuthProvider apiOrigin="/api">
        <AppStoreProvider
          cloudflareAccountHash={process.env.CLOUDFLARE_ACCT_HASH}
        >
          <App />
        </AppStoreProvider>
      </AuthProvider>
    </CacheStoreProvider>
  </React.StrictMode>
);
