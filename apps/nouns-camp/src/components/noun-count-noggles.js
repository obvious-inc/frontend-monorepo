import React from "react";
import { css } from "@emotion/react";
import { Noggles as NogglesIcon } from "@shades/ui-web/icons";
import * as Tooltip from "@shades/ui-web/tooltip";

const NounCountNoggles = ({ count }) => (
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <span
        css={(t) =>
          css({
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: t.text.sizes.small,
            color: t.colors.textDimmed,
          })
        }
      >
        {count}
        <NogglesIcon
          style={{
            display: "inline-flex",
            width: "1.7rem",
            height: "auto",
          }}
        />
      </span>
    </Tooltip.Trigger>
    <Tooltip.Content side="top" sideOffset={5}>
      {count} {count === 1 ? "noun" : "nouns"}
    </Tooltip.Content>
  </Tooltip.Root>
);

export default NounCountNoggles;
