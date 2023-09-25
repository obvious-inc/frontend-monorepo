import React from "react";

const Context = React.createContext();

const useApi = () => React.useContext(Context);

export const Provider = ({ api, ...props }) => (
  <Context.Provider value={api} {...props} />
);

export default useApi;
