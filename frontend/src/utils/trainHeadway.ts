export interface TrainHeadwayEstimate {
  nextMinutes: number;
  subsequentMinutes: number;
  band: "Peak hours" | "Off-peak" | "Late night";
  nextAt: Date;
  subsequentAt: Date;
  nextLabel: string;
  subsequentLabel: string;
}

function singaporeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function formatSingaporeClock(date: Date): string {
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function estimateTrainHeadway(
  now: Date = new Date(),
  seed = "",
): TrainHeadwayEstimate {
  const { weekday, hour, minute } = singaporeParts(now);
  const minutesOfDay = hour * 60 + minute;
  const isWeekday = !["Sat", "Sun"].includes(weekday);
  const isPeak =
    isWeekday &&
    ((minutesOfDay >= 7 * 60 && minutesOfDay < 9 * 60 + 30) ||
      (minutesOfDay >= 17 * 60 && minutesOfDay < 20 * 60));
  const isLateNight = minutesOfDay >= 22 * 60 + 30 || minutesOfDay < 5 * 60 + 30;

  let nextMinutes = 5;
  let subsequentMinutes = 7;
  let band: TrainHeadwayEstimate["band"] = "Off-peak";

  if (isPeak) {
    nextMinutes = 2;
    subsequentMinutes = 3;
    band = "Peak hours";
  } else if (isLateNight) {
    nextMinutes = 7;
    subsequentMinutes = 10;
    band = "Late night";
  }

  const offset = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 2;
  nextMinutes += offset;
  subsequentMinutes += offset;

  const nextAt = addMinutes(now, nextMinutes);
  const subsequentAt = addMinutes(now, subsequentMinutes);

  return {
    nextMinutes,
    subsequentMinutes,
    band,
    nextAt,
    subsequentAt,
    nextLabel: `${nextMinutes} min (${formatSingaporeClock(nextAt)})`,
    subsequentLabel: `${subsequentMinutes} min (${formatSingaporeClock(subsequentAt)})`,
  };
}
