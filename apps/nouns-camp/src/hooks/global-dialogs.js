import React from "react";
import { useSearchParams } from "./navigation.js";

const ReactLazyWithPreload = (fetcher) => {
  const LazyComponent = React.lazy(fetcher);
  LazyComponent.preload = fetcher;
  return LazyComponent;
};

const Context = React.createContext();

const dialogs = [
  {
    key: "auction",
    search: true,
    component: ReactLazyWithPreload(
      () => import("../components/auction-dialog.js"),
    ),
  },
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

const searchParamDialogKeys = dialogs.filter((d) => d.search).map((d) => d.key);

const preload = (key) => {
  const { component } = dialogs.find((d) => d.key === key);
  return component.preload();
};

export const Provider = ({ children }) => {
  const [openLocalDialogs, setOpenLocalDialogs] = React.useState(new Map());

  const [searchParams, setSearchParams] = useSearchParams();

  const openSearchParamsDialogKey = searchParams.get("dialog");

  const openDialogs = React.useMemo(() => {
    if (
      openSearchParamsDialogKey == null ||
      searchParamDialogKeys.every((key) => key != openSearchParamsDialogKey)
    )
      return openLocalDialogs;

    const openDialogs = new Map(openLocalDialogs);
    openDialogs.set(openSearchParamsDialogKey, true);
    return openDialogs;
  }, [openLocalDialogs, openSearchParamsDialogKey]);

  const open = React.useCallback(
    (key, data) => {
      if (searchParamDialogKeys.includes(key)) {
        setSearchParams(
          (currentParams) => {
            const nextParams = new URLSearchParams(currentParams);
            nextParams.set("dialog", key);
            return nextParams;
          },
          { replace: true },
        );
        return;
      }
      setOpenLocalDialogs((prev) => {
        const next = new Map(prev);
        next.set(key, data ?? true);
        return next;
      });
    },
    [setOpenLocalDialogs, setSearchParams],
  );

  const close = React.useCallback(
    (key) => {
      if (searchParamDialogKeys.includes(key)) {
        setSearchParams(
          (currentParams) => {
            const nextParams = new URLSearchParams(currentParams);
            nextParams.delete("dialog");
            return nextParams;
          },
          { replace: true },
        );
        return;
      }
      setOpenLocalDialogs((current) => {
        const next = new Map(current);
        next.delete(key);
        return next;
      });
    },
    [setOpenLocalDialogs, setSearchParams],
  );

  const toggle = React.useCallback(
    (key) => {
      if (searchParamDialogKeys.includes(key)) {
        setSearchParams(
          (currentParams) => {
            const nextParams = new URLSearchParams(currentParams);
            if (nextParams.get("dialog") === key) {
              nextParams.delete("dialog");
              return nextParams;
            }
            nextParams.set("dialog", key);
            return nextParams;
          },
          { replace: true },
        );
        return;
      }
      setOpenLocalDialogs((current) => {
        const next = new Map(current);

        if (next.has(key)) {
          next.delete(key);
          return next;
        }

        next.set(key, true);
        return next;
      });
    },
    [setOpenLocalDialogs, setSearchParams],
  );

  const contextValue = React.useMemo(
    () => ({ openDialogs, open, close, toggle, preload }),
    [openDialogs, open, close, toggle],
  );

  return (
    <Context.Provider value={contextValue}>
      {children}
      <React.Suspense fallback={null}>
        {dialogs.map(({ key, component: DialogComponent }) => {
          if (!openDialogs.has(key)) return null;
          return <DialogComponent key={key} isOpen close={() => close(key)} />;
        })}
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
