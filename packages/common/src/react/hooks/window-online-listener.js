import React from "react";

const useWindowOnlineListener = (handler, { requireFocus = false } = {}) => {
  const handlerRef = React.useRef(handler);

  React.useEffect(() => {
    handlerRef.current = handler;
  });

  React.useEffect(() => {
    if (requireFocus && !document.hasFocus()) return;

    const handler = () => {
      handlerRef.current();
    };
    window.addEventListener("online", handler);
    return () => {
      window.removeEventListener("online", handler);
    };
  }, [requireFocus]);
};

export default useWindowOnlineListener;
