import { readDocument } from "@/lib/document";
import { errorResponse } from "@/lib/sarvam";

export const maxDuration = 120;

const ACCEPTED = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
    try {
        const file = (await request.formData()).get("file");
        if (!(file instanceof File)) return Response.json({ error: "No file was uploaded." }, { status: 400 });
        if (!ACCEPTED.includes(file.type)) {
            return Response.json({ error: "Please upload a photo (JPG or PNG) or a PDF." }, { status: 400 });
        }
        if (file.size > MAX_BYTES) {
            return Response.json({ error: "That file is too large. Please upload one under 15 MB." }, { status: 400 });
        }
        return Response.json({ blocks: await readDocument(file) });
    } catch (err) {
        return errorResponse(err);
    }
}
