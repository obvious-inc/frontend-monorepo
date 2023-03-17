import React from "react";

const usePageVisibilityListener = (handler) => {
  const handlerRef = React.useRef(handler);

  React.useEffect(() => {
    handlerRef.current = handler;
  });

  React.useEffect(() => {
    const handler = () => {
      handlerRef.current(document.visibilityState);
    };
    window.addEventListener("visibilitychange", handler);
    return () => {
      window.removeEventListener("visibilitychange", handler);
    };
  }, []);
};

export default usePageVisibilityListener;
