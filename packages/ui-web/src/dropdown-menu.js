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
  footerNote,
  children,
  ...props
}) => {
  const { menuProps } = React.useContext(Context);
  return (
    <Popover.Content
      widthFollowTrigger={widthFollowTrigger}
      css={(t) =>
        css({
          width: "min-content", // theme.dropdownMenus.width,
          minWidth: t.dropdownMenus.minWidth,
          maxWidth: t.dropdownMenus.maxWidth,
          padding: t.dropdownMenus.padding,
          background: t.colors.popoverBackground,
          borderRadius: t.dropdownMenus.borderRadius,
          boxShadow: t.dropdownMenus.boxShadow,
          ".menu-root": {
            listStyle: "none",
            outline: "none",
            ".section-header": {
              color: t.colors.textDimmed,
              fontSize: t.text.sizes.micro,
              fontWeight: t.text.weights.smallTextEmphasis,
              textTransform: "uppercase",
              padding: "0 0.8rem",
            },
            ".separator": {
              height: "0.1rem",
              background: t.colors.borderLighter,
              margin: `0.5rem -${t.dropdownMenus.padding}`,
            },
            ".menu-item": {
              color: t.colors.textNormal,
              width: "100%",
              minHeight: t.dropdownMenus.itemHeight,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "flex-start",
              gap: "0.8rem",
              padding: "0.4rem 0.8rem",
              lineHeight: "calc(20/14)",
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
                color: t.colors.textMutedAlpha,
              },
              '&[aria-checked="true"]': {
                background: t.colors.backgroundModifierSelected,
                color: t.colors.textNormal,
              },
              '&[aria-checked="true"]:focus': {
                color: t.colors.textAccent,
              },
              "&[data-danger]": { color: t.colors.textDanger },
              "&[data-primary]": { color: t.colors.textPrimary },
              ".title-container": {
                flex: 1,
                minWidth: 0,
              },
              ".description-container": {
                color: t.colors.textDimmed,
                fontSize: t.text.sizes.tiny,
                paddingBottom: "0.1rem",
              },
              ".icon-container": {
                padding: "0.2rem 0",
                width: "1.6rem",
                height: "2rem",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                ".selected-checkmark": {
                  width: "1.1rem",
                  height: "auto",
                },
              },
            },
          },
          ".menu-footer": {
            borderTop: "0.1rem solid",
            borderColor: t.colors.borderLighter,
            margin: `-${t.dropdownMenus.padding}`,
            marginTop: t.dropdownMenus.padding,
            padding: t.dropdownMenus.padding,
            ".content": {
              color: t.colors.textMutedAlpha,
              fontSize: t.text.sizes.tiny,
              lineHeight: "calc(16/12)",
              padding: "0.4rem 0.8rem",
            },
          },
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
        footerNote={footerNote}
        {...menuProps}
      >
        {children}
      </Menu>
    </Popover.Content>
  );
};

export { Item, Section };

const Menu = ({ footerNote, ...props }) => {
  const state = useTreeState(props);
  const ref = React.useRef(null);
  const { menuProps } = useMenu(props, state, ref);

  return (
    <>
      <ul ref={ref} className="menu-root" {...menuProps}>
        {[...state.collection].map((item) =>
          item.type === "section" ? (
            <MenuSection key={item.key} section={item} state={state} />
          ) : (
            <MenuItem key={item.key} item={item} state={state} />
          ),
        )}
      </ul>
      {footerNote != null && (
        <div className="menu-footer">
          <div className="content">{footerNote}</div>
        </div>
      )}
    </>
  );
};

const MenuItem = ({ item, state }) => {
  const ref = React.useRef(null);
  const {
    menuItemProps,
    descriptionProps,
    labelProps,
    // isFocused,
    isSelected,
    // isDisabled,
  } = useMenuItem({ key: item.key }, state, ref);

  return (
    <li
      {...menuItemProps}
      ref={ref}
      className="menu-item"
      data-primary={item.props.primary || undefined}
      data-danger={item.props.danger || undefined}
    >
      {item.props.icon && (
        <div className="icon-container">{item.props.icon}</div>
      )}
      <div className="title-container">
        <div {...labelProps}>{item.rendered ?? item.props.title}</div>
        {item.props.description && (
          <div className="description-container" {...descriptionProps}>
            {item.props.description}
          </div>
        )}
      </div>
      {(isSelected || item.props.iconRight) && (
        <div className="icon-container">
          {isSelected ? (
            <CheckmarkIcon className="selected-checkmark" />
          ) : (
            item.props.iconRight
          )}
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
        <li {...separatorProps} className="separator" />
      )}
      <li {...itemProps}>
        {section.rendered && (
          <span {...headingProps} className="section-header">
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
