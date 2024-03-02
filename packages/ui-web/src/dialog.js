import React from "react";
import { css } from "@emotion/react";
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

const ModalDialog = React.forwardRef(
  (
    {
      isOpen,
      onRequestClose,
      width = "62rem",
      height,
      transparent,
      tray = false,
      backdrop = "normal",
      modalProps: customModalProps,
      underlayProps: customUnderlayProps,
      children,
      ...dialogProps
    },
    dialogRef,
  ) => {
    const modalRef = React.useRef(null);

    const { modalProps, underlayProps } = useModalOverlay(
      { isDismissable: true },
      { isOpen, close: onRequestClose },
      modalRef,
    );

    if (!isOpen) return null;

    return (
      <Overlay>
        <div
          data-tray={tray}
          {...underlayProps}
          {...customUnderlayProps}
          css={[
            (t) =>
              css({
                // Since Emotion’s <Global /> doesn’t work yet in Next we have
                // to specify this on anything that’s outside the root div
                colorScheme: t.name === "dark" ? "dark" : "light",

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
                background: "var(--background, hsl(0 0% 0% / 40%))",
                padding: "6rem 0 0",
                "[data-modal]": {
                  width: "100%",
                  color: t.colors.textNormal,
                  background: t.colors.dialogBackground,
                  borderTopLeftRadius: "0.6rem",
                  borderTopRightRadius: "0.6rem",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: t.shadows.elevationHigh,
                  height: "100%",
                  outline: "none",
                },
                "@media (min-width: 600px)": {
                  // Use centered dialogs on larger screens
                  "[data-modal]": {
                    maxWidth: "var(--max-width)",
                  },
                  '&:not([data-tray="true"])': {
                    padding: "2.8rem",
                    alignItems: "center",
                    "[data-modal]": {
                      borderRadius: "0.6rem",
                      height: "var(--desktop-set-height, auto)",
                      maxHeight:
                        "var(--desktop-set-height, min(calc(100% - 3rem), 82rem))",
                    },
                  },
                },
              }),
            customUnderlayProps?.css,
          ]}
          style={{
            "--max-width": width,
            "--background": transparent
              ? "none"
              : backdrop === "light"
                ? "hsl(0 0% 0% / 20%)"
                : undefined,
          }}
        >
          <div
            ref={modalRef}
            data-modal
            {...modalProps}
            {...customModalProps}
            css={[customModalProps?.css]}
            style={{ "--desktop-set-height": height }}
          >
            <Dialog
              ref={dialogRef}
              {...dialogProps}
              css={css({
                height: "100%",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                outline: "none",
              })}
            >
              {children}
            </Dialog>
          </div>
        </div>
      </Overlay>
    );
  },
);

export default ModalDialog;
