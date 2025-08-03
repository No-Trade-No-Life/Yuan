/**
 * Converts an RFC3339 duration string to offset in milliseconds
 * @param duration - RFC3339 duration string (e.g., "PT1M", "PT5M", "P1D")
 * @returns Offset in seconds, or NaN if the format is invalid
 *
 * @public
 */
export const convertDurationToOffset = (duration: string) => {
  const match = duration.match(
    /^P(?:((?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?)(?:T((?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?))?|((\d+)W))$/,
  );
  const [durDate, year, month, day, durTime, hour, minute, second, durWeek, week] = match?.slice(1) ?? [];
  if (durDate || durTime || durWeek) {
    return (
      (+year || 0) * 365 * 24 * 60 * 60 * 1000 +
      (+month || 0) * 30 * 24 * 60 * 60 * 1000 +
      (+day || 0) * 24 * 60 * 60 * 1000 +
      (+hour || 0) * 60 * 60 * 1000 +
      (+minute || 0) * 60 * 1000 +
      (+second || 0) * 1000 +
      (+week || 0) * 7 * 24 * 60 * 60 * 1000
    );
  }
  return NaN;
};
