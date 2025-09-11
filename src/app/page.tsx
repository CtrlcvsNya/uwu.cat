"use client";
import {motion, AnimatePresence, LayoutGroup} from "framer-motion";
import {useEffect, useMemo, useState} from "react";
import AsciiCanvas256 from "@/app/video";

const sentence = "Uplift With Uniqueness . Cats Always Touch";
const words = sentence.split(" ");

// 基础节奏
const IN_DUR = 0.6;         // 每词入场时长
const STAGGER_IN = 0.1;     // 入场错峰
const HOLD = 1.8;           // 全部入场后停留
const OUT_PER = 0.05;       // 非首字母淡出：每词 0.05s
const OUT_STAGGER = 0.05;   // 非首字母淡出错峰
const IN_Y = 20;
const OUT_Y = -IN_Y * 0.5;

const INITIALS_HOLD = 1.2;  // 首字母聚合后停留
const INITIALS_EXIT = 0.04;
const EASE_OUT = [0.16, 1, 0.3, 1] as const; // easeOutQuint 风格
const EASE_IN = [0.5, 0, 0.7, 0] as const;

const ASCII_FADE_DELAY_AFTER_BLOCK = 0.4; // 进入 block 阶段后再等 0.4s 开始淡出
const ASCII_FADE_DUR = 0.6;               // 淡出用时 0.6s

type Phase = "in" | "hold" | "outRest" | "initials" | "revealBlock" | "block";

// 按词拆“首字母/其余”
type Split = { pre: string; first: string; post: string };
const splitWord = (w: string): Split => {
    const m = w.match(/[A-Za-z0-9]/);
    if (!m) return {pre: "", first: w.charAt(0) ?? "", post: w.slice(1)};
    const i = m.index ?? 0;
    return {pre: w.slice(0, i), first: w[i], post: w.slice(i + 1)};
};
const splits: Split[] = words.map(splitWord);

// 逐词入场
const wordVariant = {
    hidden: {y: IN_Y, opacity: 0}, visible: {
        y: 0, opacity: 1, transition: {duration: IN_DUR, ease: EASE_OUT},
    },
};

// 标题字符
const title = "UWU.CAT";
const titleChars = title.split("");

export default function Home() {
    const totalIn = useMemo(() => (words.length - 1) * STAGGER_IN + IN_DUR, []);
    const totalOut = useMemo(() => (words.length - 1) * OUT_STAGGER + OUT_PER, []);

    const [asciiVisible, setAsciiVisible] = useState(true);

    const [phase, setPhase] = useState<Phase>("in");

    useEffect(() => {
        const t1 = setTimeout(() => setPhase("hold"), totalIn * 1000);
        const t2 = setTimeout(() => setPhase("outRest"), (totalIn + HOLD) * 1000);
        const t3 = setTimeout(() => setPhase("initials"), (totalIn + HOLD + totalOut) * 1000);
        const t4 = setTimeout(() => setPhase("revealBlock"), (totalIn + HOLD + totalOut + INITIALS_HOLD) * 1000);
        const t5 = setTimeout(() => setPhase("block"), (totalIn + HOLD + totalOut + INITIALS_HOLD + INITIALS_EXIT) * 1000);
        const t6 = setTimeout(() => setAsciiVisible(false), (totalIn + HOLD + totalOut + INITIALS_HOLD + INITIALS_EXIT + ASCII_FADE_DELAY_AFTER_BLOCK) * 1000);
        return () => { /* 清理原有 timer */
            clearTimeout(t6);
        };
    }, [totalIn, totalOut]);
    return (<div
        className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
        <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start w-full">
            <AnimatePresence>
                {!asciiVisible && (<motion.div
                    className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none z-0"
                    initial={{opacity: 1}}
                    animate={{opacity: 1}}
                    exit={{opacity: 0}}
                    transition={{duration: ASCII_FADE_DUR, ease: [0.16, 1, 0.3, 1]}}
                >
                    <AsciiCanvas256
                        src="/1.mp4"
                        overlay
                        autoPlay
                        loop
                        muted
                        fps={30}
                        palette="xterm256"
                        cellBg
                        cellBgAlpha={0.85}
                    />
                </motion.div>)}
            </AnimatePresence>
            <LayoutGroup>
                <div className="relative w-full flex justify-center items-center">
                    {/* 阶段1/2/3：逐词入场 → 停留 → 非首字母按词淡出 */}
                    <AnimatePresence>
                        {(phase === "in" || phase === "hold" || phase === "outRest") && (<motion.div
                            key="sentence"
                            className="flex flex-wrap justify-center gap-[0.4rem] text-2xl md:text-3xl font-bold"
                        >
                            {splits.map(({pre, first, post}, idx) => {
                                const inDelay = idx * STAGGER_IN;
                                const outDelay = idx * OUT_STAGGER;
                                return (<span key={idx} className="inline-flex items-baseline">
                        {/* pre */}
                                    <motion.span
                                        initial={{ y: IN_Y, opacity: 0 }}
                                        animate={phase === "outRest"
                                            ? { y: OUT_Y, opacity: 0 }
                                            : { y: 0, opacity: 1 }}
                                        transition={phase === "outRest"
                                            ? { duration: OUT_PER, delay: outDelay, ease: EASE_IN }
                                            : { duration: IN_DUR, delay: inDelay, ease: EASE_OUT }}
                                    >
  {pre}
</motion.span>

                                    {/* 首字母（保留，为后续“桥接”做准备） */}
                                    <motion.span
                                        layoutId={`initial-${idx}`}
                                        initial={{y: IN_Y, opacity: 0}}
                                        animate={{y: 0, opacity: 1}}
                                        transition={{
                                            duration: IN_DUR, delay: inDelay, ease: EASE_OUT,
                                        }}
                                    >
                          {first}
                        </motion.span>

                                    {/* post */}
                                    <motion.span
                                        initial={{ y: IN_Y, opacity: 0 }}
                                        animate={phase === "outRest"
                                            ? { y: OUT_Y, opacity: 0 }
                                            : { y: 0, opacity: 1 }}
                                        transition={phase === "outRest"
                                            ? { duration: OUT_PER, delay: outDelay, ease: EASE_IN }
                                            : { duration: IN_DUR, delay: inDelay, ease: EASE_OUT }}
                                    >
  {post}
</motion.span>
                      </span>);
                            })}
                        </motion.div>)}
                    </AnimatePresence>

                    {/* 阶段4/5：首字母聚合 → 向左“收拢+模糊+淡出”，同时内容块出现 */}
                    {/* 阶段4：首字母聚合（绝对定位到中心，便于与内容块叠加过渡） */}
                    {(phase === "initials" || phase === "revealBlock") && (<motion.div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        initial={{opacity: 0}}
                        animate={phase === "initials" ? {opacity: 1, x: 0} : {opacity: 0, x: -60} // 向左淡出
                        }
                        transition={{
                            duration: phase === "initials" ? 0.25 : INITIALS_EXIT, ease: "easeOut",
                        }}
                    >
                        <div className="flex justify-center items-center text-2xl md:text-3xl font-bold">
                            {splits.map(({first}, idx) => (<motion.span
                                key={idx}
                                layoutId={`initial-${idx}`}
                                transition={{type: "spring", stiffness: 520, damping: 32}}
                            >
                                {first}
                            </motion.span>))}
                        </div>
                    </motion.div>)}

                    {/* 阶段5/6：内容块（标题/Logo 慢一些、连贯一些；二级内容随后出现） */}
                    {(phase === "revealBlock" || phase === "block") && (<motion.div
                        className="flex flex-col md:flex-row md:items-start w-full md:w-[36em] gap-2 p-4 md:p-7 -mt-[2.35rem] ml-[0.5rem] z-10 bg-black rounded-lg shadow-lg"
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        transition={{duration: 0.2, ease: EASE_OUT}}
                    >
                        {/* 左：Logo + 标题 */}
                        <div className="flex flex-col">
                            <div className="flex items-center">
                                {/* Logo：从右侧滑入 + 旋转放大（更慢） */}
                                <motion.div
                                    initial={{x: 36, opacity: 0, scale: 0.8, rotate: -90}}
                                    animate={{x: 0, opacity: 1, scale: 1, rotate: 270}}
                                    transition={{
                                        x: {duration: 0.35, ease: EASE_OUT},
                                        opacity: {duration: 0.35, ease: EASE_OUT},
                                        scale: {duration: 0.45, ease: EASE_OUT},
                                        rotate: {duration: 0.6, ease: "easeInOut"},
                                    }}
                                    style={{transformOrigin: "50% 50%"}}
                                >
                                    <motion.svg
                                        viewBox="0 0 123 123"
                                        aria-hidden="true"
                                        fill="currentColor"
                                        className="w-8 h-8 md:w-10 md:h-10 -mt-1 md:-mt-1.5 text-[#ceff1c]"
                                        stroke="none"
                                    >
                                        <g>
                                            <polygon className="st0"
                                                     points="91.08,49.15 122.88,49.15 122.88,73.73 91.08,73.73 113.58,96.23 96.15,113.58 73.73,91.08 73.73,122.88 49.15,122.88 49.15,91.08 26.64,113.58 9.3,96.23 31.72,73.73 0,73.73 0,49.15 31.72,49.15 9.3,26.73 26.64,9.3 49.15,31.72 49.15,0 73.73,0 73.73,31.72 96.24,9.3 113.58,26.64 91.08,49.15"></polygon>
                                        </g>
                                    </motion.svg>
                                </motion.div>

                                {/* 标题：字符逐个从右向左进入，整体 letter-spacing 收拢，营造“首字母聚合→标题成形”的连贯感 */}
                                <motion.span
                                    className="text-2xl md:text-3xl font-bold ml-1"
                                    initial={{letterSpacing: "0.35em"}}
                                    animate={{letterSpacing: "0.02em"}}
                                    transition={{duration: 0.4, ease: EASE_OUT}}
                                    style={{display: "inline-flex"}}
                                >
                                    {titleChars.map((ch, i) => (<motion.span
                                        key={i}
                                        initial={{x: 28, opacity: 0}}
                                        animate={{x: 0, opacity: 1}}
                                        transition={{
                                            duration: 0.34, ease: EASE_OUT, delay: 0.12 + i * 0.06
                                        }}
                                        style={{display: "inline-block"}}
                                    >
                                        {ch}
                                    </motion.span>))}
                                </motion.span>
                            </div>

                            {/* 副标题：稍慢的放大显现 */}
                            <motion.div
                                className="text-xs text-gray-400 mt-1 ml-9 md:ml-11 font-bold"
                                initial={{scale: 0.92, opacity: 0}}
                                animate={{scale: 1, opacity: 1}}
                                transition={{duration: 0.24, ease: EASE_OUT, delay: 0.28}}
                            >
                                In a cat’s eyes, all things belong to dreams.
                            </motion.div>
                        </div>

                        <div className="hidden md:block md:w-1/3"></div>

                        {/* 右侧：链接/版权，稍后一点出现 */}
                        <motion.div
                            className="flex flex-col text-sm font-bold w-full mt-4 md:mt-0 md:items-end h-auto md:h-24"
                            initial={{scale: 0.92, opacity: 0}}
                            animate={{scale: 1, opacity: 1}}
                            transition={{duration: 0.26, ease: EASE_OUT, delay: 0.32}}
                        >
                            <a href="https://x.com/DaHuangCore"
                               className="flex items-center gap-2 my-1 md:my-0">
                    <span className="inline-block whitespace-pre-wrap">
                      <span className="sr-only">X</span>
                      <span aria-hidden="true">X</span>
                    </span>
                                <svg
                                    width="62"
                                    height="62"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-3 h-3 md:w-4 md:h-4"
                                >
                                    <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor"
                                          strokeWidth={4}></path>
                                </svg>
                            </a>
                            <a href="https://github.com/CtrlcvsNya"
                               className="flex items-center gap-2 my-1 md:my-0">
                    <span className="inline-block whitespace-pre-wrap">
                      <span className="sr-only">Github</span>
                      <span aria-hidden="true">Github</span>
                    </span>
                                <svg
                                    width="62"
                                    height="62"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="w-3 h-3 md:w-4 md:h-4"
                                >
                                    <path d="M7 17L17 7M17 7H7M17 7V17" stroke="currentColor"
                                          strokeWidth={4}></path>
                                </svg>
                            </a>

                            <div className="flex-1"></div>
                            <p className="text-xs text-gray-400 mt-3 md:mt-0 md:text-right">
                                © Ctrlcvs
                                <br/>
                                not for sale, AI last.
                            </p>
                        </motion.div>
                    </motion.div>)}
                </div>
            </LayoutGroup>
        </main>
    </div>);
}
