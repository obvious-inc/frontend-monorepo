import React from "react";
import { tinykeys } from "tinykeys";

// Syntax docs: https://github.com/jamiebuilds/tinykeys

export const isEventTargetInputOrTextArea = (target) => {
  if (target == null) return false;
  const tagName = target.tagName.toLowerCase();
  return ["input", "textarea"].includes(tagName);
};

const useKeyboardShortcuts = (shortcutMap) => {
  React.useEffect(() => {
    const unsubscribe = tinykeys(window, shortcutMap);
    return () => {
      unsubscribe();
    };
  });
};

export default useKeyboardShortcuts;
