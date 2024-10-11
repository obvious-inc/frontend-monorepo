"use client";
import { formatEther } from "viem";
import React from "react";
import { css, ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import NextLink from "next/link";
import { CaretDown as CaretDownIcon } from "@shades/ui-web/icons";
import { getTheme } from "@/theme";
import { useSearchParams } from "@/hooks/navigation.js";
import useTreasuryData from "@/hooks/treasury-data";
import usePreferredTheme from "@/hooks/preferred-theme";
import Layout from "./layout.js";
import { Auction, useAuctionData, useLazySeed } from "./auction-dialog.js";
import NativeSelect from "./native-select.js";

const AuctionScreen = () => {
  const preferredTheme = usePreferredTheme();

  const [searchParams, setSearchParams] = useSearchParams();

  const treasuryData = useTreasuryData();

  const specifiedNounId = React.useDeferredValue(searchParams.get("noun"));

  const { auction: customAuction } = useAuctionData({
    nounId: specifiedNounId,
    enabled: specifiedNounId != null,
  });
  const { auction: currentAuction } = useAuctionData();
  const isCurrentAuction =
    specifiedNounId == null || specifiedNounId === currentAuction?.nounId;

  const auction = isCurrentAuction ? currentAuction : customAuction;
  const nounId = specifiedNounId ?? auction?.nounId;

  const seed = useLazySeed(nounId);
  const background = parseInt(seed?.background) === 0 ? "#d5d7e1" : "#e1d7d5";

  return (
    <EmotionThemeProvider theme={getTheme("light")}>
      <Layout
        navigationStack={[
          {
            key: "noun",
            component: NounsSelect,
            props: {
              selectedNounId: nounId,
              currentAuctionNounId:
                auction == null ? null : String(auction.nounId),
              onChange: (e) => {
                setSearchParams({ noun: e.target.value });
              },
            },
          },
        ]}
        actions={[
          {
            label: "Propose",
            buttonProps: {
              component: NextLink,
              href: "/new",
              prefetch: true,
            },
            desktopOnly: true,
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
          background,
        }}
      >
        <div css={css({ flex: 1, display: "flex", flexDirection: "column" })}>
          <Auction nounId={nounId} stickyNoun showBids transparent />
          <EmotionThemeProvider theme={preferredTheme}>
            <div
              css={(t) =>
                css({
                  flex: 1,
                  background: t.colors.dialogBackground,
                })
              }
            />
          </EmotionThemeProvider>
        </div>
      </Layout>
    </EmotionThemeProvider>
  );
};

const NounsSelect = ({ selectedNounId, currentAuctionNounId, ...props }) => {
  const options =
    currentAuctionNounId == null
      ? []
      : Array.from({ length: parseInt(currentAuctionNounId) })
          .map((_, i) => ({
            label: `Noun ${i + 1}`,
            value: String(i + 1),
          }))
          .toReversed();

  return (
    <NativeSelect
      value={selectedNounId}
      options={options}
      renderSelectedOption={() => (
        <>
          Noun {selectedNounId}
          <CaretDownIcon
            style={{
              display: "inline-block",
              width: "0.9rem",
              height: "auto",
              marginLeft: "0.35em",
            }}
          />
        </>
      )}
      {...props}
    />
  );
};

export default AuctionScreen;
