export interface TrainHeadwayEstimate {
  nextMinutes: number | null;
  subsequentMinutes: number | null;
  band: "Peak hours" | "Off-peak" | "Late night";
  operating: boolean;
  nextAt: Date | null;
  subsequentAt: Date | null;
  firstTrain: string | null;
  firstTrainAt: Date | null;
  firstTrainLabel: string | null;
  lastTrain: string | null;
  lastTrainAt: Date | null;
  nextLabel: string;
  subsequentLabel: string;
  serviceNotice: string | null;
}

export interface TrainOperatingWindow {
  firstTrain?: string | null;
  lastTrain?: string | null;
}

const DEFAULT_FIRST_TRAIN = "05:30";
const DEFAULT_LAST_TRAIN = "23:45";

function singaporeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    weekday: get("weekday"),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function parseClock(value?: string | null): number | null {
  if (!value) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
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

function singaporeDateAt(parts: ReturnType<typeof singaporeParts>, minutesOfDay: number): Date {
  const hour = Math.floor(minutesOfDay / 60) % 24;
  const minute = minutesOfDay % 60;
  return new Date(
    `${parts.year}-${parts.month}-${parts.day}T${String(hour).padStart(2, "0")}:${String(
      minute,
    ).padStart(2, "0")}:00+08:00`,
  );
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
}

function getWindow(
  now: Date,
  firstTrain?: string | null,
  lastTrain?: string | null,
) {
  const parts = singaporeParts(now);
  const nowMinutes = parts.hour * 60 + parts.minute;
  const first = parseClock(firstTrain) ?? parseClock(DEFAULT_FIRST_TRAIN)!;
  const last = parseClock(lastTrain) ?? parseClock(DEFAULT_LAST_TRAIN)!;
  const crossesMidnight = last < first;

  let firstAt = singaporeDateAt(parts, first);
  let lastAt = singaporeDateAt(parts, last);
  let operating = false;

  if (crossesMidnight) {
    operating = nowMinutes >= first || nowMinutes <= last;
    if (nowMinutes >= first) {
      lastAt = addDays(lastAt, 1);
    } else {
      firstAt = addDays(firstAt, -1);
    }
  } else {
    operating = nowMinutes >= first && nowMinutes <= last;
  }

  const nextFirstAt = operating || now < firstAt ? firstAt : addDays(firstAt, 1);

  return {
    operating,
    firstAt,
    lastAt,
    nextFirstAt,
    firstLabel: formatSingaporeClock(nextFirstAt),
  };
}

export function estimateTrainHeadway(
  now: Date = new Date(),
  seed = "",
  window: TrainOperatingWindow = {},
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

  const serviceWindow = getWindow(now, window.firstTrain, window.lastTrain);

  let nextAt = addMinutes(now, nextMinutes);
  let subsequentAt = addMinutes(now, subsequentMinutes);
  let operating = serviceWindow.operating;

  if (operating && nextAt > serviceWindow.lastAt) {
    operating = false;
  }

  if (!operating) {
    const firstWait = Math.max(
      0,
      Math.round((serviceWindow.nextFirstAt.getTime() - now.getTime()) / 60_000),
    );

    return {
      nextMinutes: firstWait,
      subsequentMinutes: null,
      band,
      operating: false,
      nextAt: serviceWindow.nextFirstAt,
      subsequentAt: null,
      firstTrain: window.firstTrain ?? DEFAULT_FIRST_TRAIN,
      firstTrainAt: serviceWindow.nextFirstAt,
      firstTrainLabel: serviceWindow.firstLabel,
      lastTrain: window.lastTrain ?? DEFAULT_LAST_TRAIN,
      lastTrainAt: serviceWindow.lastAt,
      nextLabel: `First train ${serviceWindow.firstLabel}`,
      subsequentLabel: "",
      serviceNotice: `No train service now. First train at ${serviceWindow.firstLabel}.`,
    };
  }

  return {
    nextMinutes,
    subsequentMinutes,
    band,
    operating: true,
    nextAt,
    subsequentAt,
    firstTrain: window.firstTrain ?? DEFAULT_FIRST_TRAIN,
    firstTrainAt: serviceWindow.firstAt,
    firstTrainLabel: formatSingaporeClock(serviceWindow.firstAt),
    lastTrain: window.lastTrain ?? DEFAULT_LAST_TRAIN,
    lastTrainAt: serviceWindow.lastAt,
    nextLabel: `${nextMinutes} min (${formatSingaporeClock(nextAt)})`,
    subsequentLabel: `${subsequentMinutes} min (${formatSingaporeClock(subsequentAt)})`,
    serviceNotice: null,
  };
}
