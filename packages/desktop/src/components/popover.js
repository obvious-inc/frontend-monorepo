import { useLatestCallback } from "@shades/common/react";
import { css } from "@emotion/react";
import React from "react";
import {
  DismissButton,
  FocusScope,
  mergeProps,
  OverlayContainer,
  useDialog,
  useModal,
  useOverlay,
  useOverlayPosition,
  useOverlayTrigger,
  useButton,
} from "react-aria";

const useComposedRefs = (...refs) => {
  return useLatestCallback((value) => {
    refs.forEach((ref) => {
      if (ref == null) return;
      if (typeof ref === "function") {
        ref(value);
        return;
      }

      ref.current = value;
    });
  });
};

const Context = React.createContext();

const useOverlayTriggerState = ({ controlledIsOpen, onChange: onChange_ }) => {
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = React.useState(false);
  const isControlled = controlledIsOpen != null;
  const isOpen = isControlled ? controlledIsOpen : uncontrolledIsOpen;

  const onChange = useLatestCallback(onChange_);

  const setOpen = React.useCallback(
    (args) => {
      if (isControlled) {
        const nextValue = typeof args === "function" ? args(isOpen) : args;
        onChange(nextValue);
        return;
      }

      setUncontrolledIsOpen(args);
    },
    [isControlled, isOpen, onChange]
  );

  const prevUncontrolledIsOpenRef = React.useRef(uncontrolledIsOpen);

  React.useEffect(() => {
    if (
      onChange == null ||
      prevUncontrolledIsOpenRef.current === uncontrolledIsOpen
    )
      return;

    onChange(uncontrolledIsOpen);
    prevUncontrolledIsOpenRef.current = uncontrolledIsOpen;
  }, [uncontrolledIsOpen, prevUncontrolledIsOpenRef, onChange]);

  const open = React.useCallback(() => setOpen(true), [setOpen]);
  const close = React.useCallback(() => setOpen(false), [setOpen]);
  const toggle = React.useCallback(() => setOpen((s) => !s), [setOpen]);

  return { isOpen, open, close, toggle };
};

export const Root = ({
  open,
  onOpenChange,
  children,
  placement = "top",
  offset = 8,
  containerPadding = 10,
}) => {
  const state = useOverlayTriggerState({
    controlledIsOpen: open,
    onChange: onOpenChange,
  });

  const triggerRef = React.useRef();
  const overlayRef = React.useRef();

  const { triggerProps, overlayProps } = useOverlayTrigger(
    { type: "dialog" },
    state,
    triggerRef
  );

  const { overlayProps: overlayPositionProps } = useOverlayPosition({
    targetRef: triggerRef,
    overlayRef,
    placement,
    offset,
    containerPadding,
    isOpen: state.isOpen,
    // Disable "close on scroll"
    onClose: () => {},
  });

  return (
    <Context.Provider
      value={{
        state,
        triggerRef,
        triggerProps,
        overlayRef,
        overlayProps: mergeProps(overlayProps, overlayPositionProps),
      }}
    >
      {children}
    </Context.Provider>
  );
};

export const Trigger = React.forwardRef(
  ({ asChild, children, disabled, ...props }, forwardedRef) => {
    const { state, triggerProps, triggerRef } = React.useContext(Context);
    const { buttonProps } = useButton({
      ...triggerProps,
      isDisabled: disabled,
    });
    const ref = useComposedRefs(triggerRef, forwardedRef);
    return typeof children === "function" ? (
      children({ isOpen: state.isOpen, props, ref })
    ) : asChild ? (
      React.cloneElement(children, { ...mergeProps(props, buttonProps), ref })
    ) : (
      <button {...mergeProps(props, buttonProps)} ref={ref}>
        {children}
      </button>
    );
  }
);

const ContentInner = React.forwardRef(
  ({ width = "auto", widthFollowTrigger, asChild, children }, forwardedRef) => {
    const {
      state,
      overlayProps: props,
      overlayRef,
      triggerRef,
    } = React.useContext(Context);

    const ref = useComposedRefs(overlayRef, forwardedRef);

    // Handle interacting outside the dialog and pressing
    // the Escape key to close the modal.
    const { overlayProps } = useOverlay(
      {
        onClose: state.close,
        isOpen: state.isOpen,
        isDismissable: true,
      },
      overlayRef
    );

    // Hide content outside the modal from screen readers.
    const { modalProps } = useModal();

    // Get props for the dialog and its title
    const { dialogProps, titleProps } = useDialog({}, overlayRef);

    const containerProps = mergeProps(
      overlayProps,
      dialogProps,
      props,
      modalProps
    );

    const dismissButtonElement = <DismissButton onDismiss={state.close} />;

    return (
      <FocusScope restoreFocus>
        {typeof children === "function" ? (
          children({
            isOpen: state.isOpen,
            containerProps,
            titleProps,
            dismissButtonElement,
            ref,
          })
        ) : asChild ? (
          React.cloneElement(children, { ...containerProps, ref })
        ) : (
          <div
            ref={ref}
            css={(theme) =>
              css({
                minWidth: "min-content",
                width: widthFollowTrigger
                  ? triggerRef.current?.offsetWidth ?? "auto"
                  : width,
                maxWidth: "calc(100vw - 2rem)",
                background: theme.colors.dialogBackground,
                borderRadius: "0.4rem",
                boxShadow:
                  "rgb(15 15 15 / 5%) 0px 0px 0px 1px, rgba(15, 15, 15, 0.1) 0px 3px 6px, rgba(15, 15, 15, 0.2) 0px 9px 24px",
                outline: "none", // TODO
              })
            }
            {...containerProps}
          >
            {children}
            {dismissButtonElement}
          </div>
        )}
      </FocusScope>
    );
  }
);

export const Content = React.forwardRef((props, forwardRef) => {
  const { state } = React.useContext(Context);

  if (!state.isOpen) return null;

  return (
    <OverlayContainer>
      <ContentInner {...props} ref={forwardRef} />
    </OverlayContainer>
  );
});
