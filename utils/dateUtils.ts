const IST_OFFSET = "+05:30";

export function toISTRangeUTC(startDate: string, endDate: string) {
  return {
    startUTC: new Date(`${startDate}T00:00:00${IST_OFFSET}`).toISOString(),
    endUTC:   new Date(`${endDate}T23:59:59.999${IST_OFFSET}`).toISOString(),
  };
}

export function toISTDateStr(d: Date): string {
  return new Date(d.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
