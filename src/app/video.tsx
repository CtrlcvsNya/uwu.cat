 

"use client"
import React, { useEffect, useRef, useState } from "react";

/**
 * AsciiCanvas256.tsx
 * ------------------------------------------------------------
 * Render an MP4 as ASCII *with color*. Each character cell is colored using
 * an 8‑bit (xterm‑256) palette or full 24‑bit RGB. Defaults to xterm‑256.
 *
 * Usage:
 *   <AsciiCanvas256 src="/videos/demo.mp4" autoPlay loop muted overlay
 *                   fps={30} palette="xterm256" cellBg cellBgAlpha={0.85} />
 */

type RGB = [number, number, number];

// xterm cube levels and ANSI 16 colors
const LV = [0, 95, 135, 175, 215, 255];
const ANSI16: RGB[] = [
    [0, 0, 0], [128, 0, 0], [0, 128, 0], [128, 128, 0],
    [0, 0, 128], [128, 0, 128], [0, 128, 128], [192, 192, 192],
    [128, 128, 128], [255, 0, 0], [0, 255, 0], [255, 255, 0],
    [0, 0, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255],
];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const toHex2 = (n: number) => n.toString(16).padStart(2, "0");
const rgbToHex = (r: number, g: number, b: number) => `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;

const nearestLevelIndex = (v: number) => {
    let idx = 0; let best = 1e9;
    for (let i = 0; i < 6; i++) { const d = Math.abs(v - LV[i]); if (d < best) { best = d; idx = i; } }
    return idx;
};

const rgbToXtermIndex = (r: number, g: number, b: number) => {
    const ri = nearestLevelIndex(r), gi = nearestLevelIndex(g), bi = nearestLevelIndex(b);
    const rc = LV[ri], gc = LV[gi], bc = LV[bi];
    const cubeIdx = 16 + 36 * ri + 6 * gi + bi;
    const dc = (r - rc) ** 2 + (g - gc) ** 2 + (b - bc) ** 2;

    const grayIdx = clamp(232 + Math.round(((r + g + b) / 3 - 8) / 10), 232, 255);
    const gv = clamp(8 + 10 * (grayIdx - 232), 8, 238);
    const dg = (r - gv) ** 2 + (g - gv) ** 2 + (b - gv) ** 2;

    let ansiIdx = 0, da = 1e12;
    for (let i = 0; i < 16; i++) {
        const [ar, ag, ab] = ANSI16[i];
        const d = (r - ar) ** 2 + (g - ag) ** 2 + (b - ab) ** 2;
        if (d < da) { da = d; ansiIdx = i; }
    }

    if (da <= dc && da <= dg) return ansiIdx;
    return dg < dc ? grayIdx : cubeIdx;
};

const xtermIndexToRGB = (idx: number): RGB => {
    if (idx < 16) return ANSI16[idx];
    if (idx >= 232) { const v = clamp(8 + 10 * (idx - 232), 8, 238); return [v, v, v]; }
    const i = idx - 16; const ri = Math.floor(i / 36); const gi = Math.floor((i % 36) / 6); const bi = i % 6;
    return [LV[ri], LV[gi], LV[bi]];
};

const pickContrastingText = (r: number, g: number, b: number) => {
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return y < 140 ? "#ffffff" : "#000000";
};

// Props
export type PaletteMode = 'xterm256' | 'rgb24' | 'mono';

type Props = {
    src: string;
    overlay?: boolean;
    autoPlay?: boolean;
    loop?: boolean;
    muted?: boolean;
    fps?: number;
    charset?: string;      // ASCII ramp (light -> dark)
    color?: string;        // text color in mono mode
    background?: string;   // canvas background
    scanlines?: boolean;   // CRT-like scanlines
    charW?: number;        // visual char width (px)
    charH?: number;        // visual char height (px)
    fontFamily?: string;
    startAt?: number;
    palette?: PaletteMode; // 'xterm256' (8-bit) | 'rgb24' | 'mono'
    cellBg?: boolean;      // fill each cell background with its color
    cellBgAlpha?: number;  // 0..1 alpha for cellBg
    className?: string;
    style?: React.CSSProperties;
};

const DEFAULTS = {
    fps: 30,
    charset: " .:-=+*#%@",
    color: "#ceff1c",
    background: "#000000",
    scanlines: false,
    charW: 8,
    charH: 16,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    palette: 'xterm256' as PaletteMode,
    cellBg: false,
    cellBgAlpha: 0.85,
};

export default function AsciiCanvas256({
                                           src,
                                           overlay = true,
                                           autoPlay = false,
                                           loop = false,
                                           muted = true,
                                           fps = DEFAULTS.fps,
                                           charset = DEFAULTS.charset,
                                           color = DEFAULTS.color,
                                           background = DEFAULTS.background,
                                           scanlines = DEFAULTS.scanlines,
                                           charW = DEFAULTS.charW,
                                           charH = DEFAULTS.charH,
                                           fontFamily = DEFAULTS.fontFamily,
                                           startAt,
                                           palette = DEFAULTS.palette,
                                           cellBg = DEFAULTS.cellBg,
                                           cellBgAlpha = DEFAULTS.cellBgAlpha,
                                           className,
                                           style,
                                       }: Props) {
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const workRef = useRef<HTMLCanvasElement | null>(null);

    const [meta, setMeta] = useState<{ w: number; h: number; dur: number }>();

    // animation handles
    const rVFCHandle = useRef<number | null>(null);
    const rafHandle = useRef<number | null>(null);

    const resizeCanvasToVideo = () => {
        const v = videoRef.current, c = canvasRef.current; if (!v || !c) return;
        const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
        c.width = v.videoWidth * dpr; c.height = v.videoHeight * dpr;
        c.style.width = `${v.videoWidth}px`; c.style.height = `${v.videoHeight}px`;
    };

    const drawAsciiColor = () => {
        const v = videoRef.current, c = canvasRef.current, work = workRef.current;
        if (!v || !c || !work) return;
        const ctx = c.getContext("2d", { alpha: false });
        const wctx = work.getContext("2d", { willReadFrequently: true });
        if (!ctx || !wctx) return;

        const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
        const targetW = c.width, targetH = c.height;
        const cols = Math.max(1, Math.floor(targetW / (charW * dpr)));
        const rows = Math.max(1, Math.floor(targetH / (charH * dpr)));

        work.width = cols; work.height = rows;
        wctx.drawImage(v, 0, 0, cols, rows);
        const img = wctx.getImageData(0, 0, cols, rows); const data = img.data;

        ctx.fillStyle = background; ctx.fillRect(0, 0, targetW, targetH);
        ctx.textBaseline = "top"; ctx.font = `${charH * dpr}px ${fontFamily}`;

        const ramp = charset; const last = ramp.length - 1;
        const stepX = charW * dpr; const stepY = charH * dpr;

        for (let y = 0; y < rows; y++) {
            let runStr = ""; let runHex = ""; let runStartX = 0; let runTextHex = "";

            for (let x = 0; x < cols; x++) {
                const i = (y * cols + x) * 4;
                const r = data[i], g = data[i + 1], b = data[i + 2];

                // char by luminance (invert so darker → denser)
                const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                const ci = clamp(Math.round((luma / 255) * last), 0, last);
                const ch = ramp[last - ci];

                // color selection
                let cellHex = color; let tr = r, tg = g, tb = b;
                if (palette === 'xterm256') {
                    const idx = rgbToXtermIndex(r, g, b);
                    [tr, tg, tb] = xtermIndexToRGB(idx);
                    cellHex = rgbToHex(tr, tg, tb);
                } else if (palette === 'rgb24') {
                    cellHex = rgbToHex(r, g, b);
                } // mono uses provided `color`

                const textHex = cellBg ? pickContrastingText(tr, tg, tb) : cellHex;

                if (cellBg) {
                    ctx.globalAlpha = clamp(cellBgAlpha, 0, 1);
                    ctx.fillStyle = cellHex;
                    ctx.fillRect(x * stepX, y * stepY, stepX, stepY);
                    ctx.globalAlpha = 1;
                }

                if (!runStr) {
                    runStr = ch; runHex = cellHex; runTextHex = textHex; runStartX = x;
                } else if (cellHex === runHex && textHex === runTextHex) {
                    runStr += ch;
                } else {
                    ctx.fillStyle = runTextHex;
                    ctx.fillText(runStr, runStartX * stepX, y * stepY);
                    runStr = ch; runHex = cellHex; runTextHex = textHex; runStartX = x;
                }
            }

            if (runStr) { ctx.fillStyle = runTextHex; ctx.fillText(runStr, runStartX * stepX, y * stepY); }
            if (scanlines) { ctx.fillStyle = "rgba(0,0,0,0.75)"; const dpr1 = Math.max(1, Math.floor(1 * dpr)); ctx.fillRect(0, (y + 1) * stepY - dpr1, targetW, dpr1); }
        }
    };

    // frame driving
    useEffect(() => {
        const v = videoRef.current; if (!v) return;
        let lastTs = 0; const frameInterval = 1 / Math.max(1, fps);

        const onRVFC = (_now: number, meta: VideoFrameCallbackMetadata) => {
            // resubscribe first to keep loop alive across boundary
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rVFCHandle.current = (v as any).requestVideoFrameCallback(onRVFC);
            if (!v) return;
            if (meta.mediaTime + 1e-6 < lastTs) lastTs = 0; // loop wrap
            if (!v.paused && !v.ended) {
                if (meta.mediaTime - lastTs >= frameInterval - 1e-3) {
                    lastTs = meta.mediaTime; drawAsciiColor();
                }
            }
        };

        const onRAF = () => {
            if (v) {
                const t = v.currentTime || 0; if (t + 1e-6 < lastTs) lastTs = 0;
                if (!v.paused && !v.ended) { if (t - lastTs >= frameInterval - 1e-3) { lastTs = t; drawAsciiColor(); } }
            }
            rafHandle.current = requestAnimationFrame(onRAF);
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((v as any).requestVideoFrameCallback) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rVFCHandle.current = (v as any).requestVideoFrameCallback(onRVFC);
        } else {
            rafHandle.current = requestAnimationFrame(onRAF);
        }

        return () => {
            if (rVFCHandle.current != null) { (v).cancelVideoFrameCallback?.(rVFCHandle.current); rVFCHandle.current = null; }
            if (rafHandle.current != null) { cancelAnimationFrame(rafHandle.current); rafHandle.current = null; }
        };
    }, [fps, charset, background, scanlines, charW, charH, fontFamily, palette, cellBg, cellBgAlpha]);

    // meta + sizing
    useEffect(() => {
        const v = videoRef.current, c = canvasRef.current, w = workRef.current; if (!v || !c || !w) return;

        const onLoaded = () => {
            const w0 = v.videoWidth, h0 = v.videoHeight; setMeta({ w: w0, h: h0, dur: v.duration || 0 });
            resizeCanvasToVideo();
            if (typeof startAt === "number" && isFinite(startAt)) { try { v.currentTime = Math.max(0, Math.min(v.duration || 0, startAt)); } catch {} }
            if (autoPlay) { v.play().catch(() => {}); }
            drawAsciiColor();
        };

        const onResize = () => resizeCanvasToVideo();
        v.addEventListener("loadedmetadata", onLoaded);
        window.addEventListener("resize", onResize);
        if (v.readyState >= 1) onLoaded();

        return () => { v.removeEventListener("loadedmetadata", onLoaded); window.removeEventListener("resize", onResize); };
    }, [src, autoPlay, startAt]);

    return (
        <div ref={wrapRef} className={className} style={{ position: "relative", display: "inline-block", ...style }}>
            <video
                ref={videoRef}
                src={src}
                muted={muted}
                loop={loop}
                playsInline
                style={{ display: overlay ? "block" : "none", width: meta?.w ?? undefined, height: meta?.h ?? undefined }}
                controls={!overlay}
            />

            <canvas
                ref={canvasRef}
                style={{ position: overlay ? "absolute" : "relative", top: 0, left: 0, pointerEvents: "none", imageRendering: "pixelated", width: meta?.w ?? undefined, height: meta?.h ?? undefined }}
            />

            <canvas ref={workRef} style={{ display: "none" }} />

            {meta && (
                <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
                    {Math.round(meta.w)}×{Math.round(meta.h)} • {Math.round(meta.dur)}s • fps≤{fps} • {palette}
                </div>
            )}
        </div>
    );
}
