"use client";

import { useEffect, useRef, useState } from "react";

const FACT_TEXT = "An average phone is about 15 cm long.";
const QUESTION_TEXT = "Roughly how many phones would fit in one kilometre?";

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
    headline: "Not quite.",
    body: "1,000 phones stacked end to end would only reach about the height of the Great Pyramid of Giza.",
    listLine: "1,000 phones ≈ the Great Pyramid of Giza",
  },
  {
    id: "5500",
    label: "5,500",
    icon: "/universe/burj-khalifa.png",
    order: 2,
    hero: "/universe/burj-khalifa.png",
    headline: "Close.",
    body: "5,500 phones is roughly the height of the Burj Khalifa — the tallest building on Earth. Still a little short of a kilometre.",
    listLine: "5,500 phones ≈ the Burj Khalifa",
  },
  {
    id: "6700",
    label: "6,700",
    icon: "/universe/mobile.png",
    order: 3,
    headline: "Spot on.",
    body: "6,700 average phones lined up end to end = one kilometre.",
    listLine: "6,700 phones = one kilometre",
  },
  {
    id: "59000",
    label: "59,000",
    icon: "/universe/mountain.png",
    order: 4,
    hero: "/universe/mountain.png",
    headline: "Haha — that's Mount Everest.",
    body: "59,000 phones would stretch about as high as Everest. Impressive… but way past one kilometre.",
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

    // Gentle cascade: fact → pause → question + options
    const factIn = window.setTimeout(() => setFactVisible(true), 650);
    const questionIn = window.setTimeout(() => setQuestionVisible(true), 2400);
    const optionsIn = window.setTimeout(() => setOptionsVisible(true), 3100);

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

    // Wait for quiz fade (~1.15s) before mounting the result card
    window.setTimeout(() => {
      setPhase("reveal");
      onRevealPhase?.(true);
      // Double frame so .opening-reveal paints at opacity 0 first
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setRevealVisible(true));
      });
    }, 1100);
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
            <p className="opening-reveal-headline">{choice.headline}</p>
            <p className="opening-reveal-body">{choice.body}</p>
          </div>
        </div>

        <ul className="opening-reveal-rest" aria-label="Scale of phones">
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
              <span className="opening-reveal-rest-line">{c.listLine}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="ctrl-btn rect opening-reveal-cta"
          onClick={handleContinue}
        >
          Let&apos;s see what distance really is →
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
      <div
        className={`opening-quiz-copy-stack${
          questionVisible || optionsVisible ? " has-question" : ""
        }`}
      >
        <div
          className={`universe-message prompt-text opening-quiz-copy${
            factVisible ? " visible" : ""
          }`}
          aria-live="polite"
        >
          {FACT_TEXT}
        </div>
        {(questionVisible || optionsVisible || fadingQuiz) && (
          <div
            className={`universe-message prompt-text opening-quiz-copy${
              questionVisible ? " visible" : ""
            }`}
            aria-live="polite"
          >
            {QUESTION_TEXT}
          </div>
        )}
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
