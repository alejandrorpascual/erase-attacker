export function getTime(ms: number) {
  let totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return { seconds, minutes, hours };
}

export function getTimeCalculation({
  hours,
  minutes,
  seconds,
}: ReturnType<typeof getTime>) {
  let timeCalculation = "";
  if (hours > 1) {
    timeCalculation = `⏳ ETA: ${hours} hours ${minutes} min ${seconds} sec`;
  } else if (minutes > 0) {
    timeCalculation = `⏳ ETA: ${minutes} min ${seconds} sec`;
  } else {
    timeCalculation = `⏳ ETA: ${seconds.toFixed(0)} seconds`;
  }
  return timeCalculation;
}
