"use client";
import { formatEther } from "viem";
import { css, ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import NextLink from "next/link";
import { getTheme } from "@/theme";
import { useSearchParams } from "@/hooks/navigation.js";
import useTreasuryData from "@/hooks/treasury-data";
import { useNounSeed } from "@/hooks/token-contract";
import { useAuction } from "@/hooks/auction-house-contract";
import Layout from "./layout.js";
import { Auction } from "./auction-dialog.js";

const AuctionScreen = () => {
  const [searchParams] = useSearchParams();
  const treasuryData = useTreasuryData();
  const auction = useAuction({ watch: true });
  const seed = useNounSeed(auction?.nounId);
  return (
    <EmotionThemeProvider theme={getTheme("light")}>
      <Layout
        actions={[
          {
            label: "Propose",
            buttonProps: {
              component: NextLink,
              href: "/new",
              prefetch: true,
            },
          },
          treasuryData != null && {
            label: (
              <>
                <span data-desktop-only>Treasury </span>
                {"Ξ"}{" "}
                {Math.round(
                  parseFloat(formatEther(treasuryData.totals.allInEth)),
                ).toLocaleString()}
              </>
            ),
            buttonProps: {
              component: NextLink,
              href: (() => {
                const linkSearchParams = new URLSearchParams(searchParams);
                linkSearchParams.set("treasury", 1);
                return `?${linkSearchParams}`;
              })(),
              prefetch: true,
            },
          },
        ].filter(Boolean)}
        style={{
          transition: "0.2s opacity ease-out",
          opacity: seed == null ? 0 : 1,
          background: parseInt(seed?.background) === 0 ? "#d5d7e1" : "#e1d7d5",
        }}
      >
        <div
          css={css({
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          })}
        >
          <Auction showBids />
        </div>
      </Layout>
    </EmotionThemeProvider>
  );
};

export default AuctionScreen;
