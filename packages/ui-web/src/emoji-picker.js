import React from "react";
import { css } from "@emotion/react";
import { useEmojis } from "@shades/common/app";
import { array as arrayUtils, emoji as emojiUtils } from "@shades/common/utils";
import Input from "./input";
import { PopoverOrTrayDialog } from "./gif-picker.js";

const { groupBy } = arrayUtils;
const { search: searchEmoji } = emojiUtils;

const EmojiPickerTrigger = ({
  width = "31.6rem",
  height = "28.4rem",
  onSelect,
  isOpen,
  onOpenChange,
  placement = "top",
  offset = 10,
  trigger,
  ...pickerProps
}) => (
  <PopoverOrTrayDialog
    isOpen={isOpen}
    onOpenChange={onOpenChange}
    placement={placement}
    trigger={trigger}
    offset={offset}
  >
    {({ type }) => (
      <EmojiPicker
        width={type === "popover" ? width : "100%"}
        height={type === "popover" ? height : "100%"}
        onSelect={(item) => {
          onOpenChange(false);
          onSelect(item);
        }}
        {...pickerProps}
      />
    )}
  </PopoverOrTrayDialog>
);

// Super hacky and inaccessible
const EmojiPicker = ({ width = "auto", height = "100%", onSelect }) => {
  const inputRef = React.useRef();

  const { allEntries: emojis, recentlyUsedEntries: recentEmojis } = useEmojis();

  const emojiByCategoryEntries = React.useMemo(
    () => Object.entries(groupBy((e) => e.category, emojis)),
    [emojis],
  );

  const [highlightedEntry, setHighlightedEntry] = React.useState(null);
  const deferredHighlightedEntry = React.useDeferredValue(highlightedEntry);

  const [query, setQuery] = React.useState("");
  const trimmedQuery = React.useDeferredValue(query.trim().toLowerCase());

  const filteredEmojisByCategoryEntries = React.useMemo(() => {
    if (trimmedQuery.length === 0) {
      if (recentEmojis.length === 0) return emojiByCategoryEntries;
      return [
        ["Recently used", recentEmojis.slice(0, 4 * 9)],
        ...emojiByCategoryEntries,
      ];
    }

    const emoji = emojiByCategoryEntries.flatMap((entry) => entry[1]);
    return [[undefined, searchEmoji(emoji, trimmedQuery)]];
  }, [emojiByCategoryEntries, recentEmojis, trimmedQuery]);

  const highlightedEmojiItem = React.useMemo(
    () =>
      deferredHighlightedEntry == null
        ? null
        : filteredEmojisByCategoryEntries[deferredHighlightedEntry[0]][1][
            deferredHighlightedEntry[1]
          ],
    [deferredHighlightedEntry, filteredEmojisByCategoryEntries],
  );

  const ROW_LENGTH = 9;

  const addReactionAtEntry = ([ci, ei]) => {
    const { id, emoji } = filteredEmojisByCategoryEntries[ci][1][ei];
    onSelect(emoji ?? id);
  };

  const navigationBlockedRef = React.useRef();

  // Hack to make the UI not freeze when you navigate by pressing and holding e.g. arrow down
  const wrapNavigationKeydownHandler = (handler) => {
    if (navigationBlockedRef.current) return;
    navigationBlockedRef.current = true;
    handler();
    requestAnimationFrame(() => {
      navigationBlockedRef.current = false;
    });
  };

  const handleKeyDown = (event) => {
    switch (event.key) {
      case "ArrowUp": {
        wrapNavigationKeydownHandler(() => {
          setHighlightedEntry((e) => {
            if (e == null) return null;
            const [ci, ei] = e;
            if (ei - ROW_LENGTH >= 0) return [ci, ei - ROW_LENGTH];
            if (ci === 0) return null;
            const targetColumn = ei;
            const previousCategoryItems =
              filteredEmojisByCategoryEntries[ci - 1][1];
            const lastRowLength =
              previousCategoryItems.length % ROW_LENGTH === 0
                ? ROW_LENGTH
                : previousCategoryItems.length % ROW_LENGTH;
            return [
              ci - 1,
              lastRowLength - 1 >= targetColumn
                ? previousCategoryItems.length - lastRowLength + targetColumn
                : previousCategoryItems.length - 1,
            ];
          });
          event.preventDefault();
        });
        break;
      }
      case "ArrowDown": {
        wrapNavigationKeydownHandler(() => {
          setHighlightedEntry((e) => {
            if (filteredEmojisByCategoryEntries.length === 0) return null;
            if (e == null) return [0, 0];
            const [ci, ei] = e;
            const categoryItems = filteredEmojisByCategoryEntries[ci][1];
            if (ei + ROW_LENGTH <= categoryItems.length - 1)
              return [ci, ei + ROW_LENGTH];
            const lastRowStartIndex =
              categoryItems.length % ROW_LENGTH === 0
                ? categoryItems.length - ROW_LENGTH
                : categoryItems.length - (categoryItems.length % ROW_LENGTH);

            if (ei < lastRowStartIndex) return [ci, categoryItems.length - 1];
            if (ci === filteredEmojisByCategoryEntries.length - 1)
              return [ci, ei];
            const targetColumn = ei % ROW_LENGTH;
            const nextCategoryItems =
              filteredEmojisByCategoryEntries[ci + 1][1];
            return [
              ci + 1,
              nextCategoryItems.length - 1 >= targetColumn
                ? targetColumn
                : nextCategoryItems.length - 1,
            ];
          });
          event.preventDefault();
        });
        break;
      }
      case "ArrowLeft": {
        wrapNavigationKeydownHandler(() => {
          setHighlightedEntry((e) => {
            if (e == null) return null;
            const [ci, ei] = e;
            if (ei - 1 >= 0) return [ci, ei - 1];
            if (ci === 0) {
              const categoryItems = filteredEmojisByCategoryEntries[ci][1];
              return [
                ci,
                categoryItems.length >= ROW_LENGTH
                  ? ROW_LENGTH - 1
                  : categoryItems.length - 1,
              ];
            }
            const previousCategoryItems =
              filteredEmojisByCategoryEntries[ci - 1][1];
            return [ci - 1, previousCategoryItems.length - 1];
          });
          event.preventDefault();
        });
        break;
      }
      case "ArrowRight": {
        wrapNavigationKeydownHandler(() => {
          setHighlightedEntry((e) => {
            if (e == null) return null;
            const [ci, ei] = e;
            const categoryItems = filteredEmojisByCategoryEntries[ci][1];
            if (ei + 1 <= categoryItems.length - 1) return [ci, ei + 1];
            if (ci === filteredEmojisByCategoryEntries.length - 1)
              return [ci, ei];
            return [ci + 1, 0];
          });
          event.preventDefault();
        });
        break;
      }
      case "Enter": {
        addReactionAtEntry(highlightedEntry);
        event.preventDefault();
        break;
      }
    }
  };

  React.useEffect(() => {
    inputRef.current.focus();
  }, []);

  return (
    <div
      css={css({ display: "flex", flexDirection: "column" })}
      style={{ height, width }}
    >
      <div css={css({ padding: "0.7rem 0.7rem 0.3rem" })}>
        <Input
          size="small"
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightedEntry(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            highlightedEmojiItem == null
              ? "Search"
              : (highlightedEmojiItem.description ?? "Search")
          }
        />
      </div>

      <div
        css={(t) =>
          css({
            position: "relative",
            flex: 1,
            overflow: "auto",
            scrollPaddingTop: "3rem",
            scrollPaddingBottom: "0.5rem",
            paddingBottom: "0.7rem",
            ".category-title": {
              position: "sticky",
              top: 0,
              zIndex: 1,
              background: `linear-gradient(-180deg, ${t.colors.popoverBackground} 50%, transparent)`,
              padding: "0.6rem 0.9rem",
              fontSize: "1.2rem",
              fontWeight: "500",
              color: t.colors.textDimmed,
              textTransform: "uppercase",
              pointerEvents: "none",
            },
            ".category-container": {
              display: "grid",
              justifyContent: "space-between",
              padding: "0 0.5rem",
              gridTemplateColumns: "repeat(auto-fill, minmax(3.4rem, 1fr))",
            },
            ".emoji": {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2.2rem",
              width: "3.4rem",
              height: "2.9rem",
              background: "none",
              borderRadius: "0.5rem",
              border: 0,
              cursor: "pointer",
              outline: "none",
              "&[data-selected]": {
                background: t.colors.backgroundModifierHover,
              },
              "&:focus": {
                position: "relative",
                zIndex: 2,
                boxShadow: `0 0 0 0.2rem ${t.colors.primary}`,
              },
              img: {
                display: "block",
                width: "2.2rem",
                height: "2.2rem",
                margin: "auto",
              },
            },
          })
        }
      >
        {filteredEmojisByCategoryEntries.map(([category, emojis], ci) => (
          <div key={category ?? "no-category"}>
            {category != null && (
              <div className="category-title">{category}</div>
            )}

            <div
              className="category-container"
              style={{ paddingTop: category == null ? "0.8rem" : undefined }}
            >
              {emojis.map(({ id, emoji, url }, i) => {
                const isHighlighted =
                  highlightedEntry != null &&
                  highlightedEntry[0] === ci &&
                  highlightedEntry[1] === i;
                return (
                  <button
                    key={id ?? emoji}
                    ref={(el) => {
                      if (el == null) return;
                      if (isHighlighted)
                        el.scrollIntoView({ block: "nearest" });
                    }}
                    className="emoji"
                    data-selected={isHighlighted ? "true" : undefined}
                    onClick={() => {
                      onSelect(emoji ?? id);
                    }}
                    onPointerMove={() => {
                      if (
                        highlightedEntry != null &&
                        highlightedEntry[0] === ci &&
                        highlightedEntry[1] === i
                      )
                        return;

                      setHighlightedEntry([ci, i]);
                    }}
                  >
                    {emoji ?? <img src={url} alt={id} />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmojiPickerTrigger;
