import { useMatchMedia } from "@shades/common/react";

const useMatchDesktopLayout = () => useMatchMedia("(min-width: 996px)");

export default useMatchDesktopLayout;
