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
  crossOffset = 0,
  containerPadding = 10,
  triggerRef: triggerRefExternal,
  targetRef,
  isDialog = true,
  dialogProps = {},
  ...props
}) => {
  const state = useOverlayTriggerState({ isOpen, onOpenChange });

  const popoverRef = React.useRef();
  const triggerRefInternal = React.useRef();
  const triggerRef = triggerRefExternal ?? triggerRefInternal;

  const { triggerProps, overlayProps } = useOverlayTrigger(
    { type: "dialog" },
    state,
    triggerRef,
  );

  return (
    <Context.Provider
      value={{
        state,
        triggerRef,
        popoverRef,
        triggerProps,
        targetRef,
        overlayProps,
        dialogProps,
        placement: preferredPlacement,
        offset,
        crossOffset,
        containerPadding,
        isDialog,
        popoverInputProps: props,
      }}
    >
      {children}
    </Context.Provider>
  );
};

export const Trigger = React.forwardRef(
  ({ asButtonChild, asChild, children, disabled, ...props }, forwardedRef) => {
    const { triggerProps, triggerRef } = React.useContext(Context);
    const useButtonInput = {
      ...triggerProps,
      ...props,
      isDisabled: disabled ?? props.isDisabled,
      // elementType: 'span'
    };
    const { buttonProps } = useButton(useButtonInput);

    const ref = useComposedRefs(triggerRef, forwardedRef);

    // `asButtonChild` indicates that the child itself will call `useButton`
    return asButtonChild ? (
      React.cloneElement(children, { ...useButtonInput, ref })
    ) : asChild ? (
      React.cloneElement(children, { ...buttonProps, ref })
    ) : (
      <button {...props} {...buttonProps} ref={ref}>
        {children}
      </button>
    );
  },
);

const ContentInner = React.forwardRef(
  (
    { width = "auto", widthFollowTrigger, children, ...props },
    forwardedRef,
  ) => {
    const {
      isDialog,
      state,
      popoverRef,
      dialogProps,
      overlayProps,
      triggerRef,
      targetRef,
      placement: preferredPlacement,
      offset,
      crossOffset,
      containerPadding,
      popoverInputProps,
    } = React.useContext(Context);

    const {
      popoverProps,
      underlayProps,
      // arrowProps,
      // placement,
    } = usePopover(
      {
        isNonModal: !isDialog, // Should be rare, only for combobox
        ...props,
        triggerRef: targetRef ?? triggerRef,
        popoverRef,
        placement: preferredPlacement,
        offset,
        crossOffset,
        containerPadding,
        ...popoverInputProps,
      },
      state,
    );

    const ref = useComposedRefs(popoverRef, forwardedRef);
    const anchorRef = targetRef ?? triggerRef;

    const containerProps = isDialog
      ? mergeProps(props, dialogProps, overlayProps, popoverProps)
      : mergeProps(props, overlayProps, popoverProps);

    const dismissButtonElement = <DismissButton onDismiss={state.close} />;

    return (
      <>
        {isDialog && (
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
        <div
          ref={ref}
          css={(t) =>
            css({
              // Since Emotion’s <Global /> doesn’t work yet in Next we have
              // to specify this on anything that’s outside the root div
              colorScheme: t.name === "dark" ? "dark" : "light",

              minWidth: widthFollowTrigger ? 0 : "min-content",
              width: widthFollowTrigger
                ? anchorRef.current?.offsetWidth ?? "auto"
                : width,
              maxWidth: "calc(100vw - 2rem)",
              color: t.colors.textNormal,
              background: t.colors.popoverBackground,
              borderRadius: "0.6rem",
              boxShadow: t.shadows.elevationHigh,
              outline: "none", // TODO
              overflow: "auto",
            })
          }
          {...containerProps}
          style={{ ...containerProps.style, zIndex: 10, ...props.style }}
        >
          {dismissButtonElement}
          {isDialog ? (
            <Dialog {...dialogProps}>
              {React.cloneElement(children, { close: state.close })}
            </Dialog>
          ) : (
            children
          )}
          {dismissButtonElement}
        </div>
      </>
    );
  },
);

export const Content = React.forwardRef((props, ref) => {
  const { state } = React.useContext(Context);

  if (!state.isOpen) return null;

  return (
    <Overlay>
      <ContentInner {...props} ref={ref} />
    </Overlay>
  );
});
