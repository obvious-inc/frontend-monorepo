import React from "react";
import { Item, useComboBoxState } from "react-stately";
import { useComboBox as useReactAriaCombobox, useButton } from "react-aria";

const useCombobox = ({
  value,
  options = [],
  disabled,
  onSelect,
  inputRef: inputRefExternal,
  ...props_
}) => {
  const props = {
    allowsCustomValue: true,
    ...props_,
    onSelectionChange: onSelect,
    selectedKey: value,
    disabledKeys: [
      ...props_.disabledKeys,
      ...options.filter((o) => o.disabled).map((o) => o.value),
    ],
    items: options.map((o) => ({ ...o, key: o.value })),
    children: (o) => <Item textValue={o.label} />,
    isDisabled: disabled,
  };

  const popoverRef = React.useRef();
  const buttonRef = React.useRef();
  const inputRefInternal = React.useRef();
  const listBoxRef = React.useRef();

  const inputRef = inputRefExternal ?? inputRefInternal;

  const state = useComboBoxState(props);

  const {
    buttonProps: buttonPropsInput,
    inputProps,
    listBoxProps,
    labelProps,
  } = useReactAriaCombobox(
    {
      ...props,
      popoverRef,
      inputRef,
      buttonRef,
      listBoxRef,
    },
    state
  );

  const { buttonProps } = useButton(buttonPropsInput, buttonRef);

  return {
    state,
    buttonProps,
    inputProps,
    listBoxProps,
    labelProps,
    buttonRef,
    inputRef,
    listBoxRef,
    popoverRef,
  };
};

export default useCombobox;
