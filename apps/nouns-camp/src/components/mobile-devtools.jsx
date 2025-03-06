"use client";

import { useEffect, useState } from "react";

/**
 * Component that initializes mobile DevTools
 * Only loaded in development build and only on mobile/touch devices
 *
 * Uses capability detection (hover/pointer) instead of screen size
 * for more reliable mobile device detection
 */
export default function MobileDevTools() {
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    // Check for touch device using both pointer and hover capabilities
    // pointer:coarse = touchscreen (not precise pointer like a mouse)
    // hover:none = device doesn't support hover interaction (most touchscreens)
    const checkMobileDevice = () => {
      const hasTouchscreen = window.matchMedia("(pointer: coarse)").matches;
      const noHoverSupport = window.matchMedia("(hover: none)").matches;

      // Device is likely mobile if it has a touchscreen AND doesn't support hover
      setIsMobileDevice(hasTouchscreen && noHoverSupport);
    };

    // Check initially
    checkMobileDevice();

    // Set up listeners for capability changes
    const touchMediaQuery = window.matchMedia("(pointer: coarse)");
    const hoverMediaQuery = window.matchMedia("(hover: none)");

    const handleMediaChange = () => checkMobileDevice();

    touchMediaQuery.addEventListener("change", handleMediaChange);
    hoverMediaQuery.addEventListener("change", handleMediaChange);

    // Clean up
    return () => {
      touchMediaQuery.removeEventListener("change", handleMediaChange);
      hoverMediaQuery.removeEventListener("change", handleMediaChange);
    };
  }, []);

  useEffect(() => {
    if (isMobileDevice) {
      // Load and initialize eruda directly in component
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/eruda";
      script.onload = () => window.eruda.init();
      document.body.appendChild(script);

      // Clean up when unmounted or when device type changes
      return () => {
        if (window.eruda) {
          window.eruda.destroy();
        }
        document
          .querySelectorAll('script[src="https://cdn.jsdelivr.net/npm/eruda"]')
          .forEach((el) => el.remove());
      };
    }
  }, [isMobileDevice]);

  return null;
}
