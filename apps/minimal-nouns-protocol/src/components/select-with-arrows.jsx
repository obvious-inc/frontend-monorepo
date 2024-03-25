const SelectWithArrows = ({
  value,
  options,
  onChange,
  reverseNavDirection,
  containerProps,
  ...props
}) => {
  const selectNext = () => {
    const index = options.findIndex((o) => o.value === value);
    let targetIndex = index + 1;
    while (options[targetIndex] == null || options[targetIndex].disabled) {
      if (options[targetIndex] == null) {
        targetIndex = 0;
      } else {
        targetIndex++;
      }
    }
    onChange(options[targetIndex].value);
  };

  const selectPrev = () => {
    const index = options.findIndex((o) => o.value === value);
    let targetIndex = index - 1;
    while (options[targetIndex] == null || options[targetIndex].disabled) {
      if (options[targetIndex] == null) {
        targetIndex = options.length - 1;
      } else {
        targetIndex--;
      }
    }
    onChange(options[targetIndex].value);
  };

  return (
    <div
      {...containerProps}
      style={{ display: "flex", gap: "0.8rem", ...containerProps.style }}
    >
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        {...props}
        style={{ flex: 1, minWidth: 0, ...props.style }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        data-icon
        type="button"
        onClick={() => {
          if (reverseNavDirection) selectNext();
          else selectPrev();
        }}
      >
        &larr;
      </button>
      <button
        data-icon
        type="button"
        onClick={() => {
          if (reverseNavDirection) selectPrev();
          else selectNext();
        }}
      >
        &rarr;
      </button>
    </div>
  );
};

export default SelectWithArrows;
