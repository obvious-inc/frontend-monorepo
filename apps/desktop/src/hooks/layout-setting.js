import useSetting from "./setting.js";

const useLayoutSetting = () => {
  const compactModeOverride = location.search.includes("compact=1");
  const bubblesModeOverride = location.search.includes("bubbles=1");
  const [layoutSetting] = useSetting("layout");
  const layout = compactModeOverride
    ? "compact"
    : bubblesModeOverride
    ? "bubbles"
    : layoutSetting;
  return layout ?? "normal";
};

export default useLayoutSetting;
