import React from "react";
import { array as arrayUtils } from "@shades/common/utils";
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
    key: "vote-overview",
    search: true,
    component: ReactLazyWithPreload(
      () => import("../components/proposal-votes-dialog.js"),
    ),
  },
  {
    key: "treasury",
    search: true,
    component: ReactLazyWithPreload(
      () => import("../components/treasury-dialog.js"),
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
    key: "drafts",
    component: ReactLazyWithPreload(
      () => import("../components/proposal-or-topic-drafts-dialog.js"),
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

const dialogsByKey = arrayUtils.indexBy((d) => d.key, dialogs);

const preload = (key) => {
  const { component } = dialogsByKey[key];
  return component.preload();
};

export const Provider = ({ children }) => {
  const [openLocalDialogs, setOpenLocalDialogs] = React.useState(new Map());

  const [searchParams, setSearchParams] = useSearchParams();

  const openDialogs = React.useMemo(() => {
    return dialogs.reduce((dialogMap, d) => {
      const dialogState = d.search
        ? searchParams.get(d.key)
        : openLocalDialogs.get(d.key);
      if (dialogState == null) return dialogMap;
      dialogMap.set(d.key, dialogState);
      return dialogMap;
    }, new Map());
  }, [searchParams, openLocalDialogs]);

  const open = React.useCallback(
    (key, data) => {
      const dialogConfig = dialogsByKey[key];
      if (dialogConfig.search) {
        setSearchParams(
          (currentParams) => {
            const nextParams = new URLSearchParams(currentParams);
            nextParams.set(key, data ?? 1);
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
    (key, options) => {
      const dialogConfig = dialogsByKey[key];
      if (dialogConfig.search) {
        setSearchParams(
          (currentParams) => {
            const nextParams = new URLSearchParams(currentParams);
            nextParams.delete(key);
            return options?.onSetSearchParams?.(nextParams) ?? nextParams;
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
      const dialogConfig = dialogsByKey[key];
      if (dialogConfig.search) {
        setSearchParams(
          (currentParams) => {
            const nextParams = new URLSearchParams(currentParams);
            if (nextParams.has(key)) {
              nextParams.delete(key);
              return nextParams;
            }
            nextParams.set(key, 1);
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
          return (
            <DialogComponent
              key={key}
              isOpen
              close={(options) => close(key, options)}
            />
          );
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
    close: React.useCallback((options) => close(key, options), [close, key]),
    toggle: React.useCallback(() => toggle(key), [toggle, key]),
    preload: React.useCallback(() => preload(key), [preload, key]),
  };
};
