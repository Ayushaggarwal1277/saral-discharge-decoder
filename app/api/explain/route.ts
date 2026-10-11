import { parseBlocks } from "@/lib/document";
import { detailDocument, summariseDocument } from "@/lib/explain";
import { findLanguage } from "@/lib/languages";
import { errorResponse } from "@/lib/sarvam";

export const maxDuration = 120;

/** The browser asks for the two parts in parallel so the summary can be shown and spoken first. */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const language = findLanguage(body.language);
        if (!language) return Response.json({ error: "Unsupported language." }, { status: 400 });
        const blocks = parseBlocks(body.blocks);
        if (body.part === "summary") return Response.json(await summariseDocument(blocks, language));
        if (body.part === "details") return Response.json(await detailDocument(blocks, language));
        return Response.json({ error: "Unknown part." }, { status: 400 });
    } catch (err) {
        return errorResponse(err);
    }
}
