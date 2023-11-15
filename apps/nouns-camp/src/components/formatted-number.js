import { useNumberFormatter } from "react-aria";

const FormattedDate = ({ value, ...options }) => {
  const formatter = useNumberFormatter(options);
  return formatter.format(typeof value === "string" ? new Date(value) : value);
};

export default FormattedDate;
