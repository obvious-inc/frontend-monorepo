import React from "react";
import { tinykeys } from "tinykeys";

// Syntax docs: https://github.com/jamiebuilds/tinykeys

export const isEventTargetTextInputOrTextArea = (target) => {
  if (target == null) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === "input") return target.type == null || target.type === "text";
  return tagName === "textarea";
};

const useKeyboardShortcuts = (shortcutMap, { enabled = true } = {}) => {
  React.useEffect(() => {
    if (!enabled) return;
    const unsubscribe = tinykeys(window, shortcutMap);
    return () => {
      unsubscribe();
    };
  });
};

export default useKeyboardShortcuts;
