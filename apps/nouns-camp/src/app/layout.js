import { headers } from "next/headers";
import Script from "next/script";
// import { get as getConfig } from "@vercel/edge-config";
// import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import { getSession } from "@/utils/session";
import EmotionRootStyleRegistry from "./emotion-style-root-registry.js";
import { getStateFromCookie as getWagmiStateFromCookie } from "../wagmi-config.js";
import metaConfig from "../metadata-config.js";
import CacheStoreProvider from "../cache-store-provider.js";
import ConfigProvider from "../config-provider.js";
import ThemeProvider from "../theme-provider.js";
import WagmiProvider from "../wagmi-provider.js";
import GlobalStylesWrapper from "../global-styles-wrapper.js";
import SessionProvider from "../session-provider.js";
import { Provider as StoreProvider } from "../store.js";
import { Provider as FarcasterStateProvider } from "../hooks/farcaster.js";

import { GoogleAnalytics } from '@next/third-parties/google'
import { GA_ID } from "../constants/env";

import "../reset.css";
import "../index.css";

import "../snow.css";

// eslint-disable-next-line no-unused-vars
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
  colorScheme: "light dark",
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: metaConfig.viewportLightThemeColor,
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: metaConfig.viewportDarkThemeColor,
    },
  ],
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
  // try {
  //   const [canaryAccounts = [], betaAccounts = []] = await Promise.all([
  //     getConfig("canary-accounts"),
  //     getConfig("beta-accounts"),
  //   ]);
  //   return { canaryAccounts, betaAccounts };
  // } catch (e) {
  //   console.error(e);
    return { canaryAccounts: [], betaAccounts: [] };
  // }
};

export default async function RootLayout({ children }) {
  const [session, config] = await Promise.all([getSession(), fetchConfig()]);
  return (
    <html lang="en">
      <body>
        <Script
          id="load-theme"
          strategy="beforeInteractive"
        >{`(${beforeInteractive})()`}</Script>

        {/*{isProduction && <VercelAnalytics />}*/}
        {isProduction && <GoogleAnalytics gaId={GA_ID} />}

        <EmotionRootStyleRegistry>
          <ConfigProvider config={config}>
            <CacheStoreProvider>
              <ThemeProvider>
                <GlobalStylesWrapper>
                  <WagmiProvider
                    initialState={getWagmiStateFromCookie(
                      headers().get("cookie"),
                    )}
                  >
                    <SessionProvider
                      initialSession={{ address: session.address }}
                    >
                      <StoreProvider>
                        <FarcasterStateProvider>
                          {children}
                        </FarcasterStateProvider>
                      </StoreProvider>
                    </SessionProvider>
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
