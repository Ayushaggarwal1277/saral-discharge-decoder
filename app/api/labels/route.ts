import { ENGLISH_LABELS, HINDI_LABELS, type Labels } from "@/lib/labels";
import { findLanguage, isWrittenIn } from "@/lib/languages";
import { chatJson, errorResponse } from "@/lib/sarvam";

const cache = new Map<string, Labels>([
    ["en-IN", ENGLISH_LABELS],
    ["hi-IN", HINDI_LABELS],
]);

/** Interface text in the reader's language. Translated once per language by the chat model, then cached. */
export async function GET(request: Request) {
    try {
        const language = findLanguage(new URL(request.url).searchParams.get("language"));
        if (!language) return Response.json({ error: "Unsupported language." }, { status: 400 });

        let labels = cache.get(language.code);
        if (!labels) {
            const raw = await chatJson({
                model: "sarvam-105b",
                system: `Translate the values of this JSON object into ${language.name}, written in ${language.script} script. They are short labels and buttons in a health app for patients, so use simple everyday words. Keep the keys unchanged. Reply with the translated JSON object and nothing else.`,
                user: JSON.stringify(ENGLISH_LABELS, null, 2),
                maxTokens: 2000,
            });
            const translated = { ...ENGLISH_LABELS };
            for (const key of Object.keys(ENGLISH_LABELS) as (keyof Labels)[]) {
                const value = raw[key];
                if (typeof value === "string" && value.trim() && isWrittenIn(language, value)) translated[key] = value.trim();
            }
            labels = translated;
            cache.set(language.code, labels);
        }
        return Response.json(labels);
    } catch (err) {
        return errorResponse(err);
    }
}
