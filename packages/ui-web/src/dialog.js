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

    const [visualViewportInset, setVisualViewportInset] = React.useState(null);

    React.useEffect(() => {
      if (!isOpen) return;

      const update = () => {
        setVisualViewportInset(
          window.innerHeight - window.visualViewport.height,
        );
      };

      let req;
      const scheduleUpdate = () => {
        if (req != null) window.cancelAnimationFrame(req);
        req = window.requestAnimationFrame(update);
      };

      const resizeHandler = () => {
        if (req == null) {
          update();
        }
        scheduleUpdate();
      };

      window.visualViewport.addEventListener("resize", resizeHandler);

      update();

      return () => {
        window.visualViewport.removeEventListener("resize", resizeHandler);
      };
    }, [isOpen, tray]);

    if (!isOpen) return null;

    return (
      <Overlay>
        <div
          data-tray={tray || undefined}
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
                overflow: "auto",
                background: "var(--background, hsl(0 0% 0% / 40%))",
                scrollSnapType: "y mandatory",
                ".edge-scroll-padding": { paddingTop: "100vh" },
                "[data-modal]": {
                  width: "100%",
                  color: t.colors.textNormal,
                  background: t.colors.dialogBackground,
                  borderTopLeftRadius: "0.6rem",
                  borderTopRightRadius: "0.6rem",
                  display: "flex",
                  flexDirection: "column",
                  // boxShadow: t.shadows.elevationHigh,
                  outline: "none",
                  overflow: "hidden",
                  minHeight: "min-content",
                  scrollSnapAlign: "end",
                },
                "@media (min-width: 600px)": {
                  padding: "0 1.6rem",
                  scrollSnapType: "none",
                  // display: "flex",
                  // flexDirection: "column",
                  "[data-modal]": {
                    maxWidth: "var(--max-width)",
                    // margin: "0 auto",
                    margin: "auto",
                  },
                  ".scroll-tray-only": { display: "none" },
                  "&[data-tray]": {
                    "[data-modal]": {
                      minHeight: `var(--desktop-set-height, calc(100vh - ${t.navBarHeight}))`,
                    },
                  },
                  // Default to centered dialogs on larger screens
                  "&:not([data-tray])": {
                    padding: "2.8rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    "[data-modal]": {
                      borderRadius: "0.6rem",
                      height: "var(--desktop-set-height, auto)",
                      maxHeight:
                        "var(--desktop-set-height, min(calc(100% - 3rem), 82rem))",
                    },
                    ".tray-only": { display: "none" },
                  },
                },
              }),
            customUnderlayProps?.css,
          ]}
          style={{
            // "--viewport-height":
            //   viewportHeight == null ? undefined : `${viewportHeight}px`,
            "--max-width": width,
            "--background": transparent
              ? "none"
              : backdrop === "light"
                ? "hsl(0 0% 0% / 20%)"
                : undefined,
          }}
        >
          <div
            className="scroll-tray-only edge-scroll-padding"
            style={{ paddingTop: "100vh" }}
          />
          <div
            className="tray-only"
            css={(t) =>
              css({
                minHeight: t.navBarHeight,
                scrollSnapAlign: "start",
                "@media (min-width: 600px)": {
                  flex: 1,
                },
              })
            }
          />
          <div
            className="scroll-tray-only"
            css={(t) => css({ boxShadow: t.shadows.elevationHigh })}
          />
          <div
            ref={modalRef}
            data-modal
            {...modalProps}
            {...customModalProps}
            css={[customModalProps?.css]}
            style={{
              "--desktop-set-height": height,
              transition: "0.1s transform ease-out",
            }}
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
          <div
            className="scroll-tray-only"
            css={(t) =>
              css({
                background: t.colors.dialogBackground,
                scrollSnapAlign: "end",
              })
            }
            style={{
              paddingTop:
                visualViewportInset == null
                  ? undefined
                  : `${visualViewportInset}px`,
            }}
          />
          <div
            className="scroll-tray-only edge-scroll-padding"
            css={(t) => css({ background: t.colors.dialogBackground })}
          />
        </div>
      </Overlay>
    );
  },
);

export default ModalDialog;
