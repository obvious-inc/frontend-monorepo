import React from "react";
import { useMatchMedia } from "@shades/common/react";

const Context = React.createContext({});

export const Provider = ({ children }) => {
  const inputDeviceCanHover = useMatchMedia("(hover: hover)");
  const contextValue = React.useMemo(
    () => ({ inputDeviceCanHover }),
    [inputDeviceCanHover]
  );
  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};

const useGlobalMediaQueries = () => React.useContext(Context);

export default useGlobalMediaQueries;
