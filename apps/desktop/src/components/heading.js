import { css } from "@emotion/react";

const Heading = ({ component: Component = "div", children, ...props }) => (
  <Component
    css={(t) =>
      css({
        fontSize: t.fontSizes.header,
        fontWeight: t.text.weights.header,
        color: t.colors.textHeader,
        fontFamily: t.fontStacks.headers,
        whiteSpace: "nowrap",
        textOverflow: "ellipsis",
        userSelect: "text",
        cursor: "default",
      })
    }
    {...props}
  >
    {children}
  </Component>
);

export default Heading;
