import React from "react";
import { css } from "@emotion/react";
import * as Popover from "@shades/ui-web/popover";
import NounAvatar from "./noun-avatar.js";
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
              css={(t) =>
                css({
                  width: "min-content",
                  maxWidth: "min(calc(100vw - 1.2rem), 36.4rem)",
                  minWidth: "32rem",
                  padding: "1rem",
                  marginBottom: "-0.2rem",
                  overflow: "hidden",
                  display: "flex",
                  gap: "1.2rem",
                  flexWrap: "wrap",
                  justifyContent: "flex-start",
                  "[data-id]": {
                    fontSize: t.text.sizes.tiny,
                    color: t.colors.textDimmed,
                    margin: "0.2rem 0 0",
                    textAlign: "center",
                  },
                })
              }
            >
              {sortedNounIds.map((id) => (
                <NounPreviewPopoverTrigger
                  key={id}
                  nounId={id}
                  contextAccount={contextAccount}
                >
                  <button
                    css={css({
                      outline: "none",
                      "@media(hover: hover)": {
                        cursor: "pointer",
                        ":hover": {
                          "[data-id]": { textDecoration: "underline" },
                        },
                      },
                    })}
                  >
                    <NounAvatar id={id} size="3.2rem" />
                    <div data-id>{id}</div>
                  </button>
                </NounPreviewPopoverTrigger>
              ))}
            </div>
          )}
        </Popover.Content>
      </Popover.Root>
    );
  },
);

export default NounsPreviewPopoverTrigger;
