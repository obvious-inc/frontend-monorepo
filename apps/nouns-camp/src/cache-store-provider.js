"use client";

import React from "react";
import {
  createCacheStore,
  CacheStoreProvider as CacheStoreProvider_,
} from "@shades/common/app";

let cacheStoreStorage;
if (typeof window !== "undefined") {
  try {
    // This might throw in contexts where storage access isn’t allowed
    cacheStoreStorage = window.localStorage;
  } catch (e) {
    console.warn(e);
  }
}

export default function CacheStoreProvider({ children }) {
  return (
    <CacheStoreProvider_
      store={createCacheStore({ storage: cacheStoreStorage })}
    >
      {children}
    </CacheStoreProvider_>
  );
}
