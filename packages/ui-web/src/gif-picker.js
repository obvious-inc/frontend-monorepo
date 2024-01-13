import throttle from "lodash.throttle";
import React from "react";
import { css } from "@emotion/react";
import { useActions } from "@shades/common/app";
import { useMatchMedia, useFetch } from "@shades/common/react";
import * as Popover from "./popover.js";
import Dialog from "./dialog.js";
import Input from "./input";

const GifPickerTrigger = ({
  width = "34rem",
  height = "48rem",
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
    offset={offset}
    trigger={trigger}
  >
    {({ type }) => (
      <GifPicker
        width={type === "popover" ? width : "100%"}
        height={type === "popover" ? height : "100%"}
        // columnCount={type === "popover" ? 3 : 2}
        onSelect={(item) => {
          onOpenChange(false);
          onSelect(item);
        }}
        {...pickerProps}
      />
    )}
  </PopoverOrTrayDialog>
);

const GifPicker = ({
  width = "auto",
  height = "100%",
  columnCount = 2,
  onSelect,
}) => {
  const inputRef = React.useRef();

  const [items, setItems] = React.useState([]);
  const { searchGifs } = useActions();

  const [highlightedIndex, setHighlightedIndex] = React.useState(null);
  const deferredHighlightedIndex = React.useDeferredValue(highlightedIndex);
  const highlightedItem = items[deferredHighlightedIndex];

  const [query, setQuery] = React.useState("");
  const trimmedQuery = React.useDeferredValue(query.trim().toLowerCase());

  const throttledSearchGifs = React.useMemo(
    () =>
      throttle((query) => {
        if (query.length === 1) return Promise.resolve();
        return searchGifs(query || "amaze").then((gifs) => {
          setItems(gifs);
        });
      }, 800),
    [searchGifs]
  );

  useFetch(
    () => throttledSearchGifs(trimmedQuery),
    [throttledSearchGifs, trimmedQuery]
  );

  const selectHighlightedItem = () => {
    const item = items[highlightedIndex];
    onSelect({ url: item.src });
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
          const lastIndex = items.length - 1;
          setHighlightedIndex((prevIndex) => {
            if (prevIndex == null) return lastIndex;
            const columnIndex = prevIndex % columnCount;
            if (prevIndex - columnCount < 0) {
              const lastRowItemCount = items.length % columnCount;
              return columnIndex > lastRowItemCount - 1
                ? lastIndex
                : items.length - lastRowItemCount + columnIndex;
            }
            return prevIndex - columnCount;
          });
          event.preventDefault();
        });
        break;
      }
      case "ArrowDown": {
        wrapNavigationKeydownHandler(() => {
          const lastIndex = items.length - 1;
          setHighlightedIndex((prevIndex) => {
            if (prevIndex == null) return 0;
            const columnIndex = prevIndex % columnCount;
            if (prevIndex + columnCount > lastIndex) {
              const lastRowItemCount = items.length % columnCount;
              // Wrap around if we’re on the last row
              if (prevIndex > lastIndex - lastRowItemCount) return columnIndex;
              // Fall back to the last index if no item exists
              return columnIndex > lastRowItemCount - 1
                ? lastIndex
                : items.length - lastRowItemCount + columnIndex;
            }
            return prevIndex + columnCount;
          });
          event.preventDefault();
        });
        break;
      }
      case "ArrowLeft": {
        wrapNavigationKeydownHandler(() => {
          setHighlightedIndex((prevIndex) => {
            if (prevIndex == null) return columnCount - 1;
            return Math.max(prevIndex - 1, 0);
          });
          event.preventDefault();
        });
        break;
      }
      case "ArrowRight": {
        wrapNavigationKeydownHandler(() => {
          setHighlightedIndex((prevIndex) => {
            if (prevIndex == null) return 1;
            return Math.min(prevIndex + 1, items.length - 1);
          });
          event.preventDefault();
        });
        break;
      }
      case "Enter": {
        selectHighlightedItem();
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
      <div
        css={css({
          padding: "0.8rem 0.8rem 0",
          position: "relative",
          zIndex: 2,
        })}
      >
        <Input
          size="small"
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlightedIndex(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            highlightedIndex == null
              ? "Search"
              : highlightedItem?.title ?? "Search"
          }
        />
      </div>

      <div
        css={(t) =>
          css({
            position: "relative",
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            padding: "0.6rem 0.4rem 0.4rem",
            ".grid-container": {
              display: "flex",
              flexWrap: "wrap",
            },
            ".grid-item": {
              minWidth: 0,
              width: "calc(100% / var(--column-count))",
            },
            button: {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "auto",
              background: "none",
              borderRadius: "0.5rem",
              padding: "0.4rem",
              border: 0,
              cursor: "pointer",
              outline: "none",
              "&[data-selected]": {
                background: t.colors.backgroundModifierNormal,
              },
              "&:focus": {
                position: "relative",
                zIndex: 2,
                boxShadow: `0 0 0 0.2rem ${t.colors.primary}`,
              },
              img: {
                display: "block",
                width: "100%",
                height: "auto",
                objectFit: "cover",
                margin: "auto",
                borderRadius: "0.3rem",
              },
            },
          })
        }
        style={{ "--column-count": columnCount }}
      >
        <div className="grid-container">
          {items.map((item, i) => {
            const isHighlighted = highlightedIndex === i;
            return (
              <div
                key={item.id}
                className="grid-item"
                // ref={(el) => {
                //   if (el == null) return;
                //   if (isHighlighted)
                //     el.scrollIntoView({
                //       block: "nearest",
                //       behavior: "smooth",
                //     });
                // }}
              >
                <button
                  key={item.id}
                  data-selected={isHighlighted ? "true" : undefined}
                  onClick={() => {
                    onSelect({ url: item.src });
                  }}
                  onPointerMove={() => {
                    if (highlightedIndex === i) return;
                    setHighlightedIndex(i);
                  }}
                >
                  <img src={item.src} alt={item.title} loading="lazy" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const PopoverOrTrayDialog = ({
  isOpen,
  onOpenChange,
  placement = "top",
  offset,
  trigger,
  children,
}) => {
  const inputDeviceCanHover = useMatchMedia("(hover: hover)");
  const close = () => {
    onOpenChange(false);
  };

  if (inputDeviceCanHover)
    return (
      <Popover.Root
        placement={placement}
        offset={offset}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
      >
        <Popover.Trigger asChild>{trigger}</Popover.Trigger>
        <Popover.Content>
          {/* <Popover.Arrow /> */}
          {typeof children === "function"
            ? children({ type: "popover" })
            : children}
        </Popover.Content>
      </Popover.Root>
    );

  // Tray dialog on touch devices
  return (
    <>
      {trigger}
      <Dialog
        isOpen={isOpen}
        onRequestClose={close}
        underlayProps={{ css: css({ "[data-modal]": { background: "none" } }) }}
      >
        <button
          onClick={close}
          css={css({
            padding: "0.8rem",
            display: "block",
            margin: "0 auto",
          })}
        >
          <div
            css={(t) =>
              css({
                height: "0.4rem",
                width: "4.2rem",
                borderRadius: "0.2rem",
                background: t.light
                  ? t.colors.backgroundTertiary
                  : t.colors.textMuted,
                boxShadow: t.shadows.elevationLow,
              })
            }
          />
        </button>
        <div
          css={(t) =>
            css({
              flex: 1,
              minHeight: 0,
              padding: "0.4rem 0.4rem 0",
              background: t.colors.popoverBackground,
              borderTopLeftRadius: "0.6rem",
              borderTopRightRadius: "0.6rem",
              boxShadow: t.shadows.elevationHigh,
            })
          }
        >
          {typeof children === "function"
            ? children({ type: "tray" })
            : children}
        </div>
      </Dialog>
    </>
  );
};

export default GifPickerTrigger;
