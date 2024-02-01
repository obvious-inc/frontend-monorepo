import { css } from "@emotion/react";

const NavBar = ({ children, ...props }) => (
  <div
    css={(t) =>
      css({
        height: t.mainHeader.height,
        padding: "0 1.6rem",
        display: "flex",
        alignItems: "center",
        boxShadow: t.mainHeader.shadow,
        minWidth: 0,
        width: "100%",
      })
    }
    {...props}
  >
    {children}
  </div>
);

export default NavBar;
