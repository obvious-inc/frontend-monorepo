import React from "react";
import { createRoot } from "react-dom/client";
import { CacheStoreProvider } from "@shades/common/app";
import { ChainDataCacheContextProvider } from "./hooks/farcord.js";
import "./reset.css";
import "./index.css";

const LazyApp = React.lazy(() => import("./app"));

const App = () => {
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

createRoot(document.getElementById("app-mount")).render(
  <React.StrictMode>
    <ChainDataCacheContextProvider>
      <CacheStoreProvider syncStorage={cacheStoreStorage}>
        <App />
      </CacheStoreProvider>
    </ChainDataCacheContextProvider>
  </React.StrictMode>
);
