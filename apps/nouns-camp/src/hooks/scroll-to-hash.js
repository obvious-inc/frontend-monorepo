import useScrollToElement from "@/hooks/scroll-to-element";

const useScrollToHash = (scrollToElementOptions) => {
  useScrollToElement({
    id: location.hash === "" ? null : location.hash.slice(1),
    ...scrollToElementOptions,
  });
};

export default useScrollToHash;
