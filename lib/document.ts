import { sarvam } from "./sarvam";
import type { Block } from "./types";

const TERMINAL = ["completed", "partially_completed", "failed", "rejected"];
const POLL_MS = 1200;
const TIMEOUT_MS = 100_000;

// The JSON results carry layout blocks, which the SDK's types do not describe yet.
interface RawResults {
    documents?: {
        pages?: {
            page_num?: number;
            blocks?: {
                text?: string;
                layout_tag?: string;
                reading_order?: number;
                bbox_norm?: number[];
            }[];
        }[];
    }[];
}

/** Reads a photo or PDF with Sarvam Document AI and returns its text as ordered blocks. */
export async function readDocument(file: File): Promise<Block[]> {
    const client = sarvam();
    const job = await client.docAi.digitise({ file: [file], output_format: "md" });

    const deadline = Date.now() + TIMEOUT_MS;
    let status = job.status;
    while (!TERMINAL.includes(status)) {
        if (Date.now() > deadline) throw new Error("Reading the document took too long. Please try again.");
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        status = (await client.docAi.getStatus(job.job_id)).status;
    }
    if (status === "failed" || status === "rejected") {
        throw new Error("The document could not be read. Try a clearer photo or a different file.");
    }

    const results = (await client.docAi.getResults(job.job_id, { format: "json" })) as unknown as RawResults;
    const blocks: Block[] = [];
    for (const doc of results.documents ?? []) {
        for (const page of doc.pages ?? []) {
            const ordered = [...(page.blocks ?? [])].sort((a, b) => (a.reading_order ?? 0) - (b.reading_order ?? 0));
            for (const raw of ordered) {
                const text = tableToText(raw.text ?? "").trim();
                if (!text) continue;
                const box = raw.bbox_norm;
                blocks.push({
                    id: blocks.length + 1,
                    page: page.page_num ?? 1,
                    text,
                    tag: raw.layout_tag ?? "paragraph",
                    bbox: box?.length === 4 ? [box[0], box[1], box[2], box[3]] : null,
                });
            }
        }
    }
    if (blocks.length === 0) throw new Error("No readable text was found in the document.");
    return blocks;
}

/** Tables arrive as HTML; flatten them to one "a | b | c" line per row. */
function tableToText(text: string): string {
    if (!text.includes("<table")) return text;
    return text
        .replace(/<\/t[dh]>\s*<t[dh][^>]*>/g, " | ")
        .replace(/<\/tr>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n");
}

const TIMES = ["morning", "afternoon", "night"];

/** Spells out dose patterns such as 1-0-1, which the model otherwise misreads as "once a day". */
function spellOutSchedules(text: string): string {
    return text.replace(/(?<![\d-])([\d½])-([\d½])-([\d½])(?![\d-])/g, (pattern, ...doses: string[]) => {
        const taken = TIMES.flatMap((time, i) => (doses[i] === "0" ? [] : `${doses[i]} in the ${time}`));
        return `${pattern} [${taken.join(", ") || "none"}]`;
    });
}

/** The document as the model sees it: every block prefixed with the number it can cite. */
export function blocksToPrompt(blocks: Block[]): string {
    return blocks.map((b) => `[${b.id}] ${spellOutSchedules(b.text)}`).join("\n\n");
}

/** Validates blocks sent back by the browser before they go into a prompt. */
export function parseBlocks(value: unknown): Block[] {
    if (!Array.isArray(value) || value.length === 0) throw new Error("The document text is missing.");
    return value.map((b, i) => {
        if (typeof b?.text !== "string") throw new Error("The document text is malformed.");
        return { id: i + 1, page: Number(b.page) || 1, text: b.text.slice(0, 20_000), tag: String(b.tag ?? ""), bbox: null };
    });
}
