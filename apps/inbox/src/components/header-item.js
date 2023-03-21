import { css } from "@emotion/react";

const HeaderItem = ({
  component: Component = "div",
  label,
  count = 0,
  ...props
}) => (
  <Component
    css={(t) =>
      css({
        fontSize: t.fontSizes.large,
        fontWeight: t.text.weights.header,
        display: "flex",
        alignItems: "center",
        marginRight: "3rem",
        textDecoration: "none",
        color: t.colors.textNormal,
        "&.active": {
          color: "white",
        },
      })
    }
    {...props}
  >
    <div
    // css={(t) =>
    //   css({
    //     position: "relative",
    //     ":after": {
    //       position: "absolute",
    //       top: "calc(100% + 0.2rem)",
    //       left: "50%",
    //       transform: "translateX(-50%)",
    //       content: '""',
    //       display: active ? "block" : "none",
    //       width: "0.5rem",
    //       height: "0.5rem",
    //       background: "white",
    //       borderRadius: "50%",
    //     },
    //   })
    // }
    >
      {label}
    </div>
    {count > 0 && (
      <div
        css={(t) => {
          return css({
            marginLeft: "0.7rem",
            fontSize: t.fontSizes.small,
            fontWeight: t.text.weights.default,
            lineHeight: 1,
          });
        }}
      >
        {count}
      </div>
    )}
  </Component>
);

export default HeaderItem;
