import { SarvamAIClient } from "sarvamai";

const apiKey = process.env.SARVAM_API_KEY;
if (!apiKey) {
    console.error("SARVAM_API_KEY is not set. Paste your key into .env first.");
    process.exit(1);
}

const client = new SarvamAIClient({ apiSubscriptionKey: apiKey });

const response = await client.chat.completions({
    model: "sarvam-105b-conversations",
    messages: [{ role: "user", content: "Say hello and introduce yourself in one sentence." }],
});

console.log(response.choices[0].message.content);
