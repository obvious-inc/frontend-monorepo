const FormattedDate = ({ value, locale, ...options }) => {
  const dateFormatter = new Intl.DateTimeFormat(locale, options);
  return dateFormatter.format(value);
};

export default FormattedDate;
