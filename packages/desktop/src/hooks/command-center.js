import React from "react";
import useKeyboardShortcuts from "./keyboard-shortcuts";

const Context = React.createContext();

const useCommandCenter = () => React.useContext(Context);

export const Provider = ({ children }) => {
  const [isOpen, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const open = () => {
    setOpen(true);
  };

  const close = () => {
    setQuery("");
    setOpen(false);
  };

  const onQueryChange = (q) => {
    setQuery(q);
  };

  useKeyboardShortcuts({
    "$mod+K": () => {
      setOpen((isOpen) => {
        if (isOpen) setQuery("");
        return !isOpen;
      });
    },
  });

  const contextValue = { isOpen, query, onQueryChange, open, close };

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};

export default useCommandCenter;
