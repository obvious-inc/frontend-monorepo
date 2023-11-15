import { useCachedState } from "@shades/common/app";
import { invariant } from "@shades/common/utils";
import defaultTheme from "@shades/ui-web/theme";

const entriesByKey = {
  theme: {
    key: "theme",
    type: "enum",
    values: ["system", "light", "dark"],
    default: defaultTheme.name ?? "system",
  },
  layout: {
    key: "layout",
    type: "enum",
    values: ["normal", "compact", "bubbles"],
    default: "normal",
  },
  "sidebar-item-size": {
    key: "sidebar-item-size",
    type: "enum",
    values: ["normal", "large"],
    default: "normal",
  },
  zoom: {
    key: "zoom",
    type: "enum",
    values: ["tiny", "small", "normal", "large", "huge"],
    default: "normal",
  },
};

export const getConfig = (key) => {
  invariant(entriesByKey[key] != null, `Unrecognized setting "${key}"`);
  return entriesByKey[key];
};

const useSetting = (key) => {
  invariant(entriesByKey[key] != null, `Unrecognized setting "${key}"`);
  return useCachedState(`settings:${key}`, entriesByKey[key].default);
};

export default useSetting;
