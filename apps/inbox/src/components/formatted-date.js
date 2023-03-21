import { useDateFormatter } from "react-aria";

const FormattedDate = ({ value, ...options }) => {
  const formatter = useDateFormatter(options);
  return formatter.format(value);
};

export default FormattedDate;
