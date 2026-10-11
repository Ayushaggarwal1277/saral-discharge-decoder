"use client";

import { useState, type ReactNode } from "react";
import { calendarFile, followUpDate } from "@/lib/calendar";
import type { Labels } from "@/lib/labels";
import type { Details, FollowUp, Summary } from "@/lib/types";
import type { Speech } from "@/lib/useSpeech";
import {
    AlertIcon,
    CalendarIcon,
    LocateIcon,
    MoonIcon,
    PhoneIcon,
    PlayIcon,
    SpeakerIcon,
    StopIcon,
    SunIcon,
    SunriseIcon,
} from "./icons";

interface Props {
    summary: Summary;
    /** Arrives a few seconds after the summary; null while it is still being written. */
    details: Details | null;
    detailsPending: boolean;
    labels: Labels;
    /** BCP-47 code of the reader's language, for formatting dates. */
    locale: string;
    speech: Speech;
    onSource: (ids: number[]) => void;
}

export function Explanation({ summary, details, detailsPending, labels, locale, speech, onSource }: Props) {
    const [done, setDone] = useState<Set<string>>(new Set());

    const toggleDone = (key: string) =>
        setDone((previous) => {
            const next = new Set(previous);
            if (!next.delete(key)) next.add(key);
            return next;
        });

    const source = (ids: number[]) =>
        ids.length > 0 && (
            <button className="icon-button" onClick={() => onSource(ids)} title={labels.showSource} aria-label={labels.showSource}>
                <LocateIcon size={18} />
            </button>
        );

    const section = (id: string, title: string, spoken: string, children: ReactNode, tone = "") => (
        <section className={`card ${tone}`}>
            <header className="card-head">
                <h2>{title}</h2>
                <button
                    className="icon-button"
                    onClick={() => speech.toggle(id, `${title}. ${spoken}`)}
                    title={speech.activeId === id ? labels.stop : labels.readAloud}
                    aria-label={speech.activeId === id ? labels.stop : labels.readAloud}
                >
                    {speech.activeId === id ? <StopIcon size={18} /> : <SpeakerIcon size={18} />}
                </button>
            </header>
            {children}
        </section>
    );

    const narrating = speech.activeId === "narration";

    return (
        <div className="explanation">
            <section className="card hero">
                <h1>{summary.headline}</h1>
                <button className="listen" onClick={() => speech.toggle("narration", summary.narration)}>
                    <span className="listen-icon">
                        {narrating && speech.status === "loading" ? (
                            <span className="spinner" />
                        ) : narrating ? (
                            <StopIcon size={26} />
                        ) : (
                            <PlayIcon size={26} />
                        )}
                    </span>
                    <span>{narrating ? labels.stop : labels.listen}</span>
                </button>
                <div className="progress" aria-hidden="true">
                    <div style={{ width: `${narrating ? speech.progress * 100 : 0}%` }} />
                </div>
                <p className="narration">{summary.narration}</p>
            </section>

            {summary.what_happened.length > 0 &&
                section(
                    "what",
                    labels.whatHappened,
                    summary.what_happened.map((item) => item.text).join(" "),
                    <ul className="plain">
                        {summary.what_happened.map((item, i) => (
                            <li key={i}>
                                <span>{item.text}</span>
                                {source(item.sources)}
                            </li>
                        ))}
                    </ul>,
                )}

            {detailsPending && (
                <section className="card loading-card">
                    <span className="spinner" />
                </section>
            )}

            {details && details.warning_signs.length > 0 &&
                section(
                    "warning",
                    labels.warningSigns,
                    details.warning_signs.map((sign) => sign.text).join(". "),
                    <>
                        <ul className="plain warning-list">
                            {details.warning_signs.map((sign, i) => (
                                <li key={i}>
                                    <AlertIcon size={18} />
                                    <span>{sign.text}</span>
                                    {source(sign.sources)}
                                </li>
                            ))}
                        </ul>
                        {details.emergency_contact && (
                            <a className="emergency" href={`tel:${details.emergency_contact.replace(/[^\d+]/g, "")}`}>
                                <PhoneIcon size={18} />
                                <span>
                                    {labels.emergencyNumber}: <strong>{details.emergency_contact}</strong>
                                </span>
                            </a>
                        )}
                    </>,
                    "warning",
                )}

            {details && details.medicines.length > 0 &&
                section(
                    "medicines",
                    labels.medicines,
                    details.medicines.map((m) => `${m.name}, ${m.dose}. ${m.purpose}. ${m.when}. ${m.duration}.`).join(" "),
                    <ul className="medicines">
                        {details.medicines.map((medicine, i) => {
                            const scheduled = medicine.morning || medicine.afternoon || medicine.night;
                            return (
                                <li key={i}>
                                    <div className="medicine-top">
                                        <div>
                                            <strong>{medicine.name}</strong> <span className="dose">{medicine.dose}</span>
                                            <div className="purpose">{medicine.purpose}</div>
                                        </div>
                                        {source(medicine.sources)}
                                    </div>
                                    <div className="times">
                                        {scheduled ? (
                                            <>
                                                <span className={medicine.morning ? "time on" : "time"}>
                                                    <SunriseIcon size={18} /> {labels.morning}
                                                </span>
                                                <span className={medicine.afternoon ? "time on" : "time"}>
                                                    <SunIcon size={18} /> {labels.afternoon}
                                                </span>
                                                <span className={medicine.night ? "time on" : "time"}>
                                                    <MoonIcon size={18} /> {labels.night}
                                                </span>
                                            </>
                                        ) : (
                                            <span className="time on needed">{labels.whenNeeded}</span>
                                        )}
                                    </div>
                                    <div className="medicine-how">
                                        {medicine.when}
                                        {medicine.duration && <span className="duration">{medicine.duration}</span>}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>,
                )}

            {details && details.checklist.length > 0 &&
                section(
                    "checklist",
                    labels.checklist,
                    details.checklist.map((group) => `${group.period}. ${group.tasks.map((task) => task.text).join(" ")}`).join(" "),
                    details.checklist.map((group, g) => (
                        <div key={g} className="period">
                            <h3>{group.period}</h3>
                            <ul className="plain tasks">
                                {group.tasks.map((task, t) => {
                                    const key = `${g}-${t}`;
                                    return (
                                        <li key={key} className={done.has(key) ? "done" : ""}>
                                            <label>
                                                <input type="checkbox" checked={done.has(key)} onChange={() => toggleDone(key)} />
                                                <span>{task.text}</span>
                                            </label>
                                            {source(task.sources)}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )),
                )}

            {details && details.follow_ups.length > 0 &&
                section(
                    "followups",
                    labels.followUps,
                    details.follow_ups.map((visit) => `${visit.what}. ${visit.when_text}.`).join(" "),
                    <ul className="plain visits">
                        {details.follow_ups.map((visit, i) => (
                            <Visit
                                key={i}
                                visit={visit}
                                date={followUpDate(visit, details.discharge_date)}
                                locale={locale}
                                label={labels.addToCalendar}
                                source={source(visit.sources)}
                            />
                        ))}
                    </ul>,
                )}

            {details && details.terms.length > 0 &&
                section(
                    "terms",
                    labels.terms,
                    details.terms.map((term) => `${term.term}: ${term.meaning}.`).join(" "),
                    <dl className="terms">
                        {details.terms.map((term, i) => (
                            <div key={i}>
                                <dt>
                                    {term.term}
                                    {source(term.sources)}
                                </dt>
                                <dd>{term.meaning}</dd>
                            </div>
                        ))}
                    </dl>,
                )}

            {details && details.questions_for_doctor.length > 0 &&
                section(
                    "questions",
                    labels.questions,
                    details.questions_for_doctor.join(" "),
                    <ul className="plain bullets">
                        {details.questions_for_doctor.map((question, i) => (
                            <li key={i}>{question}</li>
                        ))}
                    </ul>,
                )}
        </div>
    );
}

function Visit(props: { visit: FollowUp; date: string | null; locale: string; label: string; source: ReactNode }) {
    const { visit, date } = props;
    const shown = date
        ? new Date(`${date}T00:00:00`).toLocaleDateString(props.locale, { day: "numeric", month: "short", year: "numeric" })
        : null;

    const download = () => {
        if (!date) return;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(calendarFile(visit, date));
        link.download = "follow-up.ics";
        link.click();
        URL.revokeObjectURL(link.href);
    };

    return (
        <li>
            <div className="visit-date">
                <CalendarIcon size={18} />
                <span>
                    {shown ?? visit.when_text}
                    {shown && visit.time ? `, ${visit.time}` : ""}
                </span>
            </div>
            <div className="visit-body">
                <span>{visit.what}</span>
                {shown && <span className="visit-when">{visit.when_text}</span>}
            </div>
            <div className="visit-actions">
                {props.source}
                {date && (
                    <button className="small-button" onClick={download}>
                        {props.label}
                    </button>
                )}
            </div>
        </li>
    );
}
