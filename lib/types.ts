/** One piece of text read from the document, with where it sits on the page. */
export interface Block {
    /** Sequential number across the whole document; this is what the model cites. */
    id: number;
    page: number;
    text: string;
    tag: string;
    /** Normalised [x1, y1, x2, y2] on the page, each 0..1. */
    bbox: [number, number, number, number] | null;
}

export interface Sourced {
    text: string;
    sources: number[];
}

export interface Medicine {
    name: string;
    purpose: string;
    dose: string;
    morning: boolean;
    afternoon: boolean;
    night: boolean;
    when: string;
    duration: string;
    sources: number[];
}

export interface FollowUp {
    what: string;
    when_text: string;
    /** YYYY-MM-DD when the document gives an exact date. */
    date: string | null;
    /** HH:MM (24h) when the document gives a time. */
    time: string | null;
    /** For "after 6 weeks" style follow-ups: days counted from discharge. */
    days_after_discharge: number | null;
    sources: number[];
}

/** The short part of the explanation, ready first so the audio can start early. */
export interface Summary {
    headline: string;
    narration: string;
    what_happened: Sourced[];
}

/** The structured part of the explanation. */
export interface Details {
    document_type: "discharge_summary" | "insurance_letter" | "other";
    patient_name: string | null;
    discharge_date: string | null;
    medicines: Medicine[];
    checklist: { period: string; tasks: Sourced[] }[];
    follow_ups: FollowUp[];
    warning_signs: Sourced[];
    emergency_contact: string | null;
    terms: { term: string; meaning: string; sources: number[] }[];
    questions_for_doctor: string[];
}

export interface Answer {
    answer: string;
    sources: number[];
}
