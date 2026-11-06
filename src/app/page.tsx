"use client";
import {motion, AnimatePresence, LayoutGroup, useReducedMotion, type Transition} from "motion/react";
import {useEffect, useState} from "react";
import AsciiVideo from "@/app/components/AsciiVideo";

const sentence = "Uplift With Uniqueness . Cats Always Touch";
const words = sentence.split(" ");

// 进入页面时先用其它语言把这句话快速“翻”一遍，最后落在英文上再继续
// 自定义字体（Grotesk Remix）只有拉丁字符，日/中/俄用风格、字重相近的开源字体，
// 只截取了这几句用到的字（public/fonts/intro-*.woff2，见 globals.css）。改文案时要重新截取：
//   https://fonts.googleapis.com/css2?family=<字体>&text=<新文案>
const LANGS = [
    {
        lang: "ja",
        text: "個性が心を高める , 猫はいつも心に触れる",
        font: '"IntroJA", "Hiragino Sans", "Yu Gothic", sans-serif',
    },
    {
        lang: "zh-CN",
        text: "独特不凡 , 猫猫触动人心",
        font: '"IntroZH", "PingFang SC", "Microsoft YaHei", sans-serif',
    },
    {
        lang: "ru",
        text: "Уникальность возвышает . Кошки всегда трогают",
        font: '"IntroRU", "Segoe UI", Arial, sans-serif',
    },
    {
        lang: "fr",
        text: "L’unicité élève . Les chats touchent toujours",
        font: '"MyFont", sans-serif',
    },
];

// ---------------- 缓动 ----------------
const EASE_OUT = [0.16, 1, 0.3, 1] as const;      // easeOutQuint：入场
const EASE_IN_OUT = [0.76, 0, 0.24, 1] as const;  // easeInOutQuart：变形/位移

// ---------------- 节奏（秒） ----------------
const LANG_FIRST = 0.8;      // 第一种语言多停一会儿，让视线先落定
const LANG_STEP = 0.5;       // 之后每种语言停留（约 2 次/秒，够认出是哪种语言又不晃眼）
const LANG_IN = 0.3;         // 切入：去模糊 + 轻微上浮
const LANG_OUT = 0.2;        // 切出：比切入更快，两者交叠成“闪切”
const LANG_TOTAL = LANG_FIRST + (LANGS.length - 1) * LANG_STEP; // 何时落到英文
// 英文和前面几种语言用同一种“整句切入”，只是稍慢一点，读起来像落地而不是重新开始
const IN_DUR = 0.45;         // 英文切入时长
const IN_STAGGER = 0;        // 整句一起切入，不再逐词错峰
// 整句停留。体感停留 ≈ 切入的后半段（easeOutQuint 前一半时间就走完 ~97%，约 0.2s 已清晰可读）
// + HOLD + 收拢的起步段（easeInOutQuart 起步很慢，前 ~0.15s 几乎不动）。
// 目标体感约 1s：是闪切节拍（0.5s）的两倍，读得出“落地了”，又不至于干等
const HOLD = 0.7;
const COLLAPSE_DUR = 0.75;   // 非首字母收拢
const COLLAPSE_STAGGER = 0.035;
const GROW_DUR = 0.9;        // UWU.CAT 放大
const NYA_DELAY = 0.7;       // UWU.CAT 开始放大后多久冒出 Nya~
const NYA_DUR = 1.25;        // Nya~ 弹出 → 停留 → 消失
// 大标题停留到 Nya~ 刚好消失，再飞入方框
const TITLE_HOLD = NYA_DELAY + NYA_DUR - GROW_DUR;
const FLY_DUR = 1.05;        // 大标题 → 方框内小标题

const TOTAL_IN = (words.length - 1) * IN_STAGGER + IN_DUR;
const TOTAL_COLLAPSE = (words.length - 1) * COLLAPSE_STAGGER + COLLAPSE_DUR;

type Phase = "langs" | "in" | "collapse" | "title" | "block";

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

/** 用页面字体（或指定字体）在 100px 下实际排一次，返回文字宽度 */
function measureAt100(text: string, font?: string, lang?: string) {
    const el = document.createElement("span");
    el.textContent = text;
    if (lang) el.lang = lang;
    el.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font-size:100px;font-weight:700;";
    if (font) el.style.fontFamily = font;
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

/**
 * 开场每一句（各语言 + 英文）共用的切入/切出起止状态：轻微上浮 + 去模糊。
 * 减少动态效果（如 Windows 关闭了“动画效果”）时只做淡入淡出，不位移、不模糊。
 */
const cutFrom = (reduce: boolean | null, y = 10) =>
    reduce ? {opacity: 0} : {opacity: 0, y, filter: "blur(8px)"};

// ---------------- 小组件 ----------------

/** 非首字母部分：宽度收为 0，首字母自然向中间滑拢 */
function Rest({text, idx, collapsed, reduce}: { text: string; idx: number; collapsed: boolean; reduce: boolean | null }) {
    if (!text) return null;
    return (
        <motion.span
            className="inline-block overflow-hidden whitespace-nowrap align-bottom title-ink"
            initial={cutFrom(reduce)}
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

/** 大标题右上角弹出的 Nya~：弹性冒出 → 轻微晃动 → 下沉模糊消失（整体向右下倾斜） */
const Nya = () => (
    // 外层负责定位（字号用 em，跟随标题一起放大），内层负责动画
    <span
        className="pointer-events-none absolute right-0 top-0 translate-x-[40%] -translate-y-[60%]"
        style={{fontSize: "0.42em"}}
        aria-hidden="true"
    >
        <motion.span
            className="block whitespace-nowrap font-bold text-accent drop-shadow-[0_0_12px_rgba(206,255,28,0.55)]"
            initial={{opacity: 0, scale: 0, rotate: 24, y: -8}}
            animate={{
                opacity: [0, 1, 1, 1, 0],
                scale: [0, 1.18, 0.95, 1, 0.85],
                rotate: [24, 6, 12, 9, 14],
                y: [-8, 0, 0, 0, 12],
                filter: ["blur(4px)", "blur(0px)", "blur(0px)", "blur(0px)", "blur(4px)"],
            }}
            transition={{duration: NYA_DUR, delay: NYA_DELAY, times: [0, 0.18, 0.3, 0.76, 1], ease: "easeOut"}}
        >
            Nya~
        </motion.span>
    </span>
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
    const [phase, setPhase] = useState<Phase>("langs");
    const [langIdx, setLangIdx] = useState(0);
    const [sizes, setSizes] = useState<{ small: number; big: number; langs: number[] } | null>(null);

    useEffect(() => {
        let cancelled = false;
        const timers: ReturnType<typeof setTimeout>[] = [];

        // 等字体加载完，按真实字宽算字号，保证整句和 UWU.CAT 在任何屏幕上都不换行
        // 自定义字体是按需加载的，显式 load 一次再量，避免量到回退字体（也避免闪切时字体中途替换）
        const fontsReady = document.fonts
            ? Promise.all([
                document.fonts.load('700 100px "MyFont"', TITLE),
                ...LANGS.map(({font, text}) => document.fonts.load(`700 100px ${font}`, text)),
            ]).then(() => document.fonts.ready)
            : Promise.resolve();
        fontsReady.catch(() => undefined).then(() => {
            if (cancelled) return;
            const w = window.innerWidth;
            const avail = w - (w >= 640 ? 160 : 32); // 减去 main 的左右 padding（p-4 / sm:p-20）
            // 整句必须一行放下（换行会在收拢时跳行），手机上会比较小
            const small = clamp((avail * 0.94) / (measureAt100(sentence) / 100), 11, 40);
            setSizes({
                small,
                // 手机上不撑满屏幕（太压迫），只占 65% 宽；桌面最大 120px
                big: clamp((avail * (w < 640 ? 0.65 : 0.9)) / (measureAt100(TITLE) / 100), 32, 120),
                // 其它语言和英文同字号，放不下一行时才缩小（闪切时不跳行）
                langs: LANGS.map(({text, font, lang}) =>
                    Math.min(small, (avail * 0.94) / (measureAt100(text, font, lang) / 100))),
            });

            timers.push(...LANGS.slice(1).map((_, i) =>
                setTimeout(() => setLangIdx(i + 1), (LANG_FIRST + i * LANG_STEP) * 1000)));
            timers.push(...([["in", 0], ...TIMELINE] as [Phase, number][]).map(([p, t]) =>
                setTimeout(() => setPhase(p), (LANG_TOTAL + t) * 1000)));
        });
        return () => {
            cancelled = true;
            timers.forEach(clearTimeout);
        };
    }, []);

    const collapsed = phase !== "langs" && phase !== "in";
    const lang = LANGS[langIdx];
    const reduce = useReducedMotion();
    const cutTo = {opacity: 1, y: 0, filter: "blur(0px)"};

    return (
        <div className="fixed inset-0 overflow-hidden overscroll-none touch-none select-none">
            {/* 背景：字符视频，方框出现时开始“解码”扫描入场 */}
            <AsciiVideo src="/media/kitten-540p.mp4" revealed={phase === "block"} className="fixed inset-0 z-0"/>
            {/* 中心压暗，保证文字可读 */}
            <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0)_55%)]"/>
            {/* CRT 扫描线 + 缓慢滚动的刷新亮带：只盖在背景上，不压住方框和文字 */}
            <div className="scanlines pointer-events-none fixed inset-0 z-[1]"/>
            <div className="crt-roll pointer-events-none fixed inset-x-0 top-0 z-[1] h-[18vh]"/>
            {/* 全屏胶片颗粒 */}
            <div className="grain pointer-events-none fixed inset-0 z-30 opacity-[0.06] mix-blend-overlay"/>

            <main className="relative z-10 grid h-full place-items-center p-4 sm:p-20">
                {/* 阶段 0：日 → 中 → 俄 → 法 闪切，同一位置交叠淡入淡出，最后一个和英文入场重叠 */}
                {sizes && (
                    <div className="pointer-events-none absolute inset-0 grid place-items-center p-4 sm:p-20" aria-hidden="true">
                        <AnimatePresence>
                            {phase === "langs" && (
                                <motion.p
                                    key={lang.lang}
                                    lang={lang.lang}
                                    className="[grid-area:1/1] whitespace-nowrap font-bold leading-[1.25] title-ink"
                                    style={{fontSize: sizes.langs[langIdx], fontFamily: lang.font}}
                                    initial={cutFrom(reduce)}
                                    animate={{...cutTo, transition: {duration: LANG_IN, ease: EASE_OUT}}}
                                    exit={{...cutFrom(reduce, -8), transition: {duration: LANG_OUT, ease: EASE_IN_OUT}}}
                                >
                                    {lang.text}
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>
                )}
                {sizes && phase !== "langs" && (
                    <LayoutGroup>
                        {phase !== "block" ? (
                            /* 阶段 1~3：整句入场 → 非首字母收拢 → UWU.CAT 放大 */
                            <div
                                className="relative flex flex-wrap justify-center items-end font-bold"
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
                                        <Rest text={pre} idx={idx} collapsed={collapsed} reduce={reduce}/>
                                        <motion.span
                                            layoutId={`initial-${idx}`}
                                            className="inline-block title-ink"
                                            initial={cutFrom(reduce)}
                                            animate={cutTo}
                                            transition={{duration: IN_DUR, ease: EASE_OUT, delay: idx * IN_STAGGER}}
                                        >
                                            {first}
                                        </motion.span>
                                        <Rest text={post} idx={idx} collapsed={collapsed} reduce={reduce}/>
                                    </span>
                                ))}
                                {phase === "title" && <Nya/>}
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
