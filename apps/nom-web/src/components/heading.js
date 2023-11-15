import { css } from "@emotion/react";

const Heading = ({
  singleLine = true,
  component: Component = "div",
  children,
  ...props
}) => (
  <Component
    css={(t) =>
      css({
        fontSize: t.fontSizes.header,
        fontWeight: t.text.weights.header,
        color: t.colors.textHeader,
        fontFamily: t.fontStacks.headers,
        whiteSpace: "var(--white-space)",
        textOverflow: "ellipsis",
        userSelect: "text",
        cursor: "default",
      })
    }
    style={{
      ...props.style,
      "--white-space": singleLine ? "nowrap" : undefined,
    }}
    {...props}
  >
    {children}
  </Component>
);

export default Heading;
