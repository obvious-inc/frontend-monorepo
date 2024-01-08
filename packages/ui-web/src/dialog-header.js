import { css } from "@emotion/react";
import { Cross as CrossIcon } from "./icons.js";
import Button from "./button.js";

const DialogHeader = ({ title, subtitle, titleProps, dismiss }) => (
  <header
    css={css({
      display: "grid",
      gridTemplateColumns: "minmax(0,1fr) auto",
      alignItems: "flex-start",
      margin: "0 0 1.5rem",
      "@media (min-width: 600px)": {
        margin: "0 0 2rem",
      },
    })}
  >
    <h1
      css={(t) =>
        css({
          fontSize: t.text.sizes.headerLarge,
          color: t.colors.textHeader,
          lineHeight: 1.2,
        })
      }
      {...titleProps}
    >
      {title}
      {subtitle != null && (
        <div
          css={(t) =>
            css({
              fontSize: t.text.sizes.base,
              color: t.colors.textDimmed,
              fontWeight: t.text.weights.normal,
              lineHeight: 1.5,
            })
          }
        >
          {subtitle}
        </div>
      )}
    </h1>
    {dismiss != null && (
      <Button
        size="small"
        onClick={() => {
          dismiss();
        }}
        css={css({ width: "2.8rem", padding: 0 })}
      >
        <CrossIcon
          style={{ width: "1.5rem", height: "auto", margin: "auto" }}
        />
      </Button>
    )}
  </header>
);

export default DialogHeader;
