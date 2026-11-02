export function parseCalendarEvent(body: Record<string, unknown>) {
  const title = text(body.title, 160);
  const startsAt = date(body.startsAt);
  const endsAt = date(body.endsAt);
  const recurrence = body.recurrence === "DAILY" || body.recurrence === "WEEKLY" || body.recurrence === "MONTHLY" ? body.recurrence : "NONE";
  const recurrenceUntil = recurrence === "NONE" ? null : optionalDate(body.recurrenceUntil);
  const reminderMinutes = optionalReminderMinutes(body.reminderMinutes);
  const taskId = text(body.taskId, 120) || null;

  if (!title) return { ok: false as const, error: "An event title is required." };
  if (!startsAt || !endsAt || endsAt <= startsAt) return { ok: false as const, error: "Choose an end time after the start time." };
  if (recurrence !== "NONE" && recurrenceUntil && recurrenceUntil < startsAt) {
    return { ok: false as const, error: "The recurrence end date must be after the event starts." };
  }
  if (body.reminderMinutes != null && reminderMinutes === null) {
    return { ok: false as const, error: "Choose a reminder between 5 minutes and 30 days." };
  }

  return {
    ok: true as const,
    data: {
      title,
      description: text(body.description, 2000) || null,
      startsAt,
      endsAt,
      timezone: text(body.timezone, 80) || "UTC",
      recurrence,
      recurrenceUntil,
      reminderMinutes,
      taskId,
    },
  };
}

function text(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function date(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function optionalDate(value: unknown) {
  return value == null || value === "" ? null : date(value);
}

function optionalReminderMinutes(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 5 && parsed <= 43_200 ? parsed : null;
}
