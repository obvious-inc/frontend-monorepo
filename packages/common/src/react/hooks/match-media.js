import React from "react";

const useMatchMedia = (query, { clientOnly = false } = {}) => {
  const [matches, setMatches] = React.useState(() => {
    if (!clientOnly) return null;
    return matchMedia(query).matches;
  });

  React.useLayoutEffect(() => {
    if (clientOnly) return;
    setMatches(matchMedia(query).matches);
  }, [clientOnly, query]);

  React.useEffect(() => {
    const mediaQueryList = matchMedia(query);
    const onChange = () => {
      setMatches(mediaQueryList.matches);
    };
    mediaQueryList.addEventListener("change", onChange);
    return () => {
      mediaQueryList.removeEventListener("change", onChange);
    };
  }, [matches, query]);

  return matches;
};

export default useMatchMedia;
