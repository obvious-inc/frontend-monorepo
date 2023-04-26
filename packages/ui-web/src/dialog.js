import React from "react";
import { css, useTheme } from "@emotion/react";
import { Overlay, useDialog, useModalOverlay } from "react-aria";

const Dialog = React.forwardRef(({ children, ...props }, dialogRef) => {
  const internalRef = React.useRef();
  const ref = dialogRef ?? internalRef;

  const { dialogProps, titleProps } = useDialog(props, ref);

  return (
    <div ref={ref} {...dialogProps} {...props}>
      {typeof children === "function" ? children({ titleProps }) : children}
    </div>
  );
});

const Modal = ({
  state,
  children,
  underlayProps: customUnderlayProps,
  ...overlayProps
}) => {
  let ref = React.useRef(null);
  let { modalProps, underlayProps } = useModalOverlay({}, state, ref);

  return (
    <Overlay>
      <div {...underlayProps} {...customUnderlayProps}>
        <div {...modalProps} {...overlayProps} ref={ref}>
          {children}
        </div>
      </div>
    </Overlay>
  );
};

const StyledDialog = React.forwardRef(
  (
    {
      isOpen,
      onRequestClose,
      width = "62rem",
      height,
      transparent,
      underlayProps,
      children,
      ...props
    },
    dialogRef
  ) => {
    const theme = useTheme();

    if (!isOpen) return null;

    return (
      <Modal
        state={{ isOpen, close: onRequestClose }}
        css={css({
          width: "100%",
          maxWidth: width,
          color: theme.colors.textNormal,
          background: theme.colors.dialogBackground,
          borderTopLeftRadius: "0.6rem",
          borderTopRightRadius: "0.6rem",
          display: "flex",
          flexDirection: "column",
          boxShadow: theme.shadows.elevationHigh,
          height: "100%",
          outline: "none",
          "@media (min-width: 600px)": {
            borderRadius: "0.6rem",
            height: height ?? "auto",
            maxHeight: height ?? "min(calc(100% - 3rem), 82rem)",
          },
        })}
        underlayProps={{
          ...underlayProps,
          css: css(
            {
              position: "fixed",
              zIndex: 10,
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              overflow: "auto",
              background: transparent ? "none" : "hsl(0 0% 0% / 40%)",
              padding: "6rem 1.5rem 0",
              "@media (min-width: 600px)": {
                padding: "2.8rem",
                alignItems: "center",
              },
            },
            underlayProps?.css
          ),
        }}
        {...props}
      >
        <Dialog ref={dialogRef}>{children}</Dialog>
      </Modal>
    );
  }
);

export default StyledDialog;
