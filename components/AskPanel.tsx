"use client";

import { useEffect, useRef, useState, type SubmitEvent } from "react";
import type { Labels } from "@/lib/labels";
import type { Block } from "@/lib/types";
import type { Speech } from "@/lib/useSpeech";
import { LocateIcon, MicIcon, SpeakerIcon, StopIcon } from "./icons";

// Sarvam's instant speech-to-text accepts up to 30 seconds of audio.
const MAX_RECORDING_MS = 25_000;

interface Turn {
    question: string;
    answer: string;
    sources: number[];
}

interface Props {
    blocks: Block[];
    language: string;
    labels: Labels;
    speech: Speech;
    onSource: (ids: number[]) => void;
    onError: (message: string) => void;
}

/** Lets the reader ask about their document by voice or by typing, and speaks the answer. */
export function AskPanel({ blocks, language, labels, speech, onSource, onError }: Props) {
    const [turns, setTurns] = useState<Turn[]>([]);
    const [typed, setTyped] = useState("");
    const [busy, setBusy] = useState(false);
    const [recording, setRecording] = useState(false);
    const recorder = useRef<MediaRecorder | null>(null);

    useEffect(() => () => recorder.current?.stream.getTracks().forEach((track) => track.stop()), []);

    async function ask(input: { question: string } | { audio: Blob }) {
        setBusy(true);
        try {
            const form = new FormData();
            form.set("language", language);
            form.set("blocks", JSON.stringify(blocks.map(({ page, text, tag }) => ({ page, text, tag }))));
            form.set("history", JSON.stringify(turns.map(({ question, answer }) => ({ question, answer }))));
            if ("audio" in input) form.set("audio", input.audio, "question.webm");
            else form.set("question", input.question);

            const response = await fetch("/api/ask", { method: "POST", body: form });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error ?? "Could not answer the question.");

            const turn: Turn = { question: body.question, answer: body.answer, sources: body.sources ?? [] };
            setTurns((previous) => [...previous, turn]);
            if (turn.sources.length > 0) onSource(turn.sources);
            void speech.play(`answer-${turns.length}`, turn.answer);
        } catch (err) {
            onError(err instanceof Error ? err.message : "Could not answer the question.");
        } finally {
            setBusy(false);
        }
    }

    async function startRecording() {
        speech.stop();
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            onError("The microphone is not available. Allow microphone access, or type your question.");
            return;
        }
        const chunks: Blob[] = [];
        const active = new MediaRecorder(stream);
        const limit = setTimeout(() => active.state === "recording" && active.stop(), MAX_RECORDING_MS);
        active.ondataavailable = (event) => chunks.push(event.data);
        active.onstop = () => {
            clearTimeout(limit);
            stream.getTracks().forEach((track) => track.stop());
            setRecording(false);
            const audio = new Blob(chunks, { type: active.mimeType });
            if (audio.size > 0) void ask({ audio });
        };
        active.start();
        recorder.current = active;
        setRecording(true);
    }

    function submit(event: SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        const question = typed.trim();
        if (!question || busy) return;
        setTyped("");
        void ask({ question });
    }

    return (
        <section className="card ask">
            <header className="card-head">
                <h2>{labels.ask}</h2>
            </header>

            {turns.map((turn, i) => {
                const id = `answer-${i}`;
                return (
                    <div key={i} className="turn">
                        <p className="question">{turn.question}</p>
                        <div className="answer">
                            <p>{turn.answer}</p>
                            <div className="answer-actions">
                                <button
                                    className="icon-button"
                                    onClick={() => speech.toggle(id, turn.answer)}
                                    aria-label={speech.activeId === id ? labels.stop : labels.readAloud}
                                >
                                    {speech.activeId === id ? <StopIcon size={18} /> : <SpeakerIcon size={18} />}
                                </button>
                                {turn.sources.length > 0 && (
                                    <button className="icon-button" onClick={() => onSource(turn.sources)} aria-label={labels.showSource}>
                                        <LocateIcon size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}

            {busy && (
                <p className="thinking">
                    <span className="spinner" /> {labels.thinking}
                </p>
            )}

            <div className="ask-controls">
                <button
                    className={recording ? "mic recording" : "mic"}
                    onClick={() => (recording ? recorder.current?.stop() : void startRecording())}
                    disabled={busy}
                >
                    {recording ? <StopIcon size={22} /> : <MicIcon size={22} />}
                    <span>{recording ? labels.tapToStop : labels.tapToSpeak}</span>
                </button>
                <form onSubmit={submit}>
                    <input
                        value={typed}
                        onChange={(event) => setTyped(event.target.value)}
                        placeholder={labels.askPlaceholder}
                        aria-label={labels.askPlaceholder}
                        disabled={busy || recording}
                    />
                    <button className="small-button" disabled={busy || recording || !typed.trim()}>
                        {labels.send}
                    </button>
                </form>
            </div>
        </section>
    );
}
