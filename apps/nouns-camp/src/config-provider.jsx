"use client";

import React from "react";

const Context = React.createContext();

const Provider = ({ config, children }) => (
  <Context.Provider value={config}>{children}</Context.Provider>
);

export const useConfig = () => React.useContext(Context);

export default Provider;
