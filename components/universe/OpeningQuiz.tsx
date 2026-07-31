"use client";

import { useEffect, useRef, useState } from "react";

const FACT_TEXT = "The smartphone in your hand is roughly 15 cm long.";
const QUESTION_TEXT = "If you stacked phones end-to-end, how many would it take to stretch 1 kilometre?";

type ChoiceId = "1000" | "5500" | "6700" | "59000";

type Choice = {
  id: ChoiceId;
  label: string;
  icon: string;
  /** Sort key for “building up” the scale list */
  order: number;
  hero?: string;
  /** Top reaction when this option is picked */
  headline: string;
  /** Only about this pick — no correct answer spoiler on wrongs */
  body: string;
  /** One-liner when this option appears in the list under someone else’s pick */
  listLine: string;
};

const CHOICES: Choice[] = [
  {
    id: "1000",
    label: "1,000",
    icon: "/universe/pyramid.png",
    order: 1,
    hero: "/universe/pyramid.png",
    headline: "Pyramid Scheme!",
    body: "1,000 phones only gets you to the top of the Great Pyramid of Giza (~138m). Ancient pharaohs would be impressed, but we're going way higher.",
    listLine: "1,000 phones ≈ the Great Pyramid of Giza",
  },
  {
    id: "5500",
    label: "5,500",
    icon: "/universe/burj-khalifa.png",
    order: 2,
    hero: "/universe/burj-khalifa.png",
    headline: "Burj-level thinking!",
    body: "5,500 phones reaches the tip of the Burj Khalifa (~828m)—the tallest skyscraper on Earth. You're scraping the clouds, but not quite at a full kilometre.",
    listLine: "5,500 phones ≈ the Burj Khalifa",
  },
  {
    id: "6700",
    label: "6,700",
    icon: "/universe/mobile.png",
    order: 3,
    headline: "Bullseye! 🎯",
    body: "6,700 phones lined up end-to-end equals exactly 1 kilometre. Remember this number, because space is about to make 1 km look microscopic.",
    listLine: "6,700 phones = one kilometre",
  },
  {
    id: "59000",
    label: "59,000",
    icon: "/universe/mountain.png",
    order: 4,
    hero: "/universe/mountain.png",
    headline: "Woah, calm down Everest! 🏔️",
    body: "59,000 phones would stack all the way up to the summit of Mount Everest (8.8 km)! You'd freeze your fingers off way before reaching that high.",
    listLine: "59,000 phones ≈ Mount Everest",
  },
];

type OpeningQuizProps = {
  active: boolean;
  onContinue: () => void;
  onPhoneSlotNdc?: (ndcY: number) => void;
  onRevealPhase?: (revealing: boolean) => void;
};

/**
 * Phone scale quiz → answer card (scale ladder, correct last) → continue.
 */
export default function OpeningQuiz({
  active,
  onContinue,
  onPhoneSlotNdc,
  onRevealPhase,
}: OpeningQuizProps) {
  const [factVisible, setFactVisible] = useState(false);
  const [questionVisible, setQuestionVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [selected, setSelected] = useState<ChoiceId | null>(null);
  const [phase, setPhase] = useState<"quiz" | "reveal">("quiz");
  const [revealVisible, setRevealVisible] = useState(false);
  const [fadingQuiz, setFadingQuiz] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    // Gentle cascade: H1 + 3D phone -> pause -> P1 question -> pause -> options
    const factIn = window.setTimeout(() => setFactVisible(true), 400);
    const questionIn = window.setTimeout(() => setQuestionVisible(true), 1800);
    const optionsIn = window.setTimeout(() => setOptionsVisible(true), 3000);

    return () => {
      clearTimeout(factIn);
      clearTimeout(questionIn);
      clearTimeout(optionsIn);
    };
  }, [active]);

  useEffect(() => {
    if (!active || phase !== "quiz" || !onPhoneSlotNdc) return;
    const slot = slotRef.current;
    const root = rootRef.current;
    if (!slot || !root) return;

    const report = () => {
      const stage = (root.offsetParent as HTMLElement | null) ?? root;
      const stageRect = stage.getBoundingClientRect();
      const slotRect = slot.getBoundingClientRect();
      if (stageRect.height < 1) return;
      const cy = slotRect.top + slotRect.height / 2;
      const ndcY = -((cy - stageRect.top) / stageRect.height) * 2 + 1;
      onPhoneSlotNdc(ndcY);
    };

    report();
    const ro = new ResizeObserver(report);
    ro.observe(slot);
    ro.observe(root);
    window.addEventListener("resize", report);
    const t = window.setTimeout(report, 50);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", report);
      clearTimeout(t);
    };
  }, [active, onPhoneSlotNdc, optionsVisible, factVisible, questionVisible, phase]);

  const handlePick = (id: ChoiceId) => {
    if (selected || fadingQuiz || !optionsVisible || phase !== "quiz") return;
    setSelected(id);
    setFadingQuiz(true);
    setFactVisible(false);
    setQuestionVisible(false);
    setOptionsVisible(false);
    // Trigger phone exit immediately
    onRevealPhase?.(true);

    // Patient, cinematic exit (800ms) before reveal card mounts
    window.setTimeout(() => {
      setPhase("reveal");
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setRevealVisible(true));
      });
    }, 800);
  };

  const handleContinue = () => {
    setRevealVisible(false);
    // Match reveal exit easing before satellite beat starts
    window.setTimeout(() => {
      onRevealPhase?.(false);
      onContinue();
    }, 900);
  };

  if (!active) return null;

  const choice = CHOICES.find((c) => c.id === selected) ?? null;

  /**
   * Remaining options: scale ladder (small → big), correct answer always last
   * so we don’t spoil 6,700 until the end of the list.
   */
  const restLadder =
    choice == null
      ? []
      : CHOICES.filter((c) => c.id !== choice.id).sort((a, b) => {
          // Correct answer always last
          if (a.id === "6700") return 1;
          if (b.id === "6700") return -1;
          return a.order - b.order;
        });

  // ── Answer reveal ─────────────────────────────────────────────
  if (phase === "reveal" && choice) {
    return (
      <div
        className={`opening-reveal${revealVisible ? " visible" : ""}`}
        aria-live="polite"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          height: "100%",
          boxSizing: "border-box",
          paddingTop: "calc(10dvh + env(safe-area-inset-top, 0px))",
          paddingBottom: "calc(6dvh + env(safe-area-inset-bottom, 0px))",
          paddingLeft: "var(--universe-side-pad, 20px)",
          paddingRight: "var(--universe-side-pad, 20px)",
        }}
      >
        <div className="opening-reveal-main">
          {choice.hero && (
            <img
              className="opening-reveal-hero"
              src={choice.hero}
              alt=""
              draggable={false}
            />
          )}
          <div className="opening-reveal-copy">
            <h1 className="opening-reveal-headline u-h1">{choice.headline}</h1>
            <p className="opening-reveal-body u-p1">{choice.body}</p>
          </div>
        </div>

        <ul className="opening-reveal-rest" aria-label="Scale of phones" style={{ margin: "12px 0" }}>
          {restLadder.map((c) => (
            <li
              key={c.id}
              className={`opening-reveal-rest-item${
                c.id === "6700" ? " is-correct" : ""
              }`}
            >
              <img
                src={c.icon}
                alt=""
                className="opening-reveal-icon"
                draggable={false}
              />
              <span className="opening-reveal-rest-line u-p1">{c.listLine}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="ctrl-btn rect opening-reveal-cta"
          style={{ width: "min(100%, 300px)", marginTop: "0" }}
          onClick={handleContinue}
        >
          Let&apos;s See Real Scale 🌍
        </button>
      </div>
    );
  }

  // ── Quiz ──────────────────────────────────────────────────────
  return (
    <div
      ref={rootRef}
      className={`opening-quiz${fadingQuiz ? " fading" : ""}`}
    >
      <div className="opening-quiz-copy-stack">
        {/* First beat: lead fact (h1) */}
        <h1
          className={`universe-message opening-quiz-copy u-h1${
            factVisible ? " visible" : ""
          }`}
          aria-live="polite"
        >
          {FACT_TEXT}
        </h1>

        {/* Second beat: question (p1) — pre-rendered in layout for zero reflow/pop */}
        <p
          className={`universe-message opening-quiz-copy u-p1${
            questionVisible ? " visible" : ""
          }`}
          aria-live="polite"
        >
          {QUESTION_TEXT}
        </p>
      </div>

      <div ref={slotRef} className="opening-quiz-phone-slot" aria-hidden />

      <div
        className={`opening-quiz-options${optionsVisible ? " visible" : ""}`}
        role="group"
        aria-label="Guess"
      >
        {CHOICES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`ctrl-btn option${selected === c.id ? " selected" : ""}`}
            disabled={!!selected}
            onClick={() => handlePick(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
