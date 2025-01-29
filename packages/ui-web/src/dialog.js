import React from "react";
import { css, keyframes } from "@emotion/react";
import { Overlay, useDialog, useModalOverlay } from "react-aria";
import { useMatchMedia } from "@shades/common/react";

const trayEnterAnimation = keyframes({
  "0%": { opacity: 0, transform: "translateY(min(100%, 50vh))" },
  "100%": { opacity: 1, transform: "translateY(0)" },
});
const trayLeaveAnimation = keyframes({
  "0%": { opacity: 1, transform: "translateY(0)" },
  "100%": { opacity: 0, transform: "translateY(min(100%, 50vh))" },
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
      trayViewportCoveredBehavior = "ignore",
      backdrop = "normal",
      modalProps: customModalProps,
      underlayProps: customUnderlayProps,
      children,
      ...dialogProps
    },
    externalDialogRef,
  ) => {
    const underlayRef = React.useRef(null);
    const modalRef = React.useRef(null);
    const internalDialogRef = React.useRef(null);
    const navBarFillerRef = React.useRef(null);

    const closeRef = React.useRef(onRequestClose);

    React.useEffect(() => {
      closeRef.current = onRequestClose;
    });

    const dialogRef = externalDialogRef ?? internalDialogRef;

    const isSmallDevice = useMatchMedia("(max-width: 600px)");

    const { modalProps, underlayProps } = useModalOverlay(
      { isDismissable: true },
      { isOpen, close: onRequestClose },
      modalRef,
    );

    const [isClosing, setClosing] = React.useState(false);
    const [
      { visualViewportHeight, visualViewportInset, dialogHeight, navBarHeight },
      setViewportData,
    ] = React.useState({});

    const isViewportCovered =
      typeof window !== "undefined" &&
      visualViewportInset > window.innerHeight / 4;

    const fitsInViewport =
      visualViewportHeight == null ||
      visualViewportHeight > dialogHeight + navBarHeight;

    const variant = (() => {
      if (isSmallDevice) return "snap-tray";
      return tray ? "tray" : "regular";
    })();

    // Sync visual viewport and dialog size state
    React.useEffect(() => {
      if (!isOpen) return;

      let cancelled = false;

      const update = () => {
        if (cancelled) return;
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
      window.visualViewport.addEventListener("resize", resizeHandler);

      const observer = new ResizeObserver(() => {
        update();
      });

      observer.observe(dialogRef.current);

      update();

      return () => {
        cancelled = true;
        window.visualViewport.removeEventListener("resize", resizeHandler);
        observer.disconnect();
      };
    }, [isOpen, dialogRef]);

    // Tray initial scroll position
    React.useEffect(() => {
      if (!isOpen) return;

      if (["tray", "snap-tray"].includes(variant)) {
        navBarFillerRef.current.scrollIntoView({
          behavior: "instant",
          block: "start",
        });
      }
    }, [variant, isOpen]);

    // Snap to bottom when viewport is covered (by soft keyboard)
    React.useEffect(() => {
      if (!isOpen) return;
      if (!["tray", "snap-tray"].includes(variant)) return;

      if (
        isViewportCovered &&
        trayViewportCoveredBehavior === "snap-to-bottom"
      ) {
        modalRef.current.scrollIntoView({
          behavior: "instant",
          block: "bottom",
        });
      }
    }, [variant, isOpen, isViewportCovered, trayViewportCoveredBehavior]);

    // Snap tray "swipe-down-to-close"
    React.useEffect(() => {
      if (!isOpen) return;
      if (variant !== "snap-tray") return;

      const requestClose = () => {
        let didClose = false;
        const close = () => {
          if (didClose) return;
          closeRef.current();
          didClose = true;
          setClosing(false);
        };
        el.dataset.closing = "true";
        el.addEventListener("animationend", close);
        // Fallback
        setTimeout(close, 500);
        setClosing(true);
      };

      const { current: el } = underlayRef;

      let isTouching = false;

      const handleScroll = (() => {
        let swipeData = null;
        let scrollEndTimeoutHandle;

        return () => {
          if (isTouching) return;

          if (scrollEndTimeoutHandle != null)
            clearTimeout(scrollEndTimeoutHandle);

          // End swipe after 250ms
          scrollEndTimeoutHandle = setTimeout(() => {
            swipeData = null;
          }, 250);

          const { scrollTop } = el;

          // Swipe start
          if (swipeData == null) {
            swipeData = {
              lastScrollTop: scrollTop,
              lastScrollTopTimestamp: Date.now(),
            };
            return;
          }

          if (swipeData.direction === "up") {
            // Ignore up swipes
            return;
          }

          const scrollTopDelta = scrollTop - swipeData.lastScrollTop;
          const timeDelta = Date.now() - swipeData.lastScrollTopTimestamp;

          const direction = scrollTopDelta > 0 ? "up" : "down";
          const velocity = Math.abs(scrollTopDelta / timeDelta);

          swipeData.lastScrollTopTimestamp = Date.now();
          swipeData.lastScrollTop = scrollTop;
          if (swipeData.direction == null) swipeData.direction = direction;

          const modalRect = modalRef.current.getBoundingClientRect();

          const isPastCloseThreshold =
            modalRect.top >= window.visualViewport.height * 0.9;
          const isPastMidStop =
            modalRect.top >= window.visualViewport.height / 2;

          if (isPastCloseThreshold || (isPastMidStop && velocity > 0.2)) {
            requestClose();
          }
        };
      })();

      const eventHandlers = [
        ["scroll", handleScroll],
        ["touchstart", () => (isTouching = true)],
        ["touchend", () => (isTouching = false)],
        ["touchmove", () => (isTouching = true)],
      ];

      for (const [name, handler] of eventHandlers)
        el.addEventListener(name, handler, { passive: true });

      return () => {
        for (const [name, handler] of eventHandlers)
          el.removeEventListener(name, handler);
      };
    }, [variant, isOpen, modalRef]);

    if (!isOpen) return null;

    return (
      <Overlay>
        <div
          ref={underlayRef}
          data-variant={variant}
          data-fits-in-viewport={fitsInViewport}
          data-viewport-covered={isViewportCovered}
          data-tray-viewport-covered-behavior={trayViewportCoveredBehavior}
          data-closing={isClosing || undefined}
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
                transition: "0.1s background ease-out",
                background: "var(--background, hsl(0 0% 0% / 40%))", // Backdrop color

                // Modal defaults
                ".modal": {
                  width: "100%",
                  color: t.colors.textNormal,
                  background: t.colors.dialogBackground,
                  outline: "none",
                  margin: "auto", // Center
                },

                // Dialog defaults
                ".dialog": {
                  height: "100%",
                  minHeight: 0,
                  display: "flex",
                  flexDirection: "column",
                  outline: "none",
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
                  scrollbarWidth: "none", // Firefox
                  "&::-webkit-scrollbar": { display: "none" }, // Safari & Chrome
                  ".modal": {
                    borderTopLeftRadius: "0.6rem",
                    borderTopRightRadius: "0.6rem",
                    display: "flex",
                    flexDirection: "column",
                    outline: "none",
                    overflow: "hidden",
                    // minHeight: "min-content",
                    minHeight: `calc(100dvh - ${t.navBarHeight})`,
                    animation: `${trayEnterAnimation} 0.325s ease-out forwards`,
                  },
                  '&[data-fits-in-viewport="false"]': {
                    scrollSnapType: "y proximity",
                    ".modal": { scrollSnapAlign: "end" },
                  },
                  '&[data-closing="true"]': {
                    pointerEvents: "none",
                    background: "hsl(0 0% 0% / 0%)",
                    ".snap-tray-shadow": { display: "none" },
                    ".modal": {
                      animation: `${trayLeaveAnimation} 0.325s ease-out forwards`,
                    },
                  },
                  '&[data-viewport-covered="true"][data-viewport-covered-behavior="snap-to-bottom"]':
                    {
                      ".modal": { scrollSnapAlign: "end" },
                    },
                  "@media (min-width: 600px)": {
                    padding: "0 1.6rem",
                    ".modal": {
                      width: "var(--specified-dialog-width, 62rem)",
                      maxWidth: "100%",
                      animation: `${trayEnterAnimationDesktop} 0.2s ease-out forwards`,
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
                    minHeight: "min-content",
                    animation: `${trayEnterAnimation} 0.325s ease-out forwards`,
                  },
                  ".dialog": {
                    // Safari won’t let the modal height expand beyond its
                    // container if we put overflow "hidden" on it, but we can
                    // put it on the dialog. I was unable to find any references
                    // to this on the interwebs unfortunately.
                    borderTopLeftRadius: "0.6rem",
                    borderTopRightRadius: "0.6rem",
                    overflow: "hidden",
                  },
                  "@media (min-width: 600px)": {
                    padding: "0 1.6rem",
                    ".modal": {
                      width: "var(--specified-dialog-width, 62rem)",
                      maxWidth: "100%",
                      // Desktop trays always expand all the way to the top.
                      // You can make it match the content and stick to bottom
                      // with a height override, e.g. <Dialog height="auto" />
                      minHeight: `var(--specified-dialog-height, calc(100dvh - ${t.navBarHeight}))`,
                      animation: `${trayEnterAnimationDesktop} 0.2s ease-out forwards`,
                    },
                  },
                },

                // Regular centered dialog
                '&[data-variant="regular"]': {
                  padding: "1.6rem 2.8rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ".modal": {
                    borderRadius: "0.6rem",
                    width: "var(--specified-dialog-width, 62rem)",
                    maxWidth: "100%",
                    height: "var(--specified-dialog-height, auto)",
                    animation: `${centeredEnterAnimationDesktop} 0.2s ease-out forwards`,
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
          <div
            className="snap-tray-only"
            style={{ paddingTop: "50dvh", scrollSnapAlign: "start" }}
          />
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
            className="snap-tray-only snap-tray-shadow"
            css={(t) => css({ boxShadow: t.shadows.elevationHigh })}
          />
          <div
            ref={modalRef}
            className="modal"
            {...modalProps}
            {...customModalProps}
            css={[customModalProps?.css]}
          >
            {/* <div
              className="snap-tray-only"
              css={(t) =>
                css({
                  position: "relative",
                  ".handle": {
                    position: "absolute",
                    top: "0.4rem",
                    left: "50%",
                    transform: "translateX(-50%)",
                    height: "0.4rem",
                    width: "3.2rem",
                    borderRadius: "0.2rem",
                    background: t.light
                      ? t.colors.backgroundTertiary
                      : t.colors.borderLighter,
                    boxShadow: t.shadows.elevationLow,
                  },
                })
              }
            >
              <div className="handle" />
            </div> */}
            <Dialog
              ref={dialogRef}
              {...dialogProps}
              variant={variant}
              className="dialog"
            >
              {(props) =>
                typeof children === "function"
                  ? children({ ...props, variant })
                  : children
              }
            </Dialog>
            {trayViewportCoveredBehavior === "snap-to-bottom" && (
              <div
                className="snap-tray-only"
                style={{
                  // This pads the dialog to make sure soft keyboards don’t hide
                  // inputs that are placed at the bottom of the dialog container
                  paddingTop:
                    visualViewportInset == null
                      ? undefined
                      : `${visualViewportInset}px`,
                }}
              />
            )}
          </div>
          {fitsInViewport && (
            <div
              className="snap-tray-only"
              css={(t) =>
                css({
                  background: t.colors.dialogBackground,
                  paddingTop: "50dvh",
                })
              }
            />
          )}
        </div>
      </Overlay>
    );
  },
);

export default ModalDialog;
