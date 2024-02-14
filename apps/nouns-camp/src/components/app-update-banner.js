"use client";

import React from "react";
import { css } from "@emotion/react";
import { useFetch } from "@shades/common/react";
import Link from "@shades/ui-web/link";
import { Cross as CrossIcon } from "@shades/ui-web/icons";
import { useConfig } from "../config-provider.js";
import { useWallet } from "../hooks/wallet.js";

const isBetaSession =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).get("beta") != null;

const AppUpdateBanner = () => {
  const { buildId } = useConfig();
  const { isBetaAccount } = useWallet();

  const [isDismissed, setDismissed] = React.useState(false);
  const [hasUpdate, setHasUpdate] = React.useState(false);

  useFetch(
    () =>
      fetch("/", { method: "HEAD" }).then((res) => {
        const newBuildId = res.headers.get("x-build-id");
        if (buildId == null || buildId === newBuildId) return;
        console.log(
          `New build available: "${newBuildId}"\nCurrently running: "${buildId}"`
        );
        setHasUpdate(true);
      }),
    [buildId]
  );

  const showBanner = hasUpdate && !isDismissed;
  const isBeta = isBetaAccount || isBetaSession;

  if (!isBeta || !showBanner) return null;

  return (
    <div
      css={(t) =>
        css({
          position: "fixed",
          zIndex: 1,
          width: "100%",
          background: t.colors.backgroundPrimary,
        })
      }
    >
      <div
        css={(t) =>
          css({
            color: t.colors.textAccent,
            display: "flex",
            alignItems: "center",
            padding: "0.8rem 1.2rem",
            background: t.colors.primaryTransparent,
            fontSize: t.text.sizes.small,
            minHeight: "3.8rem",
            transition: "0.25s all ease-out",
          })
        }
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          New version of Camp available.{" "}
          <Link
            underline
            component="button"
            onClick={() => {
              location.reload();
            }}
          >
            Click here to update
          </Link>
        </div>
        <button
          onClick={() => {
            setDismissed(true);
          }}
          style={{ padding: "0.8rem", margin: "-0.8rem", cursor: "pointer" }}
        >
          <CrossIcon
            style={{ width: "1.5rem", height: "auto", margin: "auto" }}
          />
        </button>
      </div>
    </div>
  );
};

export default AppUpdateBanner;
