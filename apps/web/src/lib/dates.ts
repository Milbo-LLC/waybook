const MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."] as const;

export const formatTripDate = (dateInput: string) => {
  const date = new Date(`${dateInput}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateInput;
  const month = MONTHS[date.getMonth()];
  return `${month} ${date.getDate()}, ${date.getFullYear()}`;
};

export const formatTripDateRange = (startDate: string, endDate: string) => {
  return `${formatTripDate(startDate)} - ${formatTripDate(endDate)}`;
};
