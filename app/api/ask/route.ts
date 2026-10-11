import { parseBlocks } from "@/lib/document";
import { answerQuestion } from "@/lib/explain";
import { findLanguage } from "@/lib/languages";
import { errorResponse, sarvam } from "@/lib/sarvam";

export const maxDuration = 60;

/** Accepts a typed question or a short voice recording, and answers it from the document. */
export async function POST(request: Request) {
    try {
        const form = await request.formData();
        const language = findLanguage(form.get("language"));
        if (!language) return Response.json({ error: "Unsupported language." }, { status: 400 });

        const blocks = parseBlocks(JSON.parse(String(form.get("blocks") ?? "null")));
        const parsedHistory = JSON.parse(String(form.get("history") ?? "[]"));
        const history = (Array.isArray(parsedHistory) ? parsedHistory : []).map((turn) => ({
            question: String(turn?.question ?? ""),
            answer: String(turn?.answer ?? ""),
        }));

        let question = String(form.get("question") ?? "").trim();
        const audio = form.get("audio");
        if (!question && audio instanceof File) {
            const heard = await sarvam().speechToText.transcribe({
                file: audio,
                model: "saaras:v3",
                mode: "transcribe",
                language_code: language.code,
            });
            question = heard.transcript.trim();
        }
        if (!question) {
            return Response.json({ error: "I couldn't hear a question. Please try again." }, { status: 400 });
        }

        const answer = await answerQuestion(blocks, language, question.slice(0, 1000), history);
        return Response.json({ question, ...answer });
    } catch (err) {
        return errorResponse(err);
    }
}
