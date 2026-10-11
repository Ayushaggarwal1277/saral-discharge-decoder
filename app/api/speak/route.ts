import { findLanguage } from "@/lib/languages";
import { errorResponse, sarvam } from "@/lib/sarvam";

export const maxDuration = 60;

// Bulbul v3 accepts up to 2500 characters per request; stay well under it.
const MAX_CHUNK = 1800;
const MAX_TEXT = 9000;

/** Splits on sentence ends (including the Devanagari danda) so no chunk exceeds the model limit. */
function chunkText(text: string): string[] {
    const sentences = text.match(/[^.!?।\n]+[.!?।\n]*\s*/g) ?? [text];
    const chunks: string[] = [];
    let current = "";
    for (const sentence of sentences) {
        if (current && current.length + sentence.length > MAX_CHUNK) {
            chunks.push(current);
            current = "";
        }
        current += sentence;
        while (current.length > MAX_CHUNK) {
            chunks.push(current.slice(0, MAX_CHUNK));
            current = current.slice(MAX_CHUNK);
        }
    }
    if (current.trim()) chunks.push(current);
    return chunks;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const text = typeof body.text === "string" ? body.text.trim().slice(0, MAX_TEXT) : "";
        if (!text) return Response.json({ error: "Nothing to read aloud." }, { status: 400 });
        const language = findLanguage(body.language);
        if (!language) return Response.json({ error: "Unsupported language." }, { status: 400 });

        const parts = await Promise.all(
            chunkText(text).map((chunk) =>
                sarvam().textToSpeech.convert({
                    text: chunk,
                    language_code: language.code,
                    model: "bulbul:v3",
                    speaker: "priya",
                    pace: body.slow ? 0.8 : 1,
                    output_audio_codec: "mp3",
                }),
            ),
        );
        const audio = Buffer.concat(parts.map((part) => Buffer.from(part.audios[0], "base64")));
        return new Response(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
    } catch (err) {
        return errorResponse(err);
    }
}
