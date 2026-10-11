"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface Speech {
    /** Id of the item being loaded or played, if any. */
    activeId: string | null;
    status: "idle" | "loading" | "playing";
    /** 0..1 through the audio that is playing. */
    progress: number;
    toggle: (id: string, text: string) => void;
    play: (id: string, text: string) => Promise<void>;
    stop: () => void;
}

/** Plays one piece of text at a time through Bulbul, caching audio so replays are instant. */
export function useSpeech(language: string, onError: (message: string) => void): Speech {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [status, setStatus] = useState<Speech["status"]>("idle");
    const [progress, setProgress] = useState(0);
    const audio = useRef<HTMLAudioElement | null>(null);
    const cache = useRef(new Map<string, string>());
    // Bumped on every play and stop, so a slow response for an abandoned request is ignored.
    const current = useRef(0);

    const stop = useCallback(() => {
        current.current++;
        audio.current?.pause();
        setActiveId(null);
        setStatus("idle");
        setProgress(0);
    }, []);

    const play = useCallback(
        async (id: string, text: string) => {
            stop();
            const mine = ++current.current;
            setActiveId(id);
            setStatus("loading");
            try {
                const key = `${language}|${text}`;
                let url = cache.current.get(key);
                if (!url) {
                    const response = await fetch("/api/speak", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ text, language }),
                    });
                    if (!response.ok) throw new Error((await response.json()).error ?? "Could not create the audio.");
                    url = URL.createObjectURL(await response.blob());
                    cache.current.set(key, url);
                }
                if (current.current !== mine) return;

                const player = (audio.current ??= new Audio());
                player.src = url;
                player.ontimeupdate = () => {
                    if (current.current === mine && player.duration) setProgress(player.currentTime / player.duration);
                };
                player.onended = () => {
                    if (current.current === mine) stop();
                };
                await player.play();
                if (current.current === mine) setStatus("playing");
            } catch (err) {
                if (current.current !== mine) return;
                stop();
                // Browsers refuse to start audio without a click; the play button is still there for that.
                if (!(err instanceof DOMException && err.name === "NotAllowedError")) {
                    onError(err instanceof Error ? err.message : "Could not play the audio.");
                }
            }
        },
        [language, onError, stop],
    );

    const toggle = useCallback(
        (id: string, text: string) => {
            if (activeId === id) stop();
            else void play(id, text);
        },
        [activeId, play, stop],
    );

    useEffect(() => stop, [language, stop]);

    return { activeId, status, progress, toggle, play, stop };
}
