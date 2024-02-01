import React from "react";

const useMutationObserver = (elementRef, handler, options) => {
  const optionsRef = React.useRef(options);
  const handlerRef = React.useRef(handler);

  React.useEffect(() => {
    handlerRef.current = handler;
    optionsRef.current = options;
  });

  React.useEffect(() => {
    const observer = new MutationObserver((...args) => {
      handlerRef.current(...args);
    });

    observer.observe(elementRef.current, optionsRef.current);

    return () => {
      observer.disconnect();
    };
  }, [elementRef]);
};

export default useMutationObserver;
