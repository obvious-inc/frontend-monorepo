import React from "react";

const ReactLazyWithPreload = (fetcher) => {
  const LazyComponent = React.lazy(fetcher);
  LazyComponent.preload = fetcher;
  return LazyComponent;
};

const Context = React.createContext();

const dialogs = [
  {
    key: "account",
    component: ReactLazyWithPreload(
      () => import("../components/account-dialog.js"),
    ),
  },
  {
    key: "delegation",
    component: ReactLazyWithPreload(
      () => import("../components/delegation-dialog.js"),
    ),
  },
  {
    key: "proposal-drafts",
    component: ReactLazyWithPreload(
      () => import("../components/proposal-drafts-dialog.js"),
    ),
  },
  {
    key: "settings",
    component: ReactLazyWithPreload(
      () => import("../components/settings-dialog.js"),
    ),
  },
  {
    key: "account-authentication",
    component: ReactLazyWithPreload(
      () => import("../components/account-authentication-dialog.js"),
    ),
  },
  {
    key: "farcaster-setup",
    component: ReactLazyWithPreload(
      () => import("../components/farcaster-setup-dialog.js"),
    ),
  },
  {
    key: "streams",
    component: ReactLazyWithPreload(
      () => import("../components/streams-dialog.js"),
    ),
  },
];

const preload = (key) => {
  const { component } = dialogs.find((d) => d.key === key);
  return component.preload();
};

export const Provider = ({ children }) => {
  const [openDialogs, setOpenDialogs] = React.useState(new Map());

  const open = React.useCallback(
    (key, data) => {
      setOpenDialogs((prev) => {
        const next = new Map(prev);
        next.set(key, data ?? true);
        return next;
      });
    },
    [setOpenDialogs],
  );

  const close = React.useCallback(
    (key) => {
      setOpenDialogs((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    },
    [setOpenDialogs],
  );

  const toggle = React.useCallback(
    (key) => {
      setOpenDialogs((prev) => {
        const next = new Map(prev);

        if (next.has(key)) {
          next.delete(key);
          return next;
        }

        next.set(key, true);
        return next;
      });
    },
    [setOpenDialogs],
  );

  const contextValue = React.useMemo(
    () => ({ openDialogs, open, close, toggle, preload }),
    [openDialogs, open, close, toggle],
  );

  return (
    <Context.Provider value={contextValue}>
      {children}
      <React.Suspense fallback={null}>
        {dialogs.map(({ key, component: DialogComponent }) =>
          openDialogs.has(key) ? (
            <DialogComponent
              key={key}
              isOpen={openDialogs.has(key)}
              close={() => close(key)}
            />
          ) : null,
        )}
      </React.Suspense>
    </Context.Provider>
  );
};

export const useDialog = (key) => {
  const { openDialogs, open, close, toggle, preload } =
    React.useContext(Context);
  return {
    isOpen: openDialogs.has(key),
    data: openDialogs.get(key),
    open: React.useCallback((data) => open(key, data), [open, key]),
    close: React.useCallback(() => close(key), [close, key]),
    toggle: React.useCallback(() => toggle(key), [toggle, key]),
    preload: React.useCallback(() => preload(key), [preload, key]),
  };
};
