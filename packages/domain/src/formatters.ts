export const formatShortDate = (timestamp: number): string =>
  new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

export const formatDurationSeconds = (durationMs: number): string => {
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  return `${seconds}s`;
};

export const formatDurationClock = (durationMs: number): string => {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};
