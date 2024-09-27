import React from "react";
import { css } from "@emotion/react";
import * as Popover from "@shades/ui-web/popover";
import InlineButton from "@shades/ui-web/inline-button";
import NounPreviewPopoverTrigger from "./noun-preview-popover-trigger.js";
import { array as arrayUtils } from "@shades/common/utils";

const NounsPreviewPopoverTrigger = React.forwardRef(
  (
    { nounIds, contextAccount, popoverPlacement = "top", children, ...props },
    triggerRef,
  ) => {
    if (nounIds.length === 1)
      return (
        <NounPreviewPopoverTrigger
          nounId={nounIds[0]}
          contextAccount={contextAccount}
          popoverPlacement={popoverPlacement}
          {...props}
        >
          {children}
        </NounPreviewPopoverTrigger>
      );

    const sortedNounIds = arrayUtils.sortBy((n) => parseInt(n), nounIds);

    const renderTrigger = () => {
      if (children != null) return children;

      return (
        <button
          ref={triggerRef}
          css={css({
            outline: "none",
            "@media(hover: hover)": {
              cursor: "pointer",
              ":hover": {
                textDecoration: "underline",
              },
            },
          })}
        >
          <InlineButton
            data-noun-id
            component="div"
            variant="link"
            css={css({ userSelect: "text" })}
            {...props}
          >
            {nounIds.length} nouns
          </InlineButton>
        </button>
      );
    };

    return (
      <Popover.Root placement={popoverPlacement} {...props}>
        <Popover.Trigger asChild>{renderTrigger()}</Popover.Trigger>
        <Popover.Content>
          {() => (
            <div
              data-wrap={sortedNounIds.length > 6}
              css={css({
                width: "max-content",
                padding: "1.2rem 1.2rem 0.8rem",
                overflow: "hidden",
                display: "flex",
                gap: "1.2rem",
                flexWrap: "wrap",
                justifyContent: "flex-start",
                '&[data-wrap="true"]': {
                  width: "min-content",
                  minWidth: "min(32rem, calc(100vw - 2rem))",
                  maxWidth: "min(36.4rem, calc(100vw - 2rem))",
                },
              })}
            >
              {sortedNounIds.map((id) => (
                <NounPreviewPopoverTrigger
                  key={id}
                  nounId={id}
                  contextAccount={contextAccount}
                  variant="portrait"
                />
              ))}
            </div>
          )}
        </Popover.Content>
      </Popover.Root>
    );
  },
);

export default NounsPreviewPopoverTrigger;
