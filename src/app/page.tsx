"use client";
import {motion, LayoutGroup, type Transition} from "motion/react";
import {useEffect, useState} from "react";
import AsciiVideo from "@/app/components/AsciiVideo";

const sentence = "Uplift With Uniqueness . Cats Always Touch";
const words = sentence.split(" ");

// ---------------- 缓动 ----------------
const EASE_OUT = [0.16, 1, 0.3, 1] as const;      // easeOutQuint：入场
const EASE_IN_OUT = [0.76, 0, 0.24, 1] as const;  // easeInOutQuart：变形/位移

// ---------------- 节奏（秒） ----------------
const IN_DUR = 0.9;          // 每词入场时长
const IN_STAGGER = 0.08;     // 入场错峰
const HOLD = 1.5;            // 整句停留
const COLLAPSE_DUR = 0.75;   // 非首字母收拢
const COLLAPSE_STAGGER = 0.035;
const GROW_DUR = 0.9;        // UWU.CAT 放大
const TITLE_HOLD = 0.45;     // 大标题停留后飞入方框
const FLY_DUR = 1.05;        // 大标题 → 方框内小标题

const TOTAL_IN = (words.length - 1) * IN_STAGGER + IN_DUR;
const TOTAL_COLLAPSE = (words.length - 1) * COLLAPSE_STAGGER + COLLAPSE_DUR;

type Phase = "in" | "collapse" | "title" | "block";

const TIMELINE: [Phase, number][] = [
    ["collapse", TOTAL_IN + HOLD],
    ["title", TOTAL_IN + HOLD + TOTAL_COLLAPSE - 0.2],
    ["block", TOTAL_IN + HOLD + TOTAL_COLLAPSE - 0.2 + GROW_DUR + TITLE_HOLD],
];

// 按词拆“首字母/其余”，首字母连起来正好是 UWU.CAT
type Split = { pre: string; first: string; post: string };
const splitWord = (w: string): Split => {
    const m = w.match(/[A-Za-z0-9]/);
    if (!m) return {pre: "", first: w.charAt(0), post: w.slice(1)};
    const i = m.index ?? 0;
    return {pre: w.slice(0, i), first: w[i], post: w.slice(i + 1)};
};
const splits = words.map(splitWord);

const LINKS = [
    {label: "X", href: "https://x.com/DaHuangCore"},
    {label: "Github", href: "https://github.com/CtrlcvsNya"},
];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const TITLE = splits.map((s) => s.first).join(""); // "UWU.CAT"

/** 用页面字体在 100px 下实际排一次，返回文字宽度 */
function measureAt100(text: string) {
    const el = document.createElement("span");
    el.textContent = text;
    el.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font-size:100px;font-weight:700;";
    document.body.appendChild(el);
    const width = el.getBoundingClientRect().width;
    el.remove();
    return width;
}

/** 内容块里各元素的统一入场：上浮 + 去模糊 */
const fadeUp = (delay: number) => ({
    initial: {opacity: 0, y: 8, filter: "blur(6px)"},
    animate: {opacity: 1, y: 0, filter: "blur(0px)"},
    transition: {duration: 0.7, ease: EASE_OUT, delay} satisfies Transition,
});

// ---------------- 小组件 ----------------

/** 非首字母部分：宽度收为 0，首字母自然向中间滑拢 */
function Rest({text, idx, collapsed}: { text: string; idx: number; collapsed: boolean }) {
    if (!text) return null;
    return (
        <motion.span
            className="inline-block overflow-hidden whitespace-nowrap align-bottom title-ink"
            initial={{opacity: 0, y: 24, filter: "blur(10px)"}}
            animate={collapsed
                ? {opacity: 0, y: -6, filter: "blur(6px)", width: 0}
                : {opacity: 1, y: 0, filter: "blur(0px)", width: "auto"}}
            transition={collapsed
                ? {duration: COLLAPSE_DUR, ease: EASE_IN_OUT, delay: idx * COLLAPSE_STAGGER}
                : {duration: IN_DUR, ease: EASE_OUT, delay: idx * IN_STAGGER}}
        >
            {text}
        </motion.span>
    );
}

const Logo = () => (
    <svg viewBox="0 0 123 123" aria-hidden="true" fill="currentColor"
         className="w-8 h-8 md:w-10 md:h-10 text-accent drop-shadow-[0_0_12px_rgba(206,255,28,0.45)]">
        <polygon
            points="91.08,49.15 122.88,49.15 122.88,73.73 91.08,73.73 113.58,96.23 96.15,113.58 73.73,91.08 73.73,122.88 49.15,122.88 49.15,91.08 26.64,113.58 9.3,96.23 31.72,73.73 0,73.73 0,49.15 31.72,49.15 9.3,26.73 26.64,9.3 49.15,31.72 49.15,0 73.73,0 73.73,31.72 96.24,9.3 113.58,26.64 91.08,49.15"/>
    </svg>
);

const ArrowIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"
         className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
        <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor" strokeWidth={3}/>
    </svg>
);

/** 方框四角的强调色角标 */
const CORNERS = [
    {cls: "-top-1 -left-1 border-t border-l", from: {x: 8, y: 8}},
    {cls: "-top-1 -right-1 border-t border-r", from: {x: -8, y: 8}},
    {cls: "-bottom-1 -left-1 border-b border-l", from: {x: 8, y: -8}},
    {cls: "-bottom-1 -right-1 border-b border-r", from: {x: -8, y: -8}},
];

// ---------------- 页面 ----------------

export default function Home() {
    const [phase, setPhase] = useState<Phase>("in");
    const [sizes, setSizes] = useState<{ small: number; big: number } | null>(null);

    useEffect(() => {
        let cancelled = false;
        let timers: ReturnType<typeof setTimeout>[] = [];

        // 等字体加载完，按真实字宽算字号，保证整句和 UWU.CAT 在任何屏幕上都不换行
        // 自定义字体是按需加载的，显式 load 一次再量，避免量到回退字体
        const fontsReady = document.fonts
            ? document.fonts.load('700 100px "MyFont"', TITLE).then(() => document.fonts.ready)
            : Promise.resolve();
        fontsReady.catch(() => undefined).then(() => {
            if (cancelled) return;
            const w = window.innerWidth;
            const avail = w - (w >= 640 ? 160 : 32); // 减去 main 的左右 padding（p-4 / sm:p-20）
            setSizes({
                // 整句必须一行放下（换行会在收拢时跳行），手机上会比较小
                small: clamp((avail * 0.94) / (measureAt100(sentence) / 100), 11, 40),
                big: clamp((avail * 0.9) / (measureAt100(TITLE) / 100), 32, 120),
            });
            timers = TIMELINE.map(([p, t]) => setTimeout(() => setPhase(p), t * 1000));
        });
        return () => {
            cancelled = true;
            timers.forEach(clearTimeout);
        };
    }, []);

    const collapsed = phase !== "in";

    return (
        <div className="fixed inset-0 overflow-hidden overscroll-none touch-none select-none">
            {/* 背景：字符视频，方框出现时开始“解码”扫描入场 */}
            <AsciiVideo src="/media/cats-540p.mp4" revealed={phase === "block"} className="fixed inset-0 z-0"/>
            {/* 中心压暗，保证文字可读 */}
            <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0)_55%)]"/>
            {/* CRT 扫描线 + 缓慢滚动的刷新亮带：只盖在背景上，不压住方框和文字 */}
            <div className="scanlines pointer-events-none fixed inset-0 z-[1]"/>
            <div className="crt-roll pointer-events-none fixed inset-x-0 top-0 z-[1] h-[18vh]"/>
            {/* 全屏胶片颗粒 */}
            <div className="grain pointer-events-none fixed inset-0 z-30 opacity-[0.06] mix-blend-overlay"/>

            <main className="relative z-10 grid h-full place-items-center p-4 sm:p-20">
                {sizes && (
                    <LayoutGroup>
                        {phase !== "block" ? (
                            /* 阶段 1~3：整句入场 → 非首字母收拢 → UWU.CAT 放大 */
                            <div
                                className="flex flex-wrap justify-center items-end font-bold"
                                style={{
                                    fontSize: phase === "title" ? sizes.big : sizes.small,
                                    transition: `font-size ${GROW_DUR}s cubic-bezier(${EASE_IN_OUT.join(",")})`,
                                }}
                            >
                                {splits.map(({pre, first, post}, idx) => (
                                    <span key={idx} className="inline-flex items-end leading-[1.25]">
                                        {idx > 0 && (
                                            <motion.span
                                                className="inline-block"
                                                initial={{width: "0.3em"}}
                                                animate={{width: collapsed ? "0em" : "0.3em"}}
                                                transition={{duration: COLLAPSE_DUR, ease: EASE_IN_OUT, delay: idx * COLLAPSE_STAGGER}}
                                            />
                                        )}
                                        <Rest text={pre} idx={idx} collapsed={collapsed}/>
                                        <motion.span
                                            layoutId={`initial-${idx}`}
                                            className="inline-block title-ink"
                                            initial={{opacity: 0, y: 24, filter: "blur(10px)"}}
                                            animate={{opacity: 1, y: 0, filter: "blur(0px)"}}
                                            transition={{duration: IN_DUR, ease: EASE_OUT, delay: idx * IN_STAGGER}}
                                        >
                                            {first}
                                        </motion.span>
                                        <Rest text={post} idx={idx} collapsed={collapsed}/>
                                    </span>
                                ))}
                            </div>
                        ) : (
                            /* 阶段 4：方框展开，大标题飞入成为小标题 */
                            <div className="relative w-full max-w-[40rem]">
                                {/* 玻璃底板：先横向展开成一条线，再纵向打开 */}
                                <motion.div
                                    className="absolute inset-0 overflow-hidden bg-black/70 backdrop-blur-xl ring-1 ring-white/10 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.95)]"
                                    initial={{clipPath: "inset(50% 50% 50% 50%)"}}
                                    animate={{clipPath: ["inset(50% 50% 50% 50%)", "inset(50% 0% 50% 0%)", "inset(0% 0% 0% 0%)"]}}
                                    transition={{duration: 1.0, times: [0, 0.45, 1], ease: EASE_IN_OUT, delay: 0.1}}
                                >
                                    <div className="grain absolute inset-0 opacity-[0.08] mix-blend-overlay"/>
                                    <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,rgba(206,255,28,0.08),transparent_55%)]"/>
                                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"/>
                                    <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"/>
                                    {/* 一次性的光泽扫过 */}
                                    <motion.div
                                        className="absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent"
                                        initial={{left: "-40%"}}
                                        animate={{left: "140%"}}
                                        transition={{duration: 1.3, ease: EASE_IN_OUT, delay: 1.0}}
                                    />
                                </motion.div>

                                {CORNERS.map(({cls, from}, i) => (
                                    <motion.span
                                        key={i}
                                        className={`absolute size-3 border-accent ${cls}`}
                                        initial={{opacity: 0, ...from}}
                                        animate={{opacity: 1, x: 0, y: 0}}
                                        transition={{duration: 0.6, ease: EASE_OUT, delay: 0.9}}
                                    />
                                ))}

                                <div className="relative flex flex-col md:flex-row gap-6 md:gap-8 p-6 md:p-8">
                                    {/* 左：Logo + 标题 + 副标题 */}
                                    <div className="flex flex-col flex-1">
                                        <div className="flex items-center gap-2">
                                            <motion.div
                                                initial={{opacity: 0, scale: 0.4, rotate: -180}}
                                                animate={{opacity: 1, scale: 1, rotate: 0}}
                                                transition={{type: "spring", stiffness: 140, damping: 16, delay: 0.85}}
                                                whileHover={{rotate: 90}}
                                            >
                                                <Logo/>
                                            </motion.div>
                                            <span className="inline-flex text-3xl md:text-4xl font-bold leading-[1.25] tracking-[0.02em]">
                                                {splits.map(({first}, idx) => (
                                                    <motion.span
                                                        key={idx}
                                                        layoutId={`initial-${idx}`}
                                                        className="inline-block title-ink"
                                                        transition={{layout: {duration: FLY_DUR, ease: EASE_IN_OUT}}}
                                                    >
                                                        {first}
                                                    </motion.span>
                                                ))}
                                            </span>
                                        </div>
                                        <motion.p
                                            className="mt-2 pl-10 md:pl-12 font-mono text-[11px] leading-relaxed tracking-wide text-white/50"
                                            {...fadeUp(1.0)}
                                        >
                                            In a cat’s eyes, all things belong to dreams.
                                        </motion.p>
                                    </div>

                                    {/* 分隔线 */}
                                    <motion.div
                                        className="hidden md:block w-px self-stretch origin-top bg-gradient-to-b from-transparent via-white/20 to-transparent"
                                        initial={{scaleY: 0}}
                                        animate={{scaleY: 1}}
                                        transition={{duration: 0.8, ease: EASE_IN_OUT, delay: 0.95}}
                                    />

                                    {/* 右：链接 / 版权 */}
                                    <div className="flex flex-col md:items-end gap-1.5 md:min-w-[9rem]">
                                        {LINKS.map(({label, href}, i) => (
                                            <motion.a
                                                key={label}
                                                href={href}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="group relative inline-flex items-center gap-1.5 self-start md:self-end font-mono text-xs uppercase tracking-[0.18em] text-white/85 transition-colors hover:text-accent after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-full after:origin-right after:scale-x-0 after:bg-accent after:transition-transform after:duration-300 hover:after:origin-left hover:after:scale-x-100"
                                                {...fadeUp(1.1 + i * 0.08)}
                                            >
                                                {label}
                                                <ArrowIcon/>
                                            </motion.a>
                                        ))}
                                        <div className="flex-1 min-h-3"/>
                                        <motion.p
                                            className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.16em] text-white/35 md:text-right"
                                            {...fadeUp(1.3)}
                                        >
                                            © Ctrlcvs
                                            <br/>
                                            not for sale, AI last.
                                        </motion.p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </LayoutGroup>
                )}
            </main>
        </div>
    );
}
