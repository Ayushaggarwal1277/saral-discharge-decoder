import type { FollowUp } from "./types";

/** The calendar date of a follow-up: the stated date, or discharge date plus the stated gap. */
export function followUpDate(followUp: FollowUp, dischargeDate: string | null): string | null {
    if (followUp.date) return followUp.date;
    if (!dischargeDate || followUp.days_after_discharge == null) return null;
    const date = new Date(`${dischargeDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + followUp.days_after_discharge);
    return date.toISOString().slice(0, 10);
}

const compact = (date: string) => date.replaceAll("-", "");
const escapeText = (text: string) => text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

/** A one-event .ics file. Timed when the document gives a time, otherwise an all-day event. */
export function calendarFile(followUp: FollowUp, date: string): Blob {
    let when: string[];
    if (followUp.time) {
        const start = `${compact(date)}T${followUp.time.replace(":", "")}00`;
        const endHour = String(Math.min(Number(followUp.time.slice(0, 2)) + 1, 23)).padStart(2, "0");
        when = [`DTSTART:${start}`, `DTEND:${compact(date)}T${endHour}${followUp.time.slice(3)}00`];
    } else {
        const next = new Date(`${date}T00:00:00Z`);
        next.setUTCDate(next.getUTCDate() + 1);
        when = [`DTSTART;VALUE=DATE:${compact(date)}`, `DTEND;VALUE=DATE:${compact(next.toISOString().slice(0, 10))}`];
    }
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Saral//Discharge follow-up//EN",
        "BEGIN:VEVENT",
        `UID:${date}-${Math.random().toString(36).slice(2)}@saral`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d{3}/g, "")}`,
        ...when,
        `SUMMARY:${escapeText(followUp.what)}`,
        `DESCRIPTION:${escapeText(followUp.when_text)}`,
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeText(followUp.what)}`,
        "TRIGGER:-P1D",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
    ];
    return new Blob([lines.join("\r\n")], { type: "text/calendar" });
}
