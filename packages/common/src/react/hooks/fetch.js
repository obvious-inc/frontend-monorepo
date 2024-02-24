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

  React.useEffect(() => {
    const controller = new AbortController();
    fetcher({ signal: controller.signal });
    return () => {
      controller.abort();
    };
  }, dependencies); // eslint-disable-line

  useInterval(() => fetcher(), {
    delay: options?.fetchInterval,
    requireOnline: true,
    requireVisibile: true,
  });

  useWindowFocusOrDocumentVisibleListener(() => {
    fetcher();
  });

  useOnlineListener(
    () => {
      fetcher();
    },
    { requireFocus: true }
  );
};

export default useFetch;
