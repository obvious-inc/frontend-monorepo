import Script from "next/script";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import EmotionRootStyleRegistry from "./emotion-style-root-registry.js";
import metaConfig from "../metadata-config.js";
import CacheStoreProvider from "../cache-store-provider.js";
import ThemeProvider from "../theme-provider.js";
import GlobalStylesWrapper from "../global-styles-wrapper.js";
import AppUpdateBanner from "../components/app-update-banner.js";

import "../reset.css";
import "../index.css";

import "../snow.css";

const isProduction = process.env.NODE_ENV === "production";

const title = metaConfig.appTitle;
const description = metaConfig.appDescription;
const url = metaConfig.canonicalAppBasename;

export const metadata = {
  metadataBase: metaConfig.canonicalAppBasename,
  title: {
    template: metaConfig.titleTemplate,
    default: metaConfig.appTitle,
  },
  description,
  alternates: { canonical: metaConfig.canonicalAppBasename },
  openGraph: {
    type: metaConfig.openGraphType,
    siteName: metaConfig.openGraphSiteName,
    title,
    description,
    url,
  },
  twitter: {
    card: metaConfig.twitterCard,
    title,
    description,
    url,
  },
  appleWebApp: {
    title: metaConfig.appTitle,
    statusBarStyle: metaConfig.appleWebAppStatusBarStyle,
  },
};

export const viewport = {
  themeColor: metaConfig.viewportThemeColor,
};

const beforeInteractive = () => {
  try {
    const theme = localStorage.getItem("ns:settings:theme");
    if (theme != null)
      document.documentElement.dataset.theme = JSON.parse(theme);
  } catch (e) {
    // Ignore
  }
};

const setupServiceWorker = () => {
  const registerServiceWorker = () => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js");
      });
    }
  };

  const unregisterServiceWorker = () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) registration.unregister();
      });
    }
  };

  if (process.env.NODE_ENV === "production") {
    registerServiceWorker();
  } else {
    unregisterServiceWorker();
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Script
          id="load-theme"
          strategy="beforeInteractive"
        >{`(${beforeInteractive})()`}</Script>
        <Script id="setup-service-worker">{`(${setupServiceWorker})()`}</Script>

        {isProduction && <VercelAnalytics />}

        <EmotionRootStyleRegistry>
          <CacheStoreProvider>
            <ThemeProvider>
              <GlobalStylesWrapper>
                <AppUpdateBanner />
                {children}
              </GlobalStylesWrapper>
            </ThemeProvider>
          </CacheStoreProvider>
        </EmotionRootStyleRegistry>
      </body>
    </html>
  );
}
