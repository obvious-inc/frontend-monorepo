import React from "react";

const useWindowOnlineListener = (handler) => {
  const handlerRef = React.useRef(handler);

  React.useEffect(() => {
    handlerRef.current = handler;
  });

  React.useEffect(() => {
    const handler = () => {
      handlerRef.current();
    };
    window.addEventListener("online", handler);
    return () => {
      window.removeEventListener("online", handler);
    };
  }, []);
};

export default useWindowOnlineListener;
