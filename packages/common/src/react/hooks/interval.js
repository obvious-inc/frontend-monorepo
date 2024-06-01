import React from "react";

const useInterval = (
  callback,
  { delay, requireVisibile, requireOnline } = {},
) => {
  const callbackRef = React.useRef(callback);

  React.useEffect(() => {
    callbackRef.current = callback;
  });

  React.useEffect(() => {
    // Don't schedule if no delay is specified.
    if (delay == null || delay === 0) return;

    let id;

    const set = () => {
      if (id != null) clearInterval(id);
      id = setInterval(() => {
        callbackRef.current();
      }, delay);
    };

    const pause = () => {
      clearInterval(id);
      id = null;
    };

    const visibilityChangeHandler = () => {
      if (document.visibilityState === "visible") {
        set();
        return;
      }

      pause();
    };

    if (requireVisibile)
      window.addEventListener("visibilitychange", visibilityChangeHandler);

    if (requireOnline) {
      window.addEventListener("online", set);
      window.addEventListener("offline", pause);
      if (window.navigator.onLine) {
        set();
      }
    } else {
      set();
    }

    return () => {
      clearInterval(id);
      window.removeEventListener(
        "visibilityChangeHandler",
        visibilityChangeHandler,
      );
      window.removeEventListener("online", set);
      window.removeEventListener("offline", pause);
    };
  }, [delay, requireVisibile, requireOnline]);
};

export default useInterval;
