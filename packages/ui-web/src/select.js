import { css } from "@emotion/react";
import React from "react";
import { Item, useSelectState } from "react-stately";
import { HiddenSelect, useSelect, useListBox, useOption } from "react-aria";
import { isTouchDevice } from "@shades/common/utils";
import Button from "./button.js";
import * as Popover from "./popover.js";
import {
  CaretDown as CaretDownIcon,
  Checkmark as CheckmarkIcon,
} from "./icons.js";

const caretConfigBySize = {
  tiny: {
    width: "0.8rem",
    padding: 0,
  },
  small: {
    width: "0.9rem",
    padding: 0,
  },
};

const Select = React.forwardRef(
  (
    {
      placeholder = "Select an item",
      renderTriggerContent,
      value,
      options,
      onChange,
      icon,
      variant,
      size = "default",
      align = "left",
      width,
      fullWidth = true,
      multiline = true,
      buttonProps,
      ...props_
    },
    forwardedRef,
  ) => {
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
          e.stopPropagation();
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

    const selectProps = {
      ...props,
      selectedKey: value,
      disabledKeys: options.filter((o) => o.disabled).map((o) => o.value),
      onSelectionChange: (key) => onChange(key),
      items: options.map((o) => ({ ...o, key: o.value })),
      children: (o) => <Item textValue={o.textValue ?? o.label} />,
      isDisabled: props.disabled,
    };

    const state = useSelectState(selectProps);

    const internalRef = React.useRef();
    const triggerRef = forwardedRef ?? internalRef;
    const {
      // labelProps,
      triggerProps,
      valueProps,
      menuProps,
    } = useSelect(selectProps, state, triggerRef);

    const caretSize = caretConfigBySize[size]?.width ?? "1.1rem";
    const caretPadding = caretConfigBySize[size]?.padding ?? "0 0.2rem";

    return (
      <>
        {props.label != null && (
          <label
            htmlFor={triggerProps.id}
            css={(t) =>
              css({
                display: "inline-block",
                color: t.colors.textDimmed,
                fontSize: t.text.sizes.base,
                lineHeight: 1.2,
                margin: "0 0 0.8rem",
              })
            }
          >
            {props.label}
          </label>
        )}

        <HiddenSelect
          state={state}
          triggerRef={triggerRef}
          label={props.label}
          name={props.name}
        />

        <Popover.Root
          placement={`bottom ${align}`}
          offset={5}
          isOpen={state.isOpen}
          onOpenChange={state.setOpen}
          triggerRef={triggerRef}
        >
          <Popover.Trigger asButtonChild {...triggerProps}>
            <Button
              fullWidth={fullWidth}
              multiline={multiline}
              size={size}
              variant={variant}
              icon={icon ?? state.selectedItem?.value.icon}
              align={align}
              iconRight={
                <div style={{ padding: caretPadding }}>
                  <CaretDownIcon style={{ width: caretSize }} />
                </div>
              }
              {...buttonProps}
            >
              <span {...valueProps}>
                {renderTriggerContent != null ? (
                  renderTriggerContent(state.selectedItem?.key, options)
                ) : state.selectedItem == null ? (
                  placeholder
                ) : (
                  <>
                    <div>{state.selectedItem.value.label}</div>
                    {state.selectedItem.value.description != null && (
                      <div
                        css={(t) =>
                          css({
                            color: t.colors.textDimmed,
                            fontSize: t.text.sizes.small,
                          })
                        }
                      >
                        {state.selectedItem.value.description}
                      </div>
                    )}
                  </>
                )}
              </span>
            </Button>
          </Popover.Trigger>
          <Popover.Content width={width} widthFollowTrigger={width == null}>
            <ListBox {...menuProps} state={state} />
          </Popover.Content>
        </Popover.Root>
      </>
    );
  },
);

const ListBox = ({ state, ...props }) => {
  const ref = React.useRef();
  const {
    listBoxProps,
    // labelProps
  } = useListBox(props, state, ref);

  return (
    <>
      {/* <div {...labelProps}>{props.label}</div> */}
      <ul
        {...listBoxProps}
        ref={ref}
        css={(t) =>
          css({
            display: "block",
            padding: t.dropdownMenus.padding,
            listStyle: "none",
            ":focus": { outline: "none" },
          })
        }
      >
        {[...state.collection].map((item) => (
          <Option key={item.key} item={item} state={state} />
        ))}
      </ul>
    </>
  );
};

const Option = ({ item, state }) => {
  const ref = React.useRef();
  const { optionProps, labelProps, descriptionProps, isSelected, isDisabled } =
    useOption({ key: item.key }, state, ref);

  // const { isFocusVisible, focusProps } = useFocusRing();

  return (
    <li
      {...optionProps}
      // {...mergeProps(optionProps, focusProps)}
      ref={ref}
      css={(t) =>
        css({
          minHeight: t.dropdownMenus.itemHeight,
          padding: "0.5rem 0.8rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          lineHeight: 1.4,
          fontSize: t.fontSizes.menus,
          fontWeight: "400",
          color: isDisabled ? t.colors.textMuted : t.colors.textNormal,
          borderRadius: "0.3rem",
          outline: "none",
          cursor: isDisabled ? "not-allowed" : "pointer",
          ":focus": { background: t.colors.backgroundModifierHover },
        })
      }
      // style={{
      //   background: isFocusVisible ? "rgb(255 255 255 / 5%)" : undefined,
      // }}
    >
      {item.value.icon != null && (
        <div
          css={css({
            width: "3rem",
            marginRight: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          {item.value.icon}
        </div>
      )}
      <div css={css({ flex: 1 })}>
        <div {...labelProps}>{item.value.label}</div>
        <div
          {...descriptionProps}
          css={(t) =>
            css({
              color: isDisabled ? t.colors.textMuted : t.colors.textDimmed,
              fontSize: t.fontSizes.small,
            })
          }
        >
          {item.value.description}
        </div>
      </div>
      <div css={css({ padding: "0 0.5rem", marginLeft: "1.2rem" })}>
        {isSelected ? (
          <CheckmarkIcon style={{ width: "1.1rem" }} />
        ) : (
          <div style={{ width: "1.1rem" }} />
        )}
      </div>
    </li>
  );
};

export default Select;
