export const formatDuration = (duration: number) => {
  duration /= 1000;
  // (Days:)hh:mm:ss
  const days = Math.floor(duration / 86400);
  const hours = Math.floor((duration % 86400) / 3600)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((duration % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(duration % 60)
    .toString()
    .padStart(2, '0');
  return `${days > 0 ? `${days}:` : ''}${hours}:${minutes}:${seconds}`;
};
