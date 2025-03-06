"use client";
import React from "react";
import { css, ThemeProvider as EmotionThemeProvider } from "@emotion/react";
import { CaretDown as CaretDownIcon } from "@shades/ui-web/icons";
import { getTheme } from "@/theme";
import { useNavigate } from "@/hooks/navigation";
import usePreferredTheme from "@/hooks/preferred-theme";
import useKeyboardShortcuts, {
  isEventTargetTextInputOrTextArea,
} from "@/hooks/keyboard-shortcuts";
import Layout from "@/components/layout";
import {
  Auction,
  useAuctionData,
  useLazySeed,
} from "@/components/auction-dialog";
import NativeSelect from "@/components/native-select";
import { useRouter } from "next/navigation.js";

const NounScreen = ({ nounId: eagerSpecifiedNounId }) => {
  const preferredTheme = usePreferredTheme();

  const nextRouter = useRouter();
  const navigate = useNavigate();

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
      if (isEventTargetTextInputOrTextArea(e.target)) return;
      const prevNounId = parseInt(nounId) - 1;
      const pathname = prevNounId >= 0 ? `/nouns/${prevNounId}` : "/auction";
      navigate(pathname + location.search);
    },
    ArrowRight: (e) => {
      if (currentAuction == null) return;
      if (isEventTargetTextInputOrTextArea(e.target)) return;
      const nextNounId = parseInt(nounId) + 1;
      const pathname =
        nextNounId === currentAuction.nounId
          ? "/auction"
          : nextNounId > currentAuction.nounId
            ? "/nouns/0"
            : `/nouns/${nextNounId}`;
      navigate(pathname + location.search);
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
        actions={["create-menu"]}
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
      : Array.from({ length: parseInt(currentAuctionNounId) + 1 })
          .map((_, i) => ({
            label:
              i === parseInt(currentAuctionNounId)
                ? `Noun ${i} (Auction)`
                : `Noun ${i}`,
            value: String(i),
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
