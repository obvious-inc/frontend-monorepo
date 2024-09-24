import React from "react";
import { css } from "@emotion/react";
import {
  useMenu,
  useMenuItem,
  useMenuSection,
  useSeparator,
  useMenuTrigger,
  useButton,
} from "react-aria";
import {
  Item,
  Section,
  useMenuTriggerState,
  useTreeState,
} from "react-stately";
import { isTouchDevice } from "@shades/common/utils";
import { Checkmark as CheckmarkIcon } from "./icons";
import * as Popover from "./popover.js";

const Context = React.createContext();

export const Root = ({
  children,
  placement = "bottom start",
  offset = 5,
  crossOffset,
  targetRef,
  ...props_
}) => {
  const [isOpen, setOpen] = React.useState(false);

  // Workaround for https://github.com/adobe/react-spectrum/issues/1513
  const props = {
    isOpen,
    onOpenChange: (open) => {
      if (open || !isTouchDevice()) {
        setOpen(open);
        return;
      }

      const touchendHandler = (e) => {
        e.preventDefault();
        clearTimeout(id);
        setOpen(open);
      };
      const id = setTimeout(() => {
        document.removeEventListener("touchend", touchendHandler);
        setOpen(open);
      }, 1000);
      document.addEventListener("touchend", touchendHandler, {
        once: true,
        capture: true,
      });
    },
    ...props_,
  };

  const state = useMenuTriggerState(props);
  const ref = React.useRef(null);
  const { menuTriggerProps, menuProps } = useMenuTrigger({}, state, ref);

  return (
    <Popover.Root
      triggerRef={ref}
      targetRef={targetRef}
      placement={placement}
      offset={offset}
      crossOffset={crossOffset}
      isOpen={state.isOpen}
      onOpenChange={state.setOpen}
    >
      <Context.Provider
        value={{
          menuTriggerProps,
          menuProps,
          triggerRef: ref,
          state,
        }}
      >
        {children}
      </Context.Provider>
    </Popover.Root>
  );
};

export const Trigger = ({ children, asChild }) => {
  const { menuTriggerProps, triggerRef } = React.useContext(Context);
  const { buttonProps } = useButton(menuTriggerProps);
  const props = asChild ? menuTriggerProps : buttonProps;
  return React.cloneElement(children, { ...props, ref: triggerRef });
  // return children({ props: buttonProps, ref: triggerRef });
};

export const Content = ({
  items,
  onAction,
  selectionMode,
  selectedKeys,
  disabledKeys,
  onSelectionChange,
  widthFollowTrigger = false,
  children,
  ...props
}) => {
  const { menuProps } = React.useContext(Context);
  return (
    <Popover.Content
      widthFollowTrigger={widthFollowTrigger}
      css={(theme) =>
        css({
          width: "min-content", // theme.dropdownMenus.width,
          minWidth: theme.dropdownMenus.minWidth,
          maxWidth: theme.dropdownMenus.maxWidth,
          padding: theme.dropdownMenus.padding,
          background: theme.colors.popoverBackground,
          borderRadius: theme.dropdownMenus.borderRadius,
          boxShadow: theme.dropdownMenus.boxShadow,
        })
      }
      {...props}
    >
      <Menu
        items={items}
        selectionMode={selectionMode}
        selectedKeys={selectedKeys}
        disabledKeys={disabledKeys}
        onAction={onAction}
        onSelectionChange={onSelectionChange}
        {...menuProps}
      >
        {children}
      </Menu>
    </Popover.Content>
  );
};

export { Item, Section };

const Menu = (props) => {
  const state = useTreeState(props);
  const ref = React.useRef(null);
  const { menuProps } = useMenu(props, state, ref);

  return (
    <ul
      ref={ref}
      css={(t) =>
        css({
          listStyle: "none",
          outline: "none",
          ".section-heading": {
            color: t.colors.textDimmed,
            fontSize: t.text.sizes.micro,
            fontWeight: t.text.weights.smallTextEmphasis,
            textTransform: "uppercase",
            padding: "0 0.8rem",
          },
        })
      }
      {...menuProps}
    >
      {[...state.collection].map((item) =>
        item.type === "section" ? (
          <MenuSection key={item.key} section={item} state={state} />
        ) : (
          <MenuItem key={item.key} item={item} state={state} />
        ),
      )}
    </ul>
  );
};

const MenuItem = ({ item, state }) => {
  const ref = React.useRef(null);
  const {
    menuItemProps,
    // isFocused,
    isSelected,
    // isDisabled,
  } = useMenuItem({ key: item.key }, state, ref);

  return (
    <li
      {...menuItemProps}
      ref={ref}
      css={(t) =>
        css({
          "--text-primary": t.colors.textPrimary,
          "--text-danger": t.colors.textDanger,
          color: `var(--color, ${t.colors.textNormal})`,
          width: "100%",
          minHeight: t.dropdownMenus.itemHeight,
          padding: "0.3rem 0.8rem",
          display: "inline-flex",
          gap: "1.2rem",
          alignItems: "center",
          justifyContent: "flex-start",
          lineHeight: 1.4,
          fontSize: t.fontSizes.menus,
          fontWeight: "400",
          cursor: "pointer",
          borderRadius: "0.3rem",
          whiteSpace: "nowrap",
          margin: "0.1rem 0",
          ":focus": {
            background: t.colors.backgroundModifierHover,
            outline: "none",
          },
          "&[aria-disabled]": {
            cursor: "default",
            color: t.colors.textMuted,
          },
          '&[aria-checked="true"]': {
            background: t.colors.backgroundModifierSelected,
            color: t.colors.textNormal,
          },
          '&[aria-checked="true"]:focys': {
            color: t.colors.textAccent,
          },
          ".content-container": {
            flex: 1,
            display: "flex",
            alignItems: "center",
          },
          ".icon-container": { padding: "0 0.4rem" },
          ".icon-container svg": { width: "1.1rem", height: "auto" },
        })
      }
      style={{
        "--color": item.props.primary
          ? "var(--text-primary)"
          : item.props.danger
            ? "var(--text-danger)"
            : undefined,
      }}
    >
      <div className="content-container">{item.rendered}</div>
      {isSelected && (
        <div className="icon-container">
          <CheckmarkIcon style={{ width: "1.1rem" }} />
        </div>
      )}
    </li>
  );
};

const MenuSection = ({ section, state, onAction, onClose }) => {
  const { itemProps, headingProps, groupProps } = useMenuSection({
    heading: section.rendered,
    "aria-label": section["aria-label"],
  });

  const { separatorProps } = useSeparator({
    elementType: "li",
  });

  return (
    <>
      {section.key !== state.collection.getFirstKey() && (
        <li
          {...separatorProps}
          css={(t) =>
            css({
              height: "0.1rem",
              background: t.colors.borderLighter,
              margin: `0.5rem -${t.dropdownMenus.padding}`,
            })
          }
        />
      )}
      <li {...itemProps}>
        {section.rendered && (
          <span {...headingProps} className="section-heading">
            {section.rendered}
          </span>
        )}
        <ul {...groupProps}>
          {[...section.childNodes].map((node) => (
            <MenuItem
              key={node.key}
              item={node}
              state={state}
              onAction={onAction}
              onClose={onClose}
            />
          ))}
        </ul>
      </li>
    </>
  );
};
