import React from "react";
import { css } from "@emotion/react";
import { useTab, useTabList, useTabPanel } from "react-aria";
import { Item, useTabListState } from "react-stately";

export const Root = ({ className, ...props }) => {
  const state = useTabListState(props);
  const ref = React.useRef();
  const { tabListProps } = useTabList(props, state, ref);

  return (
    <>
      <div
        ref={ref}
        {...tabListProps}
        css={(t) =>
          css({
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: "auto",
            gridGap: "2.4rem",
            justifyContent: "flex-start",
            borderBottom: "0.1rem solid transparent",
            borderColor: t.colors.borderLight,
            '[role="tab"]': {
              padding: "0.5rem",
              fontSize: t.text.sizes.tab,
              color: t.colors.textDimmed,
              outline: "none",
              margin: "0 -0.5rem",
              borderTopLeftRadius: "0.3rem",
              borderTopRightRadius: "0.3rem",
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
              ":focus-visible": {
                boxShadow: t.shadows.focus,
              },
              "@media(hover: hover)": {
                ":not([aria-disabled])": {
                  cursor: "pointer",
                  ":hover": { color: t.colors.textNormal },
                },
              },
            },
          })
        }
        className={className}
      >
        {[...state.collection].map((item) => (
          <Tab
            key={item.key}
            item={item}
            state={state}
            orientation={props.orientation}
          />
        ))}
      </div>
      <TabPanel key={state.selectedItem?.key} state={state} />
    </>
  );
};

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

  return (
    <div {...tabProps} ref={ref}>
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
