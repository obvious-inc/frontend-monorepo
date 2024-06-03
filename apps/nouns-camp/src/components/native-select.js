const NativeSelect = ({
  value,
  options,
  renderSelectedOption,
  onChange,
  style,
  ...props
}) => {
  const selectedOption = options.find((o) => String(o.value) === String(value));
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
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
};

export default NativeSelect;
