import React from "react";

const useScrollToElement = ({
  id: elementId,
  enabled = true,
  ...scrollIntoViewOptions
} = {}) => {
  const scrolledToElementRef = React.useRef(null);

  React.useEffect(() => {
    if (!enabled || elementId == null) return;
    if (scrolledToElementRef.current === elementId) return;

    const el = document.getElementById(elementId);
    if (el == null) return;

    scrolledToElementRef.current = elementId;

    let timeoutHandle;

    // Scroll with retry behavior because of Chromium issue
    // https://github.com/facebook/react/issues/23396#issuecomment-1557694564
    const run = () => {
      el.scrollIntoView(scrollIntoViewOptions);

      document.removeEventListener("scroll", run, true);
      if (timeoutHandle != null) clearTimeout(timeoutHandle);

      document.addEventListener("scroll", run, true);
      timeoutHandle = setTimeout(() => {
        document.removeEventListener("scroll", run, true);
        timeoutHandle = null;
      }, 0);
    };

    run();

    return () => {
      document.removeEventListener("scroll", run, true);
      if (timeoutHandle != null) {
        scrolledToElementRef.current = null;
        clearTimeout(timeoutHandle);
      }
    };
  });
};

export default useScrollToElement;
