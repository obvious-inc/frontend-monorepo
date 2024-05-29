import React from "react";
import invariant from "../../utils/invariant.js";
import useLatestCallback from "./latest-callback.js";
import useInterval from "./interval.js";
import useWindowFocusOrDocumentVisibleListener from "./window-focus-or-document-visible-listener";
import useOnlineListener from "./window-online-listener";

const useFetch = (fetcher_, options_, dependencies_) => {
  const dependencies = dependencies_ ?? options_;

  invariant(Array.isArray(dependencies), "Dependency array required");

  const fetcher = useLatestCallback((args = {}) => fetcher_?.(args));
  const options = dependencies_ == null ? null : options_;

  const enabled = options?.enabled ?? true;

  React.useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetcher({ signal: controller.signal });
    return () => {
      controller.abort();
    };
  }, [enabled, ...dependencies]); // eslint-disable-line

  useInterval(() => fetcher(), {
    delay: enabled ? options?.fetchInterval : null,
    requireOnline: true,
    requireVisibile: true,
  });

  useWindowFocusOrDocumentVisibleListener(() => {
    if (!enabled) return;
    fetcher();
  });

  useOnlineListener(
    () => {
      if (!enabled) return;
      fetcher();
    },
    { requireFocus: true },
  );
};

export default useFetch;
