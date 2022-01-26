import React from "react";

const GlobalStateContext = React.createContext({});

const useGlobalState = () => React.useContext(GlobalStateContext);

export const Provider = GlobalStateContext.Provider;

export default useGlobalState;
