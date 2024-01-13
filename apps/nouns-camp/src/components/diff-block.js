import { css } from "@emotion/react";

const DiffBlock = ({ diff, ...props }) => (
  <div
    css={(t) =>
      css({
        whiteSpace: "pre-wrap",
        fontFamily: t.fontStacks.monospace,
        lineHeight: 1.65,
        userSelect: "text",
        "[data-line]": {
          borderLeft: "0.3rem solid transparent",
          padding: "0 1.2rem",
          "@media (min-width: 600px)": {
            padding: "0 1.7rem",
          },
        },
        "[data-added]": {
          background: "hsl(122deg 35% 50% / 15%)",
          borderColor: "hsl(122deg 35% 50% / 50%)",
        },
        "[data-removed]": {
          background: "hsl(3deg 75% 60% / 13%)",
          borderColor: "hsl(3deg 75% 60% / 50%)",
        },
      })
    }
    {...props}
  >
    {diff.map((line, i) => (
      <div
        key={i}
        data-line
        data-added={line.added || undefined}
        data-removed={line.removed || undefined}
      >
        {line.value}
      </div>
    ))}
  </div>
);

export default DiffBlock;
