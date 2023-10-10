export const differenceUnits = (date1, date2) => {
  const millis = date1.getTime() - date2.getTime();
  const seconds = Math.floor(millis / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  return { millis, seconds, minutes, hours, days };
};
