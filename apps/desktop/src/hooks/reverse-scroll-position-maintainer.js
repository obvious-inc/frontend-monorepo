import React from "react";
import useScrollListener from "./scroll-listener";
import useMutationObserver from "./mutation-observer";

const useReverseScrollPositionMaintainer = (scrollContainerRef) => {
  // Whenever this ref is truthy we will try to maintain the scroll position
  // (keep the same distance to the bottom) when the scroll container’s scroll
  // height changes
  const maintainScrollPositionRef = React.useRef(false);

  const maintainScrollPositionDuringTheNextDomMutation =
    React.useCallback(() => {
      maintainScrollPositionRef.current = true;
    }, []);

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

      if (maintainScrollPositionRef.current) {
        maintainScrollPositionRef.current = false;

        if (prevScrollHeightRef.current === el.scrollHeight) return;

        const scrollHeightDiff = el.scrollHeight - prevScrollHeightRef.current;

        // console.log(
        //   "scroll adjust",
        //   [el.scrollTop, prevScrollHeightRef.current + scrollHeightDiff].join(
        //     " -> "
        //   )
        // );

        // Even with 'overflow-anchor' set to 'none', some browsers still mess
        // with the scroll, so we keep track of the most recent position in
        // `prevScrollTopRef` and use that when adjusting `scrollTop`
        el.scrollTop = prevScrollTopRef.current + scrollHeightDiff;
        prevScrollTopRef.current = el.scrollTop;
      }

      // if (prevScrollHeightRef.current !== el.scrollHeight) {
      //   console.log(
      //     "height change",
      //     [prevScrollHeightRef.current, el.scrollHeight].join(" -> ")
      //   );
      // }

      prevScrollHeightRef.current = el.scrollHeight;
    },
    { subtree: true, childList: true }
  );

  useScrollListener(scrollContainerRef, () => {
    prevScrollTopRef.current = scrollContainerRef.current.scrollTop;
  });

  return maintainScrollPositionDuringTheNextDomMutation;
};

export default useReverseScrollPositionMaintainer;
