import React from "react";

const useScrollToHash = (options) => {
  const didScrollRef = React.useRef(false);

  React.useEffect(() => {
    if (didScrollRef.current || location.hash === "") return;
    const el = document.getElementById(location.hash.slice(1));
    if (el == null) return;
    didScrollRef.current = true;
    el.scrollIntoView(options);
  });
};

export default useScrollToHash;
