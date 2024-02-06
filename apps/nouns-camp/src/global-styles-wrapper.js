"use client";

import React from "react";
import { Global as EmotionGlobal, css } from "@emotion/react";
import config from "./config.js";
import useSetting from "./hooks/setting.js";

const SnowOverlay = React.lazy(() => import("./snow.js"));

const GlobalStyles = ({ children }) => {
  const [zoomSetting] = useSetting("zoom");
  const [xmasEffectsOptOut] = useSetting("xmas-effects-opt-out");

  const [isClient, setIsClient] = React.useState(
    false
    // () => typeof window !== "undefined"
  );

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    // <Global /> is broken
    // https://github.com/emotion-js/emotion/issues/2928
    <div
      css={(t) =>
        css({
          color: t.colors.textNormal,
          background: t.colors.backgroundPrimary,
          "::selection": {
            background: t.colors.textSelectionBackground,
          },
          colorScheme: t.colorScheme ?? "light",
        })
      }
      style={{
        width: "100%",
        height: "100%",
        // Hack to prevent flash of incorrect theme
        opacity: isClient ? 1 : 0,
        transition: "0.1s opacity ease-out",
      }}
    >
      {children}
      <EmotionGlobal
        styles={(t) =>
          css({
            html: {
              fontSize: {
                tiny: "0.546875em",
                small: "0.5859375em",
                large: "0.6640625em",
                huge: "0.703125em",
              }[zoomSetting],
            },
            body: {
              fontFamily: t.fontStacks.default,
            },
          })
        }
      />
      {config["xmas-effects"] && !xmasEffectsOptOut && <SnowOverlay />}
    </div>
  );
};

export default function GlobalStylesWrapper({ children }) {
  return <GlobalStyles>{children}</GlobalStyles>;
}
