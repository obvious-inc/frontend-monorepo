import React from "react";
import useLatestCallback from "./latest-callback.js";
import useWindowFocusOrDocumentVisibleListener from "./window-focus-or-document-visible-listener";
import useOnlineListener from "./window-online-listener";

const useFetch = (fetcher_, dependencies) => {
  const fetcher = useLatestCallback(() => fetcher_?.());

  React.useEffect(() => {
    fetcher();
  }, dependencies); // eslint-disable-line

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
