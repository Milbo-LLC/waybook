const MONTHS = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."] as const;

export const formatTripDate = (dateInput: string | null | undefined) => {
  if (!dateInput) return "";
  const date = new Date(`${dateInput}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateInput;
  const month = MONTHS[date.getMonth()];
  return `${month} ${date.getDate()}, ${date.getFullYear()}`;
};

export const formatTripDateRange = (
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  timeframeLabel?: string | null,
  earliestStartDate?: string | null,
  latestEndDate?: string | null
) => {
  if (startDate && endDate) {
    return `${formatTripDate(startDate)} - ${formatTripDate(endDate)}`;
  }
  if (timeframeLabel) {
    const windowStart = formatTripDate(earliestStartDate);
    const windowEnd = formatTripDate(latestEndDate);
    if (windowStart && windowEnd) return `${timeframeLabel} (${windowStart} - ${windowEnd})`;
    if (windowStart) return `${timeframeLabel} (from ${windowStart})`;
    if (windowEnd) return `${timeframeLabel} (until ${windowEnd})`;
    return timeframeLabel;
  }
  if (earliestStartDate && latestEndDate) {
    return `${formatTripDate(earliestStartDate)} - ${formatTripDate(latestEndDate)}`;
  }
  if (earliestStartDate) return `From ${formatTripDate(earliestStartDate)}`;
  if (latestEndDate) return `Until ${formatTripDate(latestEndDate)}`;
  return "Dates TBD";
};
