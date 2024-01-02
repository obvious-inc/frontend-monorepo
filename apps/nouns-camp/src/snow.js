import React from "react";
import { css } from "@emotion/react";
import "./snow.css";

// All cred to Ethan! https://codepen.io/ethancopping/pen/ExrGYGG
const init = (containerEl) => {
  const particlesPerThousandPixels = 0.02;
  const fallSpeed = 0.15;
  const pauseWhenNotActive = true;
  const maxSnowflakes = 200;
  const snowflakes = [];

  let snowflakeInterval;
  let isTabActive = true;

  function resetSnowflake(snowflake) {
    const size = Math.random() * 4 + 1;
    const viewportWidth = window.innerWidth - size; // Adjust for snowflake size
    const viewportHeight = window.innerHeight;

    snowflake.style.width = `${size}px`;
    snowflake.style.height = `${size}px`;
    snowflake.style.left = `${Math.random() * viewportWidth}px`; // Constrain within viewport width
    snowflake.style.top = `-${size}px`;

    const animationDuration = (Math.random() * 3 + 2) / fallSpeed;
    snowflake.style.animationDuration = `${animationDuration}s`;
    snowflake.style.animationTimingFunction = "linear";
    snowflake.style.animationName =
      Math.random() < 0.5 ? "fall" : "diagonal-fall";

    setTimeout(() => {
      if (parseInt(snowflake.style.top, 10) < viewportHeight) {
        resetSnowflake(snowflake);
      } else {
        snowflake.remove(); // Remove when it goes off the bottom edge
      }
    }, animationDuration * 1000);
  }

  function createSnowflake() {
    if (snowflakes.length < maxSnowflakes) {
      const snowflake = document.createElement("div");
      snowflake.classList.add("snowflake");
      snowflakes.push(snowflake);
      containerEl.appendChild(snowflake);
      resetSnowflake(snowflake);
    }
  }

  function generateSnowflakes() {
    const numberOfParticles =
      Math.ceil((window.innerWidth * window.innerHeight) / 1000) *
      particlesPerThousandPixels;
    const interval = 5000 / numberOfParticles;

    clearInterval(snowflakeInterval);
    snowflakeInterval = setInterval(() => {
      if (isTabActive && snowflakes.length < maxSnowflakes) {
        requestAnimationFrame(createSnowflake);
      }
    }, interval);
  }

  function handleVisibilityChange() {
    if (!pauseWhenNotActive) return;

    isTabActive = !document.hidden;
    if (isTabActive) {
      generateSnowflakes();
    } else {
      clearInterval(snowflakeInterval);
    }
  }

  generateSnowflakes();

  window.addEventListener("resize", () => {
    clearInterval(snowflakeInterval);
    setTimeout(generateSnowflakes, 1000);
  });

  document.addEventListener("visibilitychange", handleVisibilityChange);
};

const SnowOverlay = () => {
  const ref = React.useRef();

  React.useEffect(() => {
    init(ref.current);
  }, []);

  return (
    <div
      css={(t) =>
        css({
          position: "fixed",
          top: 0,
          left: 0,
          overflow: "hidden",
          width: "100vw",
          height: "100vh",
          zIndex: 99999,
          pointerEvents: "none",
          ".snowflake": {
            position: "absolute",
            backgroundColor:
              t.name === "dark" ? "hsl(0 0% 50%)" : "hsl(0 0% 85%)",
            borderRadius: "50%",
            opacity: 0.8,
            pointerEvents: "none",
          },
        })
      }
      ref={ref}
    />
  );
};

export default SnowOverlay;
