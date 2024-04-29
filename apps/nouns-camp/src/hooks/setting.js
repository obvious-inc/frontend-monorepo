import { invariant, array as arrayUtils } from "@shades/common/utils";
import { useCachedState } from "@shades/common/app";

const items = [
  {
    key: "theme",
    type: "enum",
    values: ["system", "light", "dark"],
    default: "system",
  },
  {
    key: "zoom",
    type: "enum",
    values: ["tiny", "small", "normal", "large", "huge"],
    default: "normal",
  },
  {
    key: "farcaster-cast-filter",
    type: "enum",
    values: ["nouners", "none", "disabled"],
    default: "nouners",
  },
  {
    key: "xmas-effects-opt-out",
    type: "bool",
    default: false,
  },
];

const itemsByKey = arrayUtils.indexBy((i) => i.key, items);

export const getConfig = (key) => {
  invariant(itemsByKey[key] != null, `Unrecognized setting "${key}"`);
  return itemsByKey[key];
};

const useSetting = (key) => {
  invariant(itemsByKey[key] != null, `Unrecognized setting "${key}"`);
  return useCachedState(`settings:${key}`, itemsByKey[key].default);
};

export default useSetting;
