import React from "react";

const Context = React.createContext();

export const Provider = ({ children }) => {
  const [openDialogs, setOpenDialogs] = React.useState(new Map());

  const contextValue = React.useMemo(
    () => ({ openDialogs, setOpenDialogs }),
    [openDialogs]
  );

  return <Context.Provider value={contextValue}>{children}</Context.Provider>;
};

export const useDialog = (key) => {
  const { openDialogs, setOpenDialogs } = React.useContext(Context);

  const open = React.useCallback(
    (data) => {
      setOpenDialogs((prev) => {
        const next = new Map(prev);
        next.set(key, data ?? true);
        return next;
      });
    },
    [key, setOpenDialogs]
  );

  const dismiss = React.useCallback(() => {
    setOpenDialogs((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, [key, setOpenDialogs]);

  const toggle = React.useCallback(() => {
    setOpenDialogs((prev) => {
      const next = new Map(prev);

      if (next.has(key)) {
        next.delete(key);
        return next;
      }

      next.set(key, true);
      return next;
    });
  }, [key, setOpenDialogs]);

  return {
    isOpen: openDialogs.has(key),
    data: openDialogs.get(key),
    open,
    dismiss,
    toggle,
  };
};
