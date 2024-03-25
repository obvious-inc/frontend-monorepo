import React from "react";
import { css } from "@emotion/react";
import useScrollListener from "../hooks/scroll-listener.js";
import useMutationObserver from "../hooks/mutation-observer.js";

// This continuously adjusts the scroll position to offset scroll height
// changes, making it appear to be anchored to the bottom rather than the top.
const useReverseScrollPositionMaintainer = (scrollContainerRef) => {
  const prevScrollHeightRef = React.useRef();
  const prevScrollTopRef = React.useRef();

  React.useEffect(() => {
    if (prevScrollHeightRef.current == null)
      prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
    if (prevScrollTopRef.current == null)
      prevScrollTopRef.current = scrollContainerRef.current.scrollTop;
  }, [scrollContainerRef]);

  useMutationObserver(
    scrollContainerRef,
    () => {
      const el = scrollContainerRef.current;

      if (el == null) return;

      if (prevScrollHeightRef.current === el.scrollHeight) return;

      const scrollHeightDiff = el.scrollHeight - prevScrollHeightRef.current;
      // Even with 'overflow-anchor' set to 'none', some browsers still mess
      // with the scroll, so we keep track of the most recent position in
      // `prevScrollTopRef` and use that when adjusting `scrollTop`
      el.scrollTop = prevScrollTopRef.current + scrollHeightDiff;
      prevScrollTopRef.current = el.scrollTop;

      prevScrollHeightRef.current = el.scrollHeight;
    },
    { subtree: true, childList: true },
  );

  useScrollListener(scrollContainerRef, () => {
    prevScrollTopRef.current = scrollContainerRef.current.scrollTop;
  });
};

const scrollPositionCache = {};

const isScrolledToBottom = (el) =>
  // ceil is required when page is zoomed
  Math.ceil(el.scrollTop) + Math.ceil(el.getBoundingClientRect().height) >=
  el.scrollHeight;

const useScroll = ({
  cacheKey,
  scrollContainerRef,
  didScrollToBottomRef,
  onScrollToBottom,
}) => {
  const scrollToBottom = React.useCallback(
    (options) => {
      const isScrollable =
        scrollContainerRef.current.scrollHeight >
        scrollContainerRef.current.getBoundingClientRect().height;

      if (!isScrollable) {
        didScrollToBottomRef.current = true;
        return;
      }

      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        ...options,
      });
    },
    [scrollContainerRef, didScrollToBottomRef],
  );

  // Restore cached scroll position
  React.useEffect(() => {
    const { scrollTop: cachedScrollTop } = scrollPositionCache[cacheKey] ?? {};

    if (cachedScrollTop == null) {
      scrollToBottom();
      return;
    }

    const el = scrollContainerRef.current;

    el.scrollTop = cachedScrollTop;

    const isAtBottom = isScrolledToBottom(el);

    didScrollToBottomRef.current = isAtBottom;
  }, [scrollContainerRef, didScrollToBottomRef, cacheKey, scrollToBottom]);

  useScrollListener(scrollContainerRef, (e) => {
    const isAtBottom = isScrolledToBottom(e.target);

    if (isAtBottom) {
      delete scrollPositionCache[cacheKey];
      onScrollToBottom?.();
    } else {
      scrollPositionCache[cacheKey] = { scrollTop: e.target.scrollTop };
    }

    didScrollToBottomRef.current = isAtBottom;
  });

  return { scrollToBottom };
};

const ReverseVerticalScrollView = React.forwardRef(
  (
    {
      didScrollToBottomRef,
      scrollCacheKey,
      onScroll,
      onScrollToBottom,
      children,
    },
    ref,
  ) => {
    const scrollContainerRef = React.useRef();

    useReverseScrollPositionMaintainer(scrollContainerRef);

    useScrollListener(scrollContainerRef, onScroll);

    const { scrollToBottom } = useScroll({
      scrollContainerRef,
      didScrollToBottomRef,
      cacheKey: scrollCacheKey,
      onScrollToBottom,
    });

    useMutationObserver(
      scrollContainerRef,
      () => {
        if (!didScrollToBottomRef.current) return;
        scrollToBottom();
      },
      { subtree: true, childList: true },
    );

    React.useImperativeHandle(ref, () => ({ scrollToBottom }), [
      scrollToBottom,
    ]);

    return (
      <div
        css={css({
          position: "relative",
          flex: 1,
          display: "flex",
          minHeight: 0,
          minWidth: 0,
        })}
      >
        <div
          ref={scrollContainerRef}
          css={css({
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflowY: "scroll",
            overflowX: "hidden",
            minHeight: 0,
            flex: 1,
            overflowAnchor: "none",
          })}
        >
          <div
            css={css({
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              alignItems: "stretch",
              minHeight: "100%",
            })}
          >
            {children}
          </div>
        </div>
      </div>
    );
  },
);

export default ReverseVerticalScrollView;
