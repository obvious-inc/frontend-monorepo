import { useComposedRefs } from "@shades/common/react";
import { css } from "@emotion/react";
import React from "react";
import { useOverlayTriggerState } from "@react-stately/overlays";
import {
  DismissButton,
  mergeProps,
  Overlay,
  usePopover,
  useOverlayTrigger,
  useButton,
  useDialog,
} from "react-aria";

const Dialog = ({ children, ...props }) => {
  const ref = React.useRef();

  const {
    dialogProps,
    // titleProps
  } = useDialog(props, ref);
  return (
    <div ref={ref} {...dialogProps} style={{ outline: "none" }}>
      {children}
    </div>
  );
};

const Context = React.createContext();

export const Root = ({
  isOpen,
  onOpenChange,
  children,
  placement: preferredPlacement = "top",
  offset = 8,
  containerPadding = 10,
  triggerRef: triggerRefExternal,
  targetRef,
  isDialog = true,
  isModal = isDialog,
  dialogProps = {},
  ...props
}) => {
  const state = useOverlayTriggerState({ isOpen, onOpenChange });

  const popoverRef = React.useRef();
  const triggerRefInternal = React.useRef();
  const triggerRef = triggerRefExternal ?? triggerRefInternal;

  const {
    popoverProps,
    underlayProps,
    // arrowProps,
    placement,
  } = usePopover(
    {
      isNonModal: !isModal,
      ...props,
      triggerRef: targetRef ?? triggerRef,
      popoverRef,
      placement: preferredPlacement,
      offset,
      containerPadding,
    },
    state
  );

  const { triggerProps, overlayProps } = useOverlayTrigger(
    { type: "dialog" },
    state,
    triggerRef
  );

  return (
    <Context.Provider
      value={{
        state,
        triggerRef,
        popoverRef,
        triggerProps,
        targetRef,
        popoverProps: mergeProps(popoverProps, overlayProps),
        underlayProps,
        dialogProps,
        placement,
        isDialog,
        isModal,
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
  (
    { width = "auto", widthFollowTrigger, children, ...props },
    forwardedRef
  ) => {
    const {
      isDialog,
      state,
      popoverProps,
      popoverRef,
      dialogProps,
      triggerRef,
      targetRef,
    } = React.useContext(Context);

    const ref = useComposedRefs(popoverRef, forwardedRef);
    const anchorRef = targetRef ?? triggerRef;

    const containerProps = isDialog
      ? mergeProps(props, dialogProps, popoverProps)
      : mergeProps(props, popoverProps);

    const dismissButtonElement = <DismissButton onDismiss={state.close} />;

    return typeof children === "function" ? (
      children({
        ref,
        props: containerProps,
        isOpen: state.isOpen,
        dismissButtonElement,
      })
    ) : (
      <div
        ref={ref}
        css={(t) =>
          css({
            minWidth: widthFollowTrigger ? 0 : "min-content",
            width: widthFollowTrigger
              ? anchorRef.current?.offsetWidth ?? "auto"
              : width,
            maxWidth: "calc(100vw - 2rem)",
            background: t.colors.dialogBackground,
            borderRadius: "0.6rem",
            boxShadow:
              "rgb(15 15 15 / 5%) 0px 0px 0px 1px, rgba(15, 15, 15, 0.1) 0px 3px 6px, rgba(15, 15, 15, 0.2) 0px 9px 24px",
            outline: "none", // TODO
            overflow: "auto",
          })
        }
        {...containerProps}
      >
        {dismissButtonElement}
        {isDialog ? <Dialog {...dialogProps}>{children}</Dialog> : children}
        {dismissButtonElement}
      </div>
    );
  }
);

export const Content = React.forwardRef((props, ref) => {
  const { state, isModal, underlayProps } = React.useContext(Context);

  if (!state.isOpen) return null;

  return (
    <Overlay>
      {isModal && (
        <div
          {...underlayProps}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
          }}
        />
      )}
      <ContentInner {...props} ref={ref} />
    </Overlay>
  );
});
