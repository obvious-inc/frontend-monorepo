import React from "react";
import { css } from "@emotion/react";
import {
  useTab,
  useTabList,
  useTabPanel,
  useFocusRing,
  mergeProps,
} from "react-aria";
import { Item, useTabListState } from "react-stately";
import Button from "@shades/ui-web/button";

export const Root = React.forwardRef(({ className, ...props }, externalRef) => {
  const state = useTabListState(props);
  const internalRef = React.useRef();
  const ref = externalRef ?? internalRef;
  const { tabListProps } = useTabList(props, state, ref);

  return (
    <>
      <div
        ref={ref}
        {...tabListProps}
        css={(t) =>
          css({
            position: "relative",
            ":after": {
              content: '""',
              display: "block",
              height: "0.1rem",
              position: "absolute",
              top: "calc(100% - 0.2rem)",
              left: 0,
              width: "100%",
              background: t.colors.borderLight,
            },
            "[data-content]": {
              display: "grid",
              gridAutoFlow: "column",
              gridAutoColumns: "auto",
              gridGap: "2.4rem",
              justifyContent: "flex-start",
              padding: "0.3rem 0.8rem",
              margin: "-0.3rem -0.8rem 0",
              overflowY: "hidden",
              overflowX: "auto",
              "::-webkit-scrollbar": {
                display: "none",
              },
            },
            '[role="tab"]': {
              padding: "0.5rem",
              fontSize: t.text.sizes.tab,
              color: t.colors.textDimmed,
              outline: "none",
              margin: "0 -0.5rem",
              borderTopLeftRadius: "0.3rem",
              borderTopRightRadius: "0.3rem",
              whiteSpace: "nowrap",
              "&[data-focus-visible]": {
                boxShadow: t.shadows.focus,
              },
              '&[aria-selected="true"]': {
                color: t.colors.textNormal,
                position: "relative",
                ":after": {
                  content: '""',
                  display: "block",
                  height: "0.2rem",
                  position: "absolute",
                  top: "100%",
                  left: "0.5rem",
                  right: "0.5rem",
                  background: t.colors.primary,
                },
              },
              "@media(hover: hover)": {
                cursor: "pointer",
                "&[aria-disabled]": { cursor: "not-allowed" },
                ":not([aria-disabled])": {
                  ":hover": { color: t.colors.textNormal },
                },
              },
            },
          })
        }
        className={className}
      >
        <div data-content>
          {[...state.collection].map((item) => (
            <Tab
              key={item.key}
              item={item}
              state={state}
              orientation={props.orientation}
            />
          ))}
        </div>
      </div>
      <TabPanel key={state.selectedItem?.key} state={state} />
    </>
  );
});

export const EmptyPlaceholder = ({
  title,
  description,
  buttonLabel,
  buttonProps,
  ...props
}) => (
  <div
    css={(t) =>
      css({
        textAlign: "center",
        color: t.colors.textDimmed,
        h3: {
          fontSize: t.text.sizes.large,
          fontWeight: t.text.weights.normal,
          margin: "0 0 0.8rem",
        },
      })
    }
    {...props}
  >
    {title != null && <h3>{title}</h3>}
    {description != null && <p>{description}</p>}
    {buttonLabel != null && (
      <Button style={{ marginTop: "3.2rem" }} {...buttonProps}>
        {buttonLabel}
      </Button>
    )}
  </div>
);

export { Item };

const Tab = ({
  item,
  state,
  // orientation
}) => {
  const { key, rendered } = item;
  const ref = React.useRef();
  const {
    tabProps,
    // isSelected,
    // isDisabled
  } = useTab({ key }, state, ref);

  const { isFocusVisible, focusProps } = useFocusRing();

  return (
    <div
      {...mergeProps(focusProps, tabProps)}
      data-focus-visible={isFocusVisible ? true : undefined}
      ref={ref}
    >
      {rendered}
    </div>
  );
};

const TabPanel = ({ state, ...props }) => {
  const ref = React.useRef();
  const { tabPanelProps } = useTabPanel(props, state, ref);

  return (
    <div {...tabPanelProps} ref={ref} css={css({ flex: 1, minHeight: 0 })}>
      {state.selectedItem?.props.children}
    </div>
  );
};
