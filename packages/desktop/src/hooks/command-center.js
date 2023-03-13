import React from "react";
import useKeyboardShortcuts from "./keyboard-shortcuts";

const Context = React.createContext();

const useCommandCenter = () => React.useContext(Context);

export const Provider = ({ children }) => {
  const [{ isOpen, query, mode }, setState] = React.useState({
    isOpen: false,
    query: "",
    mode: "default",
  });

  const open = ({ mode } = {}) => {
    setState((s) => ({ ...s, mode: mode ?? "default", isOpen: true }));
  };

  const close = () => {
    setState((s) => ({ ...s, query: "", isOpen: false }));
  };

  const onQueryChange = (q) => {
    setState((s) => ({ ...s, query: q }));
  };

  useKeyboardShortcuts({
    "$mod+K": () => {
      setState((s) => ({
        isOpen: !s.isOpen,
        query: "",
        mode: "default",
      }));
    },
  });

  const contextValue = { mode, isOpen, query, onQueryChange, open, close };

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};

export default useCommandCenter;
