import { css, keyframes } from "@emotion/react";

const rotateAnimation = keyframes({
  "100%": {
    transform: "rotate(360deg)",
  },
});

const dashAnimation = keyframes({
  "0%": {
    strokeDasharray: "90 150",
    strokeDashoffset: 90,
  },
  "50%": {
    strokeDasharray: "90 150",
    strokeDashoffset: -45,
  },
  "100%": {
    strokeDasharray: "90 150",
    strokeDashoffset: -120,
  },
});

const Spinner = ({
  inline = false,
  size,
  color,
  strokeWidth = 6,
  style,
  ...props
}) => (
  <svg
    data-inline={inline || undefined}
    viewBox="0 0 50 50"
    css={css({
      width: "var(--size, 2rem)",
      height: "auto",
      color: "var(--color, currentColor)",
      animation: `${rotateAnimation} 2.5s linear infinite`,
      circle: {
        animation: `${dashAnimation} 2s ease-in-out infinite`,
      },
      "&[data-inline]": {
        display: "inline-block",
        width: "0.85em",
      },
    })}
    style={{ "--size": size, "--color": color, ...style }}
    {...props}
  >
    <circle
      cx="25"
      cy="25"
      r="20"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={strokeWidth}
    />
  </svg>
);

export default Spinner;
