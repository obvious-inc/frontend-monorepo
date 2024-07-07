import { useMatchMedia } from "@shades/common/react";

const useMatchDesktopLayout = () => useMatchMedia("(min-width: 1152px)");

export default useMatchDesktopLayout;
