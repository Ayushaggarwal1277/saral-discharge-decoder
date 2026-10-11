import { SarvamAIClient, SarvamAIError } from "sarvamai";
import type { SarvamAI } from "sarvamai";

let client: SarvamAIClient | undefined;

export function sarvam(): SarvamAIClient {
    if (!client) {
        const apiKey = process.env.SARVAM_API_KEY;
        if (!apiKey) throw new Error("SARVAM_API_KEY is not set. Add it to .env and restart.");
        client = new SarvamAIClient({ apiSubscriptionKey: apiKey });
    }
    return client;
}

/** Runs a chat completion in JSON mode and returns the parsed object. The prompt must describe the shape. */
export async function chatJson(opts: {
    model: SarvamAI.SarvamModelIds;
    system: string;
    user: string;
    maxTokens: number;
}): Promise<Record<string, unknown>> {
    const response = await sarvam().chat.completions({
        model: opts.model,
        messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
        ],
        temperature: 0.2,
        max_tokens: opts.maxTokens,
        // Reasoning is on by default and can use up the whole token budget before any answer appears.
        // Only an explicit null turns it off, which the SDK's type does not allow for.
        reasoning_effort: null as unknown as undefined,
        response_format: { type: "json_object" },
    });
    const choice = response.choices[0];
    const content = choice?.message.content;
    if (!content) throw new Error(`The model returned no content (finish_reason: ${choice?.finish_reason}).`);
    if (choice.finish_reason === "length") throw new Error("The model's answer was cut off before it finished.");
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("The model's answer was not in the expected format.");
    }
    return parsed as Record<string, unknown>;
}

/** Turns any thrown value into a JSON error response, keeping Sarvam's status code when there is one. */
export function errorResponse(err: unknown): Response {
    console.error(err);
    if (err instanceof SarvamAIError) {
        const body = err.body as { error?: { message?: string }; message?: string } | undefined;
        const message = body?.error?.message ?? body?.message ?? err.message;
        return Response.json({ error: message }, { status: err.statusCode ?? 502 });
    }
    return Response.json({ error: err instanceof Error ? err.message : "Something went wrong." }, { status: 500 });
}
