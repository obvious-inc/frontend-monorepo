const MultiSelect = ({ options, selectedValues, onSelect, ...props }) => (
  <select
    {...props}
    value={selectedValues}
    multiple
    onChange={(e) => {
      onSelect(
        [...e.target.options].filter((o) => o.selected).map((o) => o.value),
      );
    }}
  >
    {options.map((o) => (
      <option key={o.value} value={o.value}>
        {o.label}
      </option>
    ))}
  </select>
);

export default MultiSelect;
