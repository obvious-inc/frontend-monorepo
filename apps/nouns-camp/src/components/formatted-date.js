import { useDateFormatter } from "react-aria";

const FormattedNumber = ({ value, ...options }) => {
  const formatter = useDateFormatter(options);
  return formatter.format(
    typeof value === "string" ? parseFloat(value) : value,
  );
};

export default FormattedNumber;
