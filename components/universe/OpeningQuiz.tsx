"use client";

import { useEffect, useRef, useState } from "react";

const FACT_TEXT = "An average phone is about 15 cm long.";
const QUESTION_TEXT = "Roughly how many phones would fit in one kilometre?";

const OPTIONS = ["1,000", "3,500", "6,700", "12,000"] as const;

type OpeningQuizProps = {
  active: boolean;
  onAnswered: (choice: string) => void;
  /**
   * Center of the band between the question stack and the options (NDC y).
   */
  onPhoneSlotNdc?: (ndcY: number) => void;
};

/**
 * Layout:
 *   50px top → fact → (delay) → roughly… (50px under fact) → phone band → options → 50px bottom
 * Both lines stay; options arrive with the second line.
 */
export default function OpeningQuiz({
  active,
  onAnswered,
  onPhoneSlotNdc,
}: OpeningQuizProps) {
  const [factVisible, setFactVisible] = useState(false);
  const [questionVisible, setQuestionVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [fadingOut, setFadingOut] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    const factIn = window.setTimeout(() => setFactVisible(true), 500);

    // Keep fact; reveal roughly… + options under it
    const questionIn = window.setTimeout(() => {
      setQuestionVisible(true);
      setOptionsVisible(true);
    }, 2800);

    return () => {
      clearTimeout(factIn);
      clearTimeout(questionIn);
    };
  }, [active]);

  useEffect(() => {
    if (!active || !onPhoneSlotNdc) return;
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
  }, [active, onPhoneSlotNdc, optionsVisible, factVisible, questionVisible]);

  const handlePick = (opt: string) => {
    if (selected || fadingOut || !optionsVisible) return;
    setSelected(opt);

    window.setTimeout(() => {
      setFadingOut(true);
      setFactVisible(false);
      setQuestionVisible(false);
      setOptionsVisible(false);
      window.setTimeout(() => onAnswered(opt), 700);
    }, 450);
  };

  if (!active) return null;

  return (
    <div
      ref={rootRef}
      className={`opening-quiz${fadingOut ? " fading" : ""}`}
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
        {(questionVisible || optionsVisible || fadingOut) && (
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
        {OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`ctrl-btn option${selected === opt ? " selected" : ""}`}
            disabled={!!selected}
            onClick={() => handlePick(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
