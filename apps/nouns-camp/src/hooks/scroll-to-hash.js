import useScrollToElement from "./scroll-to-element.js";

const useScrollToHash = (scrollToElementOptions) => {
  useScrollToElement({
    id: location.hash === "" ? null : location.hash.slice(1),
    ...scrollToElementOptions,
  });
};

export default useScrollToHash;
