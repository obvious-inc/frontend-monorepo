import React from "react";
import { css } from "@emotion/react";
import { ArrowDownSmall as ArrowDownSmallIcon } from "@shades/ui-web/icons";

const VotesTagGroup = React.memo(
  ({
    for: for_,
    against,
    abstain,
    quorum,
    highlight,
    component: Component = "span",
    ...props
  }) => (
    <Component
      css={(t) =>
        css({
          display: "inline-flex",
          gap: "0.1rem",
          whiteSpace: "nowrap",
          fontSize: t.text.sizes.micro,
          lineHeight: 1.2,
          color: t.colors.textDimmed,
          borderRadius: "0.2rem",
          "& > *": {
            display: "flex",
            padding: "0.3em 0.5em",
            background: t.colors.backgroundModifierNormal,
            minWidth: "1.86rem",
            justifyContent: "center",
          },
          "& > *:first-of-type": {
            borderTopLeftRadius: "0.2rem",
            borderBottomLeftRadius: "0.2rem",
          },
          "& > *:last-of-type": {
            borderTopRightRadius: "0.2rem",
            borderBottomRightRadius: "0.2rem",
          },
          ".quorum": {
            marginLeft: "0.3em",
          },
          '[data-highlight="true"]': {
            color: t.colors.textNormal,
            fontWeight: t.text.weights.smallTextEmphasis,
            background: t.colors.backgroundModifierStrong,
            ".quorum": {
              color: t.colors.textDimmed,
              fontWeight: t.text.weights.normal,
            },
          },
          "[data-arrow]": {
            width: "0.9rem",
            marginLeft: "0.2rem",
            marginRight: "-0.1rem",
          },
          '[data-arrow="up"]': {
            transform: "scaleY(-1)",
          },
        })
      }
      {...props}
    >
      <span data-for={for_} data-highlight={highlight === "for"}>
        {for_}
        <ArrowDownSmallIcon data-arrow="up" />
        {quorum != null && <span className="quorum"> / {quorum}</span>}
      </span>
      <span data-abstain={abstain} data-highlight={highlight === "abstain"}>
        {abstain}
      </span>
      <span data-against={against} data-highlight={highlight === "against"}>
        {against}
        <ArrowDownSmallIcon data-arrow="down" />
      </span>
    </Component>
  ),
);

export default VotesTagGroup;
