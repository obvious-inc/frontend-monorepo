import React from "react";
import useMatchMedia from "../hooks/match-media";

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
