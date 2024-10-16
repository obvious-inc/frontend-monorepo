import React from "react";
import { css, keyframes } from "@emotion/react";
import { Overlay, useDialog, useModalOverlay } from "react-aria";
import { useMatchMedia } from "@shades/common/react";

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
      width,
      height,
      transparent,
      tray = false,
      trayMode,
      backdrop = "normal",
      modalProps: customModalProps,
      underlayProps: customUnderlayProps,
      children,
      ...dialogProps
    },
    externalDialogRef,
  ) => {
    const modalRef = React.useRef(null);
    const internalDialogRef = React.useRef(null);
    const navBarFillerRef = React.useRef(null);

    const dialogRef = externalDialogRef ?? internalDialogRef;

    const isSmallDevice = useMatchMedia("(max-width: 600px)");

    const { modalProps, underlayProps } = useModalOverlay(
      { isDismissable: true },
      { isOpen, close: onRequestClose },
      modalRef,
    );

    const [
      { visualViewportHeight, visualViewportInset, dialogHeight, navBarHeight },
      setViewportData,
    ] = React.useState({});

    // Sync visual viewport inset
    React.useEffect(() => {
      if (!isOpen) return;

      const update = () => {
        setViewportData({
          visualViewportHeight: window.visualViewport.height,
          visualViewportInset:
            window.innerHeight - window.visualViewport.height,
          dialogHeight: dialogRef.current.offsetHeight,
          navBarHeight: navBarFillerRef.current.offsetHeight,
        });
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

      const observer = new ResizeObserver(() => {
        scheduleUpdate();
      });

      observer.observe(dialogRef.current);

      update();

      return () => {
        window.visualViewport.removeEventListener("resize", resizeHandler);
        observer.disconnect();
      };
    }, [isOpen, dialogRef]);

    const fitsInViewport =
      visualViewportHeight == null ||
      visualViewportHeight > dialogHeight + navBarHeight;

    const variant = (() => {
      if (!isSmallDevice) {
        if (!tray) return "regular";
        return trayMode === "snap" ? "snap-tray" : "tray";
      }

      // Always use snap behavior if the content fits inside the viewport
      if (fitsInViewport || trayMode === "snap") return "snap-tray";

      return "tray";
    })();

    React.useEffect(() => {
      if (!isOpen) return;

      if (["tray", "snap-tray"].includes(variant)) {
        navBarFillerRef.current.scrollIntoView({
          behavior: "instant",
          block: "start",
        });
      }
    }, [variant, isOpen]);

    if (!isOpen) return null;

    return (
      <Overlay>
        <div
          data-variant={variant}
          data-fits-in-viewport={fitsInViewport}
          {...underlayProps}
          {...customUnderlayProps}
          css={[
            (t) =>
              css({
                // Since Emotion’s <Global /> doesn’t work yet in Next we have
                // to specify this on anything that’s outside the root div
                colorScheme: t.name === "dark" ? "dark" : "light",

                // Container defaults
                position: "fixed",
                zIndex: 10,
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                overflow: "auto",
                background: "var(--background, hsl(0 0% 0% / 40%))", // Backdrop color

                // Modal defaults
                ".modal": {
                  width: "100%",
                  color: t.colors.textNormal,
                  background: t.colors.dialogBackground,
                  outline: "none",
                  margin: "auto", // Center
                },

                // Shared reset
                '&:not([data-variant="snap-tray"])': {
                  ".snap-tray-only": { display: "none" },
                  '&:not([data-variant="tray"])': {
                    ".tray-only": { display: "none" },
                  },
                },

                // == Variant specifics == //

                // Snap tray
                '&[data-variant="snap-tray"]': {
                  scrollSnapType: "y mandatory",
                  ".modal": {
                    borderTopLeftRadius: "0.6rem",
                    borderTopRightRadius: "0.6rem",
                    display: "flex",
                    flexDirection: "column",
                    outline: "none",
                    overflow: "hidden",
                    minHeight: "min-content",
                    animation: `${trayEnterAnimation} 0.325s ease-out backwards`,
                  },
                  '&[data-fits-in-viewport="false"]': {
                    ".modal": { scrollSnapAlign: "end" },
                  },
                  "@media (min-width: 600px)": {
                    padding: "0 1.6rem",
                    ".modal": {
                      width: "var(--specified-dialog-width, 62rem)",
                      maxWidth: "100%",
                      animation: `${trayEnterAnimationDesktop} 0.2s ease-out backwards`,
                    },
                  },
                },

                // Regular tray
                '&[data-variant="tray"]': {
                  display: "flex",
                  flexDirection: "column",
                  ".modal": {
                    borderTopLeftRadius: "0.6rem",
                    borderTopRightRadius: "0.6rem",
                    display: "flex",
                    flexDirection: "column",
                    outline: "none",
                    overflow: "hidden",
                    minHeight: "min-content",
                    animation: `${trayEnterAnimation} 0.325s ease-out backwards`,
                  },
                  "@media (min-width: 600px)": {
                    padding: "0 1.6rem",
                    ".modal": {
                      width: "var(--specified-dialog-width, 62rem)",
                      maxWidth: "100%",
                      // Desktop trays always expand all the way to the top
                      minHeight: `var(--specified-dialog-height, calc(100dvh - ${t.navBarHeight}))`,
                      animation: `${trayEnterAnimationDesktop} 0.2s ease-out backwards`,
                    },
                  },
                },

                // Regular centered dialog
                '&[data-variant="regular"]': {
                  padding: "2.8rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ".modal": {
                    borderRadius: "0.6rem",
                    width: "var(--specified-dialog-width, 62rem)",
                    maxWidth: "100%",
                    height: "var(--specified-dialog-height, auto)",
                    animation: `${centeredEnterAnimationDesktop} 0.2s ease-out backwards`,
                  },
                },
              }),
            customUnderlayProps?.css,
          ]}
          style={{
            "--specified-dialog-width": width,
            "--specified-dialog-height": height,
            "--background": transparent
              ? "none"
              : backdrop === "light"
                ? "hsl(0 0% 0% / 20%)"
                : undefined,
          }}
        >
          <div className="snap-tray-only" style={{ paddingTop: "50dvh" }} />
          <div
            className="snap-tray-only"
            css={(t) =>
              css({
                paddingTop: `calc(50dvh - ${t.navBarHeight})`,
                scrollSnapAlign: "start",
              })
            }
          />
          <div
            ref={navBarFillerRef}
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
            className="snap-tray-only"
            css={(t) => css({ boxShadow: t.shadows.elevationHigh })}
          />
          <div
            ref={modalRef}
            className="modal"
            {...modalProps}
            {...customModalProps}
            css={[customModalProps?.css]}
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
            <div
              className="snap-tray-only"
              style={{
                paddingTop:
                  visualViewportHeight == null
                    ? undefined
                    : `${visualViewportHeight - dialogHeight - navBarHeight}px`,
              }}
            />
            <div
              className="snap-tray-only"
              style={{
                paddingTop:
                  visualViewportInset == null
                    ? undefined
                    : `${visualViewportInset}px`,
              }}
            />
          </div>
          <div
            className="snap-tray-only tray-bottom-edge-filler"
            css={(t) =>
              css({
                background: t.colors.dialogBackground,
                paddingTop: "50dvh",
              })
            }
          />
        </div>
      </Overlay>
    );
  },
);

export default ModalDialog;
