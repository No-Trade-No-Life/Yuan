export const mapDurationToPeriodInSec = (duration: string) => {
  const match = duration.match(
    /^P(?:((?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?)(?:T((?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?))?|((\d+)W))$/,
  );
  const [durDate, year, month, day, durTime, hour, minute, second, durWeek, week] = match?.slice(1) ?? [];
  if (durDate || durTime || durWeek) {
    return (
      (+year || 0) * 365 * 24 * 60 * 60 +
      (+month || 0) * 30 * 24 * 60 * 60 +
      (+day || 0) * 24 * 60 * 60 +
      (+hour || 0) * 60 * 60 +
      (+minute || 0) * 60 +
      (+second || 0) +
      (+week || 0) * 7 * 24 * 60 * 60
    );
  }
  return NaN;
};
