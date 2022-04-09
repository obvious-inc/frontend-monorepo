import React from "react";

const useMatchMedia = (query) => {
  const [matches, setMatches] = React.useState(() => matchMedia(query).matches);

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

const Context = React.createContext();

export const useSideMenuState = () => React.useContext(Context);

export const Provider = ({ children }) => {
  const floatMenu = useMatchMedia("(max-width: 800px)");

  const [isCollapsed, setCollapsed] = React.useState(floatMenu);

  const toggle = React.useCallback((collapse) => {
    if (collapse != null) {
      setCollapsed(collapse);
      return;
    }

    setCollapsed((c) => !c);
  }, []);

  React.useEffect(() => {
    setCollapsed(floatMenu);
  }, [floatMenu]);

  const contextValue = React.useMemo(
    () => ({ isFloating: floatMenu, isCollapsed, toggle }),
    [floatMenu, isCollapsed, toggle]
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};

const useSideMenu = () => React.useContext(Context);

export default useSideMenu;
