import useLatestCallback from "./latest-callback.js";

const useComposedRefs = (...refs) => {
  return useLatestCallback((value) => {
    refs.forEach((ref) => {
      if (ref == null) return;
      if (typeof ref === "function") {
        ref(value);
        return;
      }

      ref.current = value;
    });
  });
};

export default useComposedRefs;
