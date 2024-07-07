import { useNumberFormatter } from "react-aria";

const FormattedNumber = ({ value, ...options }) => {
  const formatter = useNumberFormatter(options);
  return formatter.format(typeof value === "string" ? new Date(value) : value);
};

export default FormattedNumber;
