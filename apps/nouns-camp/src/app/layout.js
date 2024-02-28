import { headers } from "next/headers";
import Script from "next/script";
import { get as getConfig } from "@vercel/edge-config";
import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import EmotionRootStyleRegistry from "./emotion-style-root-registry.js";
import { getStateFromCookie as getWagmiStateFromCookie } from "../wagmi-config.js";
import metaConfig from "../metadata-config.js";
import CacheStoreProvider from "../cache-store-provider.js";
import ConfigProvider from "../config-provider.js";
import ThemeProvider from "../theme-provider.js";
import WagmiProvider from "../wagmi-provider.js";
import GlobalStylesWrapper from "../global-styles-wrapper.js";
import { Provider as StoreProvider } from "../store.js";

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
    const rawThemePreference = localStorage.getItem("ns:settings:theme");
    if (rawThemePreference != null) {
      const themePreference = JSON.parse(rawThemePreference);
      document.documentElement.dataset.theme = themePreference;
    }
  } catch (e) {
    // Ignore
  }
};

const fetchConfig = async () => {
  return [];
  // eslint-disable-next-line no-unreachable
  try {
    const betaAccounts = await getConfig("beta-accounts");
    return { betaAccounts };
  } catch (e) {
    console.error(e);
    return { betaAccounts: [] };
  }
};

export default async function RootLayout({ children }) {
  const config = await fetchConfig();
  return (
    <html lang="en">
      <body>
        <Script
          id="load-theme"
          strategy="beforeInteractive"
        >{`(${beforeInteractive})()`}</Script>

        {isProduction && <VercelAnalytics />}

        <EmotionRootStyleRegistry>
          <ConfigProvider config={config}>
            <CacheStoreProvider>
              <ThemeProvider>
                <GlobalStylesWrapper>
                  <WagmiProvider
                    initialState={getWagmiStateFromCookie(
                      headers().get("cookie")
                    )}
                  >
                    <StoreProvider>{children}</StoreProvider>
                  </WagmiProvider>
                </GlobalStylesWrapper>
              </ThemeProvider>
            </CacheStoreProvider>
          </ConfigProvider>
        </EmotionRootStyleRegistry>
      </body>
    </html>
  );
}
