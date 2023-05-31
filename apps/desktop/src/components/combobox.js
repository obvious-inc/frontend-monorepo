import * as Popover from "@shades/ui-web/popover";
import useCombobox from "../hooks/combobox";

export { Item, Section } from "../hooks/combobox.js";

const Combobox = ({
  targetRef,
  inputRef: inputRefExternal,
  renderInput,
  renderListbox,
  popoverPlacement = "bottom left",
  popoverOffset = 5,
  popoverMaxHeight,
  ...props
}) => {
  const { state, popoverRef, inputRef, listBoxRef, listBoxProps, inputProps } =
    useCombobox({ ...props, inputRef: inputRefExternal });

  return (
    <>
      {renderInput({ inputRef, inputProps })}
      <Popover.Root
        placement={popoverPlacement}
        offset={popoverOffset}
        maxHeight={popoverMaxHeight}
        isOpen={state.isOpen}
        onOpenChange={state.setOpen}
        triggerRef={inputRef}
        targetRef={targetRef}
        isDialog={false}
      >
        <Popover.Content ref={popoverRef} widthFollowTrigger>
          {renderListbox({ listBoxRef, listBoxProps, state })}
        </Popover.Content>
      </Popover.Root>
    </>
  );
};

export default Combobox;
