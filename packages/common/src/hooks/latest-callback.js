import React from "react";

const useLatestCallback = (callback) => {
  const callbackRef = React.useRef(callback);

  React.useEffect(() => {
    callbackRef.current = callback;
  });

  return React.useCallback((...args) => callbackRef.current(...args), []);
};

export default useLatestCallback;
