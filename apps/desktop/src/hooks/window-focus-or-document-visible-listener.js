import React from "react";

const useWindowFocusOrDocumentVisibleListener = (handler) => {
  const handlerRef = React.useRef(handler);

  React.useEffect(() => {
    handlerRef.current = handler;
  });

  React.useEffect(() => {
    const handler = () => {
      handlerRef.current();
    };
    window.addEventListener("focus", handler);
    return () => {
      window.removeEventListener("focus", handler);
    };
  }, []);

  React.useEffect(() => {
    const handler = () => {
      if (document.visibilityState !== "visible") return;
      handlerRef.current();
    };

    document.addEventListener("visibilitychange", handler);
    return () => {
      document.removeEventListener("visibilitychange", handler);
    };
  }, []);
};

export default useWindowFocusOrDocumentVisibleListener;
