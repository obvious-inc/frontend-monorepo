import { css } from "@emotion/react";

export const Small = (props) => (
  <div
    css={(theme) =>
      css({
        fontSize: theme.text.sizes.small,
        color: theme.colors.textDimmed,
        lineHeight: 1.3,
      })
    }
    {...props}
  />
);
