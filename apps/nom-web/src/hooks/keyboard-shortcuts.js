import React from "react";
import { tinykeys } from "tinykeys";

// Syntax docs: https://github.com/jamiebuilds/tinykeys

const useKeyboardShortcuts = (shortcutMap) => {
  React.useEffect(() => {
    const unsubscribe = tinykeys(window, shortcutMap);
    return () => {
      unsubscribe();
    };
  });
};

export default useKeyboardShortcuts;
