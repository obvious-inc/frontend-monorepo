import React from "react";

const NativeSelect = ({
  value,
  options,
  groupedOptions,
  renderSelectedOption,
  onChange,
  style,
  ...props
}) => {
  const selectedOption = groupedOptions
    ? groupedOptions
        .flatMap((group) => group.options)
        .find((o) => String(o.value) === String(value))
    : options?.find((o) => String(o.value) === String(value));

  return (
    <span
      style={{
        position: "relative",
        display: "inline-block",
        ...style,
      }}
      {...props}
    >
      {renderSelectedOption?.(selectedOption) ?? selectedOption?.label ?? value}
      <select
        value={value}
        onChange={onChange}
        style={{ position: "absolute", inset: 0, opacity: 0 }}
      >
        {groupedOptions
          ? groupedOptions.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))
          : options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
      </select>
    </span>
  );
};

export default NativeSelect;
