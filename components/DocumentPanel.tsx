"use client";

import { useEffect, useRef } from "react";
import type { Block } from "@/lib/types";

interface Props {
    title: string;
    /** Set when the upload was a photo; PDFs are shown as the text that was read from them. */
    imageUrl: string | null;
    blocks: Block[];
    /** Block ids the reader asked to see the source of. */
    highlight: number[];
}

/** Shows the original document and marks the parts an explanation item was taken from. */
export function DocumentPanel({ title, imageUrl, blocks, highlight }: Props) {
    const firstMark = useRef<HTMLElement | null>(null);
    const setFirstMark = (element: HTMLElement | null) => {
        firstMark.current = element;
    };
    const marked = new Set(highlight);
    const first = highlight[0];

    useEffect(() => {
        firstMark.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [highlight]);

    return (
        <aside className="doc">
            <h2 className="doc-title">{title}</h2>
            <div className="doc-scroll">
                {imageUrl ? (
                    <div className="doc-page">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl} alt={title} />
                        {blocks
                            .filter((block) => marked.has(block.id) && block.bbox)
                            .map((block) => {
                                const [x1, y1, x2, y2] = block.bbox!;
                                return (
                                    <span
                                        key={block.id}
                                        ref={block.id === first ? setFirstMark : undefined}
                                        className="doc-mark"
                                        style={{
                                            left: `${x1 * 100}%`,
                                            top: `${y1 * 100}%`,
                                            width: `${(x2 - x1) * 100}%`,
                                            height: `${(y2 - y1) * 100}%`,
                                        }}
                                    />
                                );
                            })}
                    </div>
                ) : (
                    <div className="doc-text">
                        {blocks.map((block) => (
                            <p
                                key={block.id}
                                ref={block.id === first ? setFirstMark : undefined}
                                className={marked.has(block.id) ? "doc-block marked" : "doc-block"}
                            >
                                {block.text}
                            </p>
                        ))}
                    </div>
                )}
            </div>
        </aside>
    );
}
