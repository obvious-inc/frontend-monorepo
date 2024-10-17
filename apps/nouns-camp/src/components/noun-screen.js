"use client";
import { formatEther } from "viem";
import React from "react";
import { css, ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import NextLink from "next/link";
import { CaretDown as CaretDownIcon } from "@shades/ui-web/icons";
import { getTheme } from "@/theme";
import { useSearchParams, useNavigate } from "@/hooks/navigation";
import useTreasuryData from "@/hooks/treasury-data";
import usePreferredTheme from "@/hooks/preferred-theme";
import useKeyboardShortcuts, {
  isEventTargetInputOrTextArea,
} from "@/hooks/keyboard-shortcuts";
import Layout from "./layout.js";
import { Auction, useAuctionData, useLazySeed } from "./auction-dialog.js";
import NativeSelect from "./native-select.js";
import { useRouter } from "next/navigation.js";

const NounScreen = ({ nounId: eagerSpecifiedNounId }) => {
  const preferredTheme = usePreferredTheme();

  const nextRouter = useRouter();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const treasuryData = useTreasuryData();

  const specifiedNounId = React.useDeferredValue(eagerSpecifiedNounId);

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

  useKeyboardShortcuts({
    ArrowLeft: (e) => {
      if (isEventTargetInputOrTextArea(e.target)) return;
      const prevNounId = parseInt(nounId) - 1;
      navigate(prevNounId >= 1 ? `/nouns/${prevNounId}` : "/auction");
    },
    ArrowRight: (e) => {
      if (currentAuction == null) return;
      if (isEventTargetInputOrTextArea(e.target)) return;
      const nextNounId = parseInt(nounId) + 1;
      navigate(
        nextNounId === currentAuction.nounId
          ? "/auction"
          : nextNounId > currentAuction.nounId
            ? "/nouns/1"
            : `/nouns/${nextNounId}`,
      );
    },
  });

  // Prefetch adjecent pages to make keyboard nav snappier
  React.useEffect(() => {
    const currentNounId = specifiedNounId ?? currentAuction?.nounId;

    if (currentNounId == null) return;

    const prefetch = (nounId) => {
      if (nounId == null) return;
      nextRouter.prefetch(
        nounId === currentAuction?.nounId ? "/auction" : `/nouns/${nounId}`,
      );
    };

    const prevNounId =
      currentNounId === 1 ? currentAuction?.nounId : currentNounId - 1;
    const nextNounId =
      currentNounId === currentAuction?.nounId ? 1 : currentNounId + 1;

    prefetch(prevNounId);
    prefetch(nextNounId);
  }, [nextRouter, specifiedNounId, currentAuction]);

  return (
    <EmotionThemeProvider theme={getTheme("light")}>
      <Layout
        navigationStack={[
          {
            key: "noun",
            component: NounsSelect,
            props: {
              selectedNounId: nounId,
              currentAuctionNounId: currentAuction?.nounId,
              onChange: (e) => {
                const nounId = parseInt(e.target.value);
                navigate(
                  nounId === currentAuction?.nounId
                    ? "/auction"
                    : `/nouns/${nounId}`,
                );
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
        <div
          css={css({
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          })}
        >
          <Auction nounId={nounId} stickyNoun showBids transparent />
          <EmotionThemeProvider theme={preferredTheme}>
            <div
              css={(t) =>
                css({
                  flex: 1,
                  background: t.colors.dialogBackground,
                  "@media(min-width: 600px)": {
                    display: "none",
                  },
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
            label:
              i + 1 === parseInt(currentAuctionNounId)
                ? `Noun ${i + 1} (Auction)`
                : `Noun ${i + 1}`,
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

export default NounScreen;
