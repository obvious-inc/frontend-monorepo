export const differenceUnits = (date1, date2, { floor = true } = {}) => {
  const millis = date1.getTime() - date2.getTime();
  const seconds = floor ? Math.floor(millis / 1000) : millis / 1000;
  const minutes = floor ? Math.floor(seconds / 60) : seconds / 60;
  const hours = floor ? Math.floor(minutes / 60) : minutes / 60;
  const days = floor ? Math.floor(hours / 24) : hours / 24;
  const weeks = floor ? Math.floor(days / 7) : days / 7;
  return { millis, seconds, minutes, hours, days, weeks };
};
