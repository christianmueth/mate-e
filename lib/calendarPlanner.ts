export type Availability = {
  workdays: number[];
  startMinutes: number;
  endMinutes: number;
};

export type PlannerEvent = {
  startsAt: Date;
  endsAt: Date;
  recurrence: string;
  recurrenceUntil: Date | null;
};

export type ProposedBlock = {
  title: string;
  startsAt: string;
  endsAt: string;
};

export const DEFAULT_AVAILABILITY: Availability = {
  workdays: [1, 2, 3, 4, 5],
  startMinutes: 9 * 60,
  endMinutes: 17 * 60,
};

export function sanitizeAvailability(value: unknown): Availability {
  if (!value || typeof value !== "object" || Array.isArray(value)) return DEFAULT_AVAILABILITY;
  const record = value as Record<string, unknown>;
  const workdays = Array.isArray(record.workdays)
    ? [...new Set(record.workdays.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6))].sort()
    : DEFAULT_AVAILABILITY.workdays;
  const startMinutes = Number(record.startMinutes);
  const endMinutes = Number(record.endMinutes);
  return {
    workdays: workdays.length ? workdays : DEFAULT_AVAILABILITY.workdays,
    startMinutes: Number.isInteger(startMinutes) && startMinutes >= 0 && startMinutes < 24 * 60 ? startMinutes : DEFAULT_AVAILABILITY.startMinutes,
    endMinutes: Number.isInteger(endMinutes) && endMinutes > 0 && endMinutes <= 24 * 60 ? endMinutes : DEFAULT_AVAILABILITY.endMinutes,
  };
}

export function buildConflictFreeProposal({
  title,
  deadline,
  totalMinutes,
  availability,
  events,
}: {
  title: string;
  deadline: Date;
  totalMinutes: number;
  availability: Availability;
  events: PlannerEvent[];
}) {
  if (availability.endMinutes <= availability.startMinutes) return { blocks: [], error: "Set an availability end time after the start time." };
  const now = new Date();
  const cursor = startOfDay(now);
  const deadlineDay = startOfDay(deadline);
  const blocks: ProposedBlock[] = [];
  let remaining = totalMinutes;

  while (cursor <= deadlineDay && remaining > 0) {
    if (availability.workdays.includes(cursor.getDay())) {
      let candidate = setMinutes(cursor, availability.startMinutes);
      const dayEnd = setMinutes(cursor, availability.endMinutes);
      if (sameDay(cursor, now) && candidate < now) candidate = roundUp(now, 30);
      const limit = sameDay(cursor, deadline) ? deadline : dayEnd;

      while (candidate < limit && remaining > 0) {
        const duration = Math.min(60, remaining);
        const end = new Date(candidate.getTime() + duration * 60_000);
        if (end > limit || end > dayEnd) break;
        if (hasConflict(candidate, end, events)) {
          candidate = new Date(candidate.getTime() + 30 * 60_000);
          continue;
        }
        blocks.push({ title, startsAt: candidate.toISOString(), endsAt: end.toISOString() });
        remaining -= duration;
        candidate = end;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return remaining ? { blocks: [], error: "There is not enough free time before this deadline with your availability preferences." } : { blocks };
}

function hasConflict(start: Date, end: Date, events: PlannerEvent[]) {
  return events.some((event) => {
    if (!occursOn(event, start)) return false;
    const occurrenceStart = setTime(start, event.startsAt);
    const duration = event.endsAt.getTime() - event.startsAt.getTime();
    const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
    return start < occurrenceEnd && end > occurrenceStart;
  });
}

function occursOn(event: PlannerEvent, date: Date) {
  const eventDay = startOfDay(event.startsAt);
  const currentDay = startOfDay(date);
  if (currentDay < eventDay || (event.recurrenceUntil && currentDay > startOfDay(event.recurrenceUntil))) return false;
  const days = Math.round((currentDay.getTime() - eventDay.getTime()) / 86_400_000);
  if (event.recurrence === "NONE") return days === 0;
  if (event.recurrence === "DAILY") return true;
  if (event.recurrence === "WEEKLY") return days % 7 === 0;
  return currentDay.getDate() === eventDay.getDate();
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function setMinutes(date: Date, minutes: number) {
  const value = startOfDay(date);
  value.setMinutes(minutes);
  return value;
}

function setTime(date: Date, source: Date) {
  const value = startOfDay(date);
  value.setHours(source.getHours(), source.getMinutes(), 0, 0);
  return value;
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function roundUp(value: Date, minutes: number) {
  const rounded = new Date(value);
  rounded.setSeconds(0, 0);
  rounded.setMinutes(Math.ceil(rounded.getMinutes() / minutes) * minutes);
  return rounded;
}
