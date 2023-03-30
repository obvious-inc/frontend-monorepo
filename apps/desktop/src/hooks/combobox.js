import React from "react";
import { useComboBoxState } from "react-stately";
import { useComboBox as useReactAriaCombobox, useButton } from "react-aria";
import { useLatestCallback } from "@shades/common/react";

export { Item, Section } from "react-stately";

const useCombobox = ({
  // options = [],
  disabled,
  onSelect,
  inputRef: inputRefExternal,
  ...props_
}) => {
  const props = {
    allowsCustomValue: true,
    shouldCloseOnBlur: true,
    ...props_,
    onSelectionChange: onSelect,
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

  const selectFirstKey = useLatestCallback(() => {
    const findFocusable = (key) => {
      if (key == null) return null;
      const item = state.collection.getItem(key);
      if (item.type === "section" || props.disabledKeys?.includes(key))
        return findFocusable(state.collection.getKeyAfter(key));
      return key;
    };

    const firstFocusableKey = findFocusable(state.collection.getFirstKey());

    if (firstFocusableKey != null)
      state.selectionManager.setFocusedKey(firstFocusableKey);
  });

  React.useEffect(() => {
    if (props.items.length === 0) return;
    selectFirstKey();
  }, [props.items, selectFirstKey]);

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
