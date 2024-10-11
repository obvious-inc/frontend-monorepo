import React from "react";
import { css, keyframes } from "@emotion/react";
import { Overlay, useDialog, useModalOverlay } from "react-aria";

const trayEnterAnimation = keyframes({
  "0%": { opacity: 0, transform: "translateY(min(100%, 50vh))" },
  "100%": { opacity: 1, transform: "translateY(0)" },
});
const trayEnterAnimationDesktop = keyframes({
  "0%": { opacity: 0, transform: "translateY(2vh)" },
  "100%": { opacity: 1, transform: "translateY(0)" },
});

const centeredEnterAnimationDesktop = keyframes({
  "0%": { opacity: 0, transform: "translateY(-1vh)" },
  "100%": { opacity: 1, transform: "translateY(0)" },
});

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

    // Sync visual viewport inset
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

    // TODO
    // React.useEffect(() => {
    //   if (!isOpen) return;

    //   if (matchMedia("(max-width: 600px)").matches) {
    //     modalRef.current.scrollIntoView({
    //       behavior: "instant",
    //       block: "start",
    //     });
    //   }
    // }, [isOpen]);

    if (!isOpen) return null;

    return (
      <Overlay>
        <div
          data-variant={tray ? "tray" : undefined}
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
                ".modal": {
                  width: "100%",
                  color: t.colors.textNormal,
                  background: t.colors.dialogBackground,
                  borderTopLeftRadius: "0.6rem",
                  borderTopRightRadius: "0.6rem",
                  display: "flex",
                  flexDirection: "column",
                  outline: "none",
                  overflow: "hidden",
                  minHeight: "min-content",
                  scrollSnapAlign: "end",
                  // Fade in from bottom
                  animation: `${trayEnterAnimation} 0.325s ease-out backwards`,
                },
                // "Desktop mode"
                "@media (min-width: 600px)": {
                  padding: "0 1.6rem",
                  ".modal": {
                    maxWidth: "var(--max-width)",
                    margin: "auto", // center in all directions
                  },
                  // No scroll snap behavior on desktop
                  scrollSnapType: "none",
                  ".scroll-tray-only": { display: "none" },
                  // Default to centered dialogs on desktop if not explicitly set to tray
                  '&:not([data-variant="tray"])': {
                    padding: "2.8rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    ".modal": {
                      borderRadius: "0.6rem",
                      height: "var(--desktop-set-height, auto)",
                      maxHeight:
                        "var(--desktop-set-height, min(calc(100% - 3rem), 82rem))",
                      animation: `${centeredEnterAnimationDesktop} 0.2s ease-out backwards`,
                    },
                    ".tray-only": { display: "none" },
                  },
                  '&[data-variant="tray"]': {
                    display: "flex",
                    flexDirection: "column",
                    ".modal": {
                      // Desktop trays are always "fullscreen"
                      minHeight: `var(--desktop-set-height, calc(100vh - ${t.navBarHeight}))`,
                      animation: `${trayEnterAnimationDesktop} 0.2s ease-out backwards`,
                    },
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
            className="modal"
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
