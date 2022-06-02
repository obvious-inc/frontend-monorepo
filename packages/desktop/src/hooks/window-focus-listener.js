import React from "react";

const useWindowFocusListener = (handler) => {
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
};

export default useWindowFocusListener;
