import { useHover as useReactAriaHover } from "react-aria";

const useHover = () => {
  const { isHovered, hoverProps } = useReactAriaHover({});
  return [isHovered, hoverProps];
};

export default useHover;
