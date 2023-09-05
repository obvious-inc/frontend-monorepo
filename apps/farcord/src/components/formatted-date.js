import { useDateFormatter } from "react-aria";

const FormattedDate = ({ value, ...options }) => {
  const formatter = useDateFormatter(options);
  return formatter.format(typeof value === "string" ? new Date(value) : value);
};

export default FormattedDate;
