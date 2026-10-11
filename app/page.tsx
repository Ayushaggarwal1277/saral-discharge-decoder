"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { AskPanel } from "@/components/AskPanel";
import { DocumentPanel } from "@/components/DocumentPanel";
import { Explanation } from "@/components/Explanation";
import { UploadIcon } from "@/components/icons";
import { ENGLISH_LABELS, HINDI_LABELS, type Labels } from "@/lib/labels";
import { LANGUAGES, type LanguageCode } from "@/lib/languages";
import type { Block, Details, Summary } from "@/lib/types";
import { useSpeech } from "@/lib/useSpeech";

const SAMPLE = { url: "/samples/discharge-summary.png", name: "discharge-summary.png", type: "image/png" };

interface LoadedDocument {
    imageUrl: string | null;
    blocks: Block[];
}

type Stage = "idle" | "reading" | "explaining" | "ready";

async function postJson<T>(url: string, body: unknown): Promise<T> {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Something went wrong.");
    return data as T;
}

const message = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong.");

export default function Home() {
    const [language, setLanguage] = useState<LanguageCode>("hi-IN");
    const [labels, setLabels] = useState<Labels>(HINDI_LABELS);
    const [stage, setStage] = useState<Stage>("idle");
    const [doc, setDoc] = useState<LoadedDocument | null>(null);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [details, setDetails] = useState<Details | null>(null);
    const [detailsPending, setDetailsPending] = useState(false);
    const [highlight, setHighlight] = useState<number[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    // Bumped whenever a new document or language is chosen, so answers to older requests are dropped.
    const request = useRef(0);

    const speech = useSpeech(language, setError);
    const { play, stop } = speech;

    useEffect(() => {
        let cancelled = false;
        if (language === "en-IN") setLabels(ENGLISH_LABELS);
        else if (language === "hi-IN") setLabels(HINDI_LABELS);
        else {
            fetch(`/api/labels?language=${language}`)
                .then((response) => (response.ok ? response.json() : ENGLISH_LABELS))
                .then((translated: Labels) => !cancelled && setLabels(translated))
                .catch(() => !cancelled && setLabels(ENGLISH_LABELS));
        }
        return () => {
            cancelled = true;
        };
    }, [language]);

    const explain = useCallback(
        async (blocks: Block[], code: LanguageCode) => {
            const mine = ++request.current;
            stop();
            setStage("explaining");
            setSummary(null);
            setDetails(null);
            setHighlight([]);
            setError(null);

            const text = blocks.map(({ page, text, tag }) => ({ page, text, tag }));
            const wantDetails = postJson<Details>("/api/explain", { part: "details", language: code, blocks: text });
            // Attach a handler now so a details failure during the summary wait is not an unhandled rejection.
            wantDetails.catch(() => {});
            let summaryShown = false;
            setDetailsPending(true);
            try {
                const ready = await postJson<Summary>("/api/explain", { part: "summary", language: code, blocks: text });
                if (request.current !== mine) return;
                setSummary(ready);
                setStage("ready");
                summaryShown = true;
                void play("narration", ready.narration);

                const rest = await wantDetails;
                if (request.current !== mine) return;
                setDetails(rest);
                setDetailsPending(false);
            } catch (err) {
                if (request.current !== mine) return;
                setError(message(err));
                setDetailsPending(false);
                // If only the details failed, the summary is already on screen and stays there.
                if (!summaryShown) {
                    setStage("idle");
                    setDoc(null);
                }
            }
        },
        [play, stop],
    );

    const open = useCallback(
        async (file: File) => {
            const mine = ++request.current;
            stop();
            setError(null);
            setSummary(null);
            setDetails(null);
            setHighlight([]);
            setDoc(null);
            setStage("reading");
            try {
                const form = new FormData();
                form.set("file", file);
                const response = await fetch("/api/read", { method: "POST", body: form });
                const body = await response.json();
                if (!response.ok) throw new Error(body.error ?? "The document could not be read.");
                if (request.current !== mine) return;

                const blocks: Block[] = body.blocks;
                setDoc({ imageUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null, blocks });
                await explain(blocks, language);
            } catch (err) {
                if (request.current !== mine) return;
                setError(message(err));
                setStage("idle");
            }
        },
        [explain, language, stop],
    );

    async function openSample() {
        try {
            const blob = await (await fetch(SAMPLE.url)).blob();
            await open(new File([blob], SAMPLE.name, { type: SAMPLE.type }));
        } catch (err) {
            setError(message(err));
        }
    }

    function chooseLanguage(code: LanguageCode) {
        setLanguage(code);
        if (doc && stage !== "reading") void explain(doc.blocks, code);
    }

    function onFile(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void open(file);
    }

    function onDrop(event: DragEvent) {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) void open(file);
    }

    function reset() {
        request.current++;
        stop();
        setStage("idle");
        setDoc(null);
        setSummary(null);
        setDetails(null);
        setHighlight([]);
        setError(null);
    }

    const languageName = LANGUAGES.find((l) => l.code === language)!.native;

    return (
        <div className="app">
            <header className="top">
                <button className="brand" onClick={reset}>
                    <span className="brand-mark">स</span>
                    <span>
                        <strong>Saral</strong>
                        <small>Hospital papers, explained aloud</small>
                    </span>
                </button>
                <div className="top-actions">
                    <select value={language} onChange={(event) => chooseLanguage(event.target.value as LanguageCode)} aria-label="Language">
                        {LANGUAGES.map((l) => (
                            <option key={l.code} value={l.code}>
                                {l.native}
                                {l.native === l.name ? "" : ` (${l.name})`}
                            </option>
                        ))}
                    </select>
                    {stage !== "idle" && (
                        <button className="small-button" onClick={reset}>
                            New document
                        </button>
                    )}
                </div>
            </header>

            {error && (
                <p className="error" role="alert">
                    {error}
                    <button onClick={() => setError(null)} aria-label="Dismiss">
                        ×
                    </button>
                </p>
            )}

            {stage === "idle" && (
                <main className="landing">
                    <h1>Understand your discharge summary in your own language</h1>
                    <p className="lead">
                        Take a photo of the paper the hospital gave you. Saral reads it, explains it in simple words, reads it
                        aloud, and answers your questions.
                    </p>

                    <div className="language-chips" role="radiogroup" aria-label="Language">
                        {LANGUAGES.map((l) => (
                            <button
                                key={l.code}
                                role="radio"
                                aria-checked={l.code === language}
                                className={l.code === language ? "chip on" : "chip"}
                                onClick={() => chooseLanguage(l.code)}
                            >
                                {l.native}
                            </button>
                        ))}
                    </div>

                    <label
                        className={dragging ? "dropzone dragging" : "dropzone"}
                        onDragOver={(event) => {
                            event.preventDefault();
                            setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={onDrop}
                    >
                        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={onFile} />
                        <UploadIcon size={32} />
                        <strong>Upload a photo or PDF</strong>
                        <span>Discharge summary or insurance letter. JPG, PNG or PDF.</span>
                    </label>

                    <button className="sample" onClick={() => void openSample()}>
                        No document handy? Try a sample discharge summary
                    </button>

                    <ol className="steps">
                        <li>
                            <strong>Reads</strong> the paper, even scanned or photographed
                        </li>
                        <li>
                            <strong>Explains</strong> the medicines, care and next visits in {languageName}
                        </li>
                        <li>
                            <strong>Speaks</strong> it aloud and answers your questions
                        </li>
                    </ol>
                    <p className="disclaimer">{ENGLISH_LABELS.disclaimer}</p>
                </main>
            )}

            {(stage === "reading" || stage === "explaining") && (
                <main className="working">
                    <span className="spinner large" />
                    <ol>
                        <li className={stage === "reading" ? "active" : "done"}>Reading your document</li>
                        <li className={stage === "explaining" ? "active" : ""}>Explaining it in {languageName}</li>
                    </ol>
                </main>
            )}

            {stage === "ready" && doc && summary && (
                <main className="result">
                    <DocumentPanel title={labels.yourDocument} imageUrl={doc.imageUrl} blocks={doc.blocks} highlight={highlight} />
                    <div className="result-main">
                        <Explanation
                            summary={summary}
                            details={details}
                            detailsPending={detailsPending}
                            labels={labels}
                            locale={language}
                            speech={speech}
                            onSource={setHighlight}
                        />
                        <AskPanel
                            key={`${language}-${doc.blocks.length}`}
                            blocks={doc.blocks}
                            language={language}
                            labels={labels}
                            speech={speech}
                            onSource={setHighlight}
                            onError={setError}
                        />
                        <p className="disclaimer">{labels.disclaimer}</p>
                    </div>
                </main>
            )}
        </div>
    );
}
