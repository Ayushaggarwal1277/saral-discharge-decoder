import { blocksToPrompt } from "./document";
import { isWrittenIn, type Language } from "./languages";
import { chatJson } from "./sarvam";
import type { Answer, Block, Details, FollowUp, Medicine, Sourced, Summary } from "./types";

// Shapes are spelled out in the prompt and checked in code afterwards: Sarvam's strict
// json_schema mode can stall on long outputs, while JSON-object mode with a template is reliable.
const SUMMARY_SHAPE = `{
  "facts": {                          // fill this first, copying the document's own words without translating
    "reason_for_admission": string,
    "treatment_done": string,
    "advice": [string],               // every instruction for home
    "must_not_stop": [string],        // medicines the document says not to stop
    "next_visit": string | null,
    "warning_signs": [string]         // every symptom listed for returning to hospital
  },
  "headline": string,                 // one short sentence in the reader's language that sums up the document
  "narration": string,                // script in the reader's language to be read aloud, 110 to 150 words, built only from "facts"
  "what_happened": [                  // 3 to 5 points in the reader's language and in plain words: why admitted, what was found, what was done, how they are now
    { "text": string, "sources": [number] }
  ]
}`;

const DETAILS_SHAPE = `{
  "document_type": "discharge_summary" | "insurance_letter" | "other",
  "patient_name": string | null,      // exactly as written
  "discharge_date": string | null,    // date of discharge (or of the letter) as YYYY-MM-DD
  "medicines": [
    {
      "name": string,                 // exactly as written, in English letters
      "purpose": string,              // what it is for, in a few simple words
      "dose": string,                 // strength exactly as written, e.g. "75 mg"
      "schedule": string,             // the frequency column copied exactly as written, e.g. "1-0-1 (BD, after meals)"
      "morning": boolean, "afternoon": boolean, "night": boolean,
      "when": string,                 // when and how to take it, in plain words with no abbreviations
      "duration": string,             // how long to take it, translated into plain words
      "sources": [number]
    }
  ],
  "checklist": [                      // things to do at home, grouped by period
    { "period": string, "tasks": [ { "text": string, "sources": [number] } ] }
  ],
  "follow_ups": [                     // one entry per doctor visit and one per repeat test, however far in the future
    {
      "what": string,                 // who to see or which test to get, and what to bring
      "when_text": string,            // when, in plain words
      "date": string | null,          // YYYY-MM-DD, only if the document states an exact date
      "time": string | null,          // HH:MM in 24-hour form, only if the document states a time
      "days_after_discharge": number | null,  // for gaps like "after 6 weeks" (42); null when an exact date is stated
      "sources": [number]
    }
  ],
  "warning_signs": [ { "text": string, "sources": [number] } ],  // one entry per symptom the document says needs emergency care
  "emergency_contact": string | null, // emergency phone number exactly as written
  "terms": [                          // medical words or abbreviations from the document
    { "term": string, "meaning": string, "sources": [number] }  // "term" copied letter for letter from the document
  ],
  "questions_for_doctor": [string]    // things the document leaves unclear; empty if none
}`;

const ANSWER_SHAPE = `{ "answer": string, "sources": [number] }`;

const READER = `You explain hospital paperwork to patients and their families in India. The reader has no medical training and may be elderly or have little schooling.

You are given the text of a document read from a photo or PDF, split into numbered blocks such as [12]. It is usually a hospital discharge summary; it may be an insurance pre-authorisation letter.

Abbreviations Indian hospitals commonly use: OD once a day; BD or BID twice a day; TDS or TID three times a day; QID four times a day; HS at bedtime; SOS only when needed; STAT immediately; BBF before breakfast; AC before food; PC after food; S/L under the tongue; Tab. tablet; Cap. capsule; Inj. injection; Syp. syrup; C/o complains of; H/o history of; Pt. patient; DOA date of admission; DOD date of discharge; POD post-operative day (days since the operation); OPD outpatient clinic; x 5 days means for 5 days. A dose pattern like 1-0-1 means morning, afternoon, night; the document text spells each one out in square brackets after the pattern.`;

function languageRules(language: Language): string {
    return `Language:
- Write in ${language.name}, in ${language.script} script, using the everyday words a family member would use at home. Avoid formal or textbook vocabulary.
- Keep medicine names, doses, test values and phone numbers exactly as written in the document, in English letters, so they match the medicine strip and reports.
- Never leave a medical abbreviation unexplained. Say what it means instead (for example "BD" is twice a day, "1-0-1" is one in the morning and one at night, "SOS" is only when needed).`;
}

const GROUNDING_RULES = `Staying true to the document:
- Use only what the document says. Do not add a diagnosis, medicine, dose, test or instruction that is not written there.
- Every symptom, medicine, duration and instruction you mention must appear in the document. Do not add examples of your own, and keep each medicine's duration exactly as the document gives it.
- You may add a short, standard explanation of what a medical word means or what a listed medicine is generally for. If you are not sure what an abbreviation stands for, leave it out.
- Never suggest starting, stopping or changing a medicine.
- If something is unclear, missing or looks contradictory, do not guess.`;

function jsonReply(shape: string): string {
    return `Reply with one JSON object and nothing else, in exactly this shape (the // notes are guidance, do not copy them). In every "sources" field, list the block numbers the item comes from.

${shape}`;
}

/** The last thing the model reads: without this reminder it drifts to English or to English letters. */
function languageReminder(language: Language): string {
    if (language.code === "en-IN") return "Write everything in simple Indian English.";
    return `Write every sentence in ${language.name} using ${language.script} script. Do not answer in English and do not write ${language.name} in English letters. Only medicine names, doses and test values stay in English letters.`;
}

/** Runs `produce`, and once more if what came back is not in the requested script. */
async function inLanguage<T>(language: Language, produce: () => Promise<T>, sample: (value: T) => string): Promise<T> {
    const first = await produce();
    return isWrittenIn(language, sample(first)) ? first : produce();
}

/** The short part: a headline, the spoken narration and the story of the hospital stay. */
export async function summariseDocument(blocks: Block[], language: Language): Promise<Summary> {
    const system = `${READER}

${languageRules(language)}

${GROUNDING_RULES}

Filling the fields:
- facts comes first and is copied from the document. Everything in the narration must come from facts: mention no advice and no warning sign that is not listed there, and do not turn one into something stronger or different.
- narration is heard, not read. Speak directly to the patient as "you", warmly, in short sentences. No lists, brackets, symbols or abbreviations. Say numbers and dates the way people say them. Cover, in this order: what happened, what was done, the most important things to do and avoid at home, the date of the next visit, and the warning signs for which they must rush to the hospital.
- In the narration, do not go through the medicines one by one, count them or give their durations; the screen shows the full medicine list. Say only that they should take every medicine as listed, and name every medicine in must_not_stop, spelled in English letters exactly as in the document. Never say a phone number; say "the emergency number on your discharge paper" instead.
- Only facts stays in the document's language. headline, narration and what_happened are written for the reader, with every medical term replaced by plain words.
- For an insurance letter, cover what was approved, the amount, what is not covered and what to do next.

${jsonReply(SUMMARY_SHAPE)}`;

    const produce = async (): Promise<Summary> => {
        const raw = await chatJson({
            model: "sarvam-105b",
            system,
            user: `Document:\n\n${blocksToPrompt(blocks)}\n\n${languageReminder(language)} In the narration, talk to the patient directly as "you", never about them as "he" or "she".`,
            maxTokens: 2500,
        });
        const narration = str(raw.narration);
        if (!narration) throw new Error("The explanation came back incomplete. Please try again.");
        return {
            headline: str(raw.headline),
            narration,
            what_happened: sourced(raw.what_happened, blocks.length),
        };
    };
    return inLanguage(language, produce, (summary) => `${summary.headline} ${summary.narration}`);
}

/** The structured part: medicines, checklist, follow-ups, warning signs and glossary. */
export async function detailDocument(blocks: Block[], language: Language): Promise<Details> {
    const system = `${READER}

${languageRules(language)}

${GROUNDING_RULES}
- Put anything unclear in questions_for_doctor.

Filling the fields:
- medicines: one entry per medicine. Set morning, afternoon and night from the schedule: the three numbers stand for morning, afternoon and night, so 1-0-0 is morning only and 1-0-1 is morning and night. For "only when needed" medicines set all three to false and explain in "when".
- checklist: cover every piece of home-care advice in the document, so that nothing the doctor asked for is left out: food, things to avoid, activity, wound care, checks to do at home. Each task is one concrete action. Start with a group for things to do every day, then one group per time period in order (for example the first 3 days, the first 4 weeks). Do not put doctor visits or hospital tests here.
- follow_ups: doctor visits and repeat tests go here and only here. If the document asks for a visit next week, blood tests after 6 weeks and a scan after 3 months, that is three entries.
- warning_signs: one entry per symptom, never several symptoms in one entry.
- questions_for_doctor: only genuine gaps or contradictions in the document, such as a medicine with no dose or duration. Most documents need none, so this is usually empty.
- terms: the 6 to 10 medical words or abbreviations a patient is most likely to wonder about. Include only ones whose meaning you are sure of.
- For an insurance letter, leave the medicine fields empty and use the checklist for what the patient needs to do next.
- Leave an array empty when the document has nothing for it.

${jsonReply(DETAILS_SHAPE)}`;

    const produce = async () =>
        normaliseDetails(
            await chatJson({
                model: "sarvam-105b",
                system,
                user: `Document:\n\n${blocksToPrompt(blocks)}\n\n${languageReminder(language)}`,
                maxTokens: 5000,
            }),
            blocks,
        );
    return inLanguage(language, produce, (details) =>
        [
            ...details.medicines.flatMap((m) => [m.purpose, m.when]),
            ...details.checklist.flatMap((group) => group.tasks.map((task) => task.text)),
            ...details.warning_signs.map((sign) => sign.text),
        ].join(" "),
    );
}

export async function answerQuestion(
    blocks: Block[],
    language: Language,
    question: string,
    history: { question: string; answer: string }[],
): Promise<Answer> {
    const system = `You are answering a patient's spoken question about their own hospital document. Your answer will be read aloud to them.

${languageRules(language)}

${GROUNDING_RULES}
- If the document does not answer the question, say so plainly, share anything related that it does say, and suggest asking their doctor.
- If they describe a symptom the document lists as a warning sign, or anything that sounds like an emergency, tell them to go to the hospital or call the emergency number in the document right away.

Answer in 2 to 4 short spoken sentences, with no lists, brackets or symbols.

Reply with one JSON object and nothing else, in exactly this shape, where "sources" lists the block numbers you used:

${ANSWER_SHAPE}

Document:

${blocksToPrompt(blocks)}`;

    const earlier = history
        .slice(-4)
        .map((turn) => `Patient: ${turn.question}\nYou: ${turn.answer}`)
        .join("\n\n");

    const produce = async (): Promise<Answer> => {
        const raw = await chatJson({
            model: "sarvam-105b-conversations",
            system,
            user: `${earlier ? `Earlier in this conversation:\n\n${earlier}\n\n` : ""}Patient's question: ${question}\n\n${languageReminder(language)}`,
            maxTokens: 800,
        });
        const answer = str(raw.answer);
        if (!answer) throw new Error("The model did not return an answer.");
        return { answer, sources: ids(raw.sources, blocks.length) };
    };
    return inLanguage(language, produce, (reply) => reply.answer);
}

// The model's JSON is not schema-enforced, so every field is coerced to the type the UI expects.

type Raw = Record<string, unknown>;

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const strOrNull = (value: unknown): string | null => str(value) || null;
const list = (value: unknown): Raw[] =>
    Array.isArray(value) ? value.filter((item): item is Raw => typeof item === "object" && item !== null) : [];

function ids(value: unknown, blockCount: number): number[] {
    if (!Array.isArray(value)) return [];
    const valid = value.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= blockCount);
    return [...new Set(valid)];
}

function matching(value: unknown, pattern: RegExp): string | null {
    const text = str(value);
    return pattern.test(text) ? text : null;
}

function sourced(value: unknown, blockCount: number): Sourced[] {
    return list(value)
        .map((item) => ({ text: str(item.text), sources: ids(item.sources, blockCount) }))
        .filter((item) => item.text);
}

/** Prefers the written "1-0-1" pattern, which is unambiguous, over the model's own reading of it. */
function timesOfDay(medicine: Raw): Pick<Medicine, "morning" | "afternoon" | "night"> {
    const pattern = str(medicine.schedule).match(/(?<![\d-])([\d½])\s*-\s*([\d½])\s*-\s*([\d½])(?![\d-])/);
    if (pattern) {
        const [morning, afternoon, night] = pattern.slice(1).map((dose) => dose !== "0");
        return { morning, afternoon, night };
    }
    return { morning: medicine.morning === true, afternoon: medicine.afternoon === true, night: medicine.night === true };
}

/** The model sometimes repeats a period heading; fold those groups together. */
function mergeByPeriod(groups: Details["checklist"]): Details["checklist"] {
    const merged = new Map<string, Sourced[]>();
    for (const group of groups) {
        merged.set(group.period, [...(merged.get(group.period) ?? []), ...group.tasks]);
    }
    return [...merged].map(([period, tasks]) => ({ period, tasks })).filter((group) => group.tasks.length > 0);
}

function normaliseDetails(raw: Raw, blocks: Block[]): Details {
    const count = blocks.length;

    // Names and numbers the patient will act on are dropped unless the document really contains them.
    const squash = (text: string) => text.toLowerCase().replace(/\s+/g, " ");
    const documentText = squash(blocks.map((b) => b.text).join(" "));
    const inDocument = (text: string) => documentText.includes(squash(text));
    const nameInDocument = (name: string) => (name.match(/[A-Za-z]{4,}/g) ?? []).some(inDocument);
    const phone = strOrNull(raw.emergency_contact);
    const phoneDigits = phone?.match(/\d[\d\s-]{5,}\d/)?.[0].replace(/\D/g, "");

    const medicines: Medicine[] = list(raw.medicines)
        .map((m) => ({
            name: str(m.name),
            purpose: str(m.purpose),
            dose: str(m.dose),
            ...timesOfDay(m),
            when: str(m.when),
            duration: str(m.duration),
            sources: ids(m.sources, count),
        }))
        .filter((m) => nameInDocument(m.name));

    const followUps: FollowUp[] = list(raw.follow_ups)
        .map((f) => {
            const days = Number(f.days_after_discharge);
            return {
                what: str(f.what),
                when_text: str(f.when_text),
                date: matching(f.date, /^\d{4}-\d{2}-\d{2}$/),
                time: matching(f.time, /^\d{2}:\d{2}$/),
                days_after_discharge:
                    f.days_after_discharge != null && Number.isFinite(days) && days > 0 ? Math.round(days) : null,
                sources: ids(f.sources, count),
            };
        })
        .filter((f) => f.what);

    const type = str(raw.document_type);
    return {
        document_type: type === "discharge_summary" || type === "insurance_letter" ? type : "other",
        patient_name: strOrNull(raw.patient_name),
        discharge_date: matching(raw.discharge_date, /^\d{4}-\d{2}-\d{2}$/),
        medicines,
        checklist: mergeByPeriod(
            list(raw.checklist).map((group) => ({ period: str(group.period), tasks: sourced(group.tasks, count) })),
        ),
        follow_ups: followUps,
        warning_signs: sourced(raw.warning_signs, count),
        emergency_contact: phoneDigits && documentText.replace(/\D/g, "").includes(phoneDigits) ? phone : null,
        terms: list(raw.terms)
            .map((t) => ({ term: str(t.term), meaning: str(t.meaning), sources: ids(t.sources, count) }))
            .filter((t) => t.term && t.meaning && inDocument(t.term)),
        questions_for_doctor: Array.isArray(raw.questions_for_doctor)
            ? raw.questions_for_doctor.map(str).filter(Boolean)
            : [],
    };
}
