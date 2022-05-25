import React from "react";

const useScrollListener = (scrollContainerRef, handler, deps = []) => {
  const handlerRef = React.useRef(handler);

  React.useEffect(() => {
    handlerRef.current = handler;
  });

  React.useEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    let prevScrollTop = null;

    const scrollHandler = (e) => {
      let scrollDirection = null;

      if (prevScrollTop) {
        scrollDirection =
          e.target.scrollTop - prevScrollTop > 0 ? "down" : "up";
      }

      prevScrollTop = e.target.scrollTop;

      handlerRef.current(e, { direction: scrollDirection });
    };

    scrollContainer.addEventListener("scroll", scrollHandler, {
      passive: true,
    });

    return () => {
      scrollContainer.removeEventListener("scroll", scrollHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollContainerRef, ...deps]);
};

export default useScrollListener;
