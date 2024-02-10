import React from "react";

const useMatchMedia = (query) => {
  const [matches, setMatches] = React.useState(
    () => typeof matchMedia !== "undefined" && matchMedia(query).matches
  );

  React.useEffect(() => {
    const mediaQueryList = matchMedia(query);
    const onChange = (event) => {
      setMatches(event.matches);
    };

    mediaQueryList.addListener(onChange);
    return () => {
      mediaQueryList.removeListener(onChange);
    };
  }, [matches, query]);

  return matches;
};

export default useMatchMedia;
