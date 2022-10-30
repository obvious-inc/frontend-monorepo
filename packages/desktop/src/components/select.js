import { css } from "@emotion/react";

const Select = ({ value, onChange, options = [], ...props }) => (
  <select
    value={value}
    onChange={onChange}
    css={(t) =>
      css({
        display: "flex",
        alignItems: "center",
        appearance: "none",
        color: t.colors.textNormal,
        border: "1px solid rgba(255, 255, 255, 0.13)",
        background: "transparent",
        fontSize: "1.5rem",
        lineHeight: 1.2,
        fontWeight: "400",
        borderRadius: "0.3rem",
        padding: "0.7rem 0.9rem",
        height: "3.6rem",
        width: "100%",
        outline: "none",
        "&:disabled": {
          color: t.colors.textMuted,
        },
        "&:not(:disabled)": {
          cursor: "pointer",
        },
        "&:not(:disabled):hover": {
          background: "rgb(47 47 47)",
        },
        "&:focus": {
          boxShadow: `0 0 0 0.2rem ${t.colors.primary}`,
        },
      })
    }
    {...props}
  >
    {options.map(({ value, label }) => (
      <option key={value} value={value} label={label} />
    ))}
  </select>
);

export default Select;
