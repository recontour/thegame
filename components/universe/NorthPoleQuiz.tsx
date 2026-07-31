"use client";

import { useEffect, useState } from "react";

type ChoiceId = "8.8" | "10.7" | "140" | "420";

type Choice = {
  id: ChoiceId;
  kmValue: number;
  label: string;
  order: number;
  headline: string;
  body: string;
  listLine: string;
  isCorrect?: boolean;
};

const CHOICES: Choice[] = [
  {
    id: "8.8",
    kmValue: 8.8,
    label: "8.8 km",
    order: 1,
    headline: "Everest Altitude (8.8 km)",
    body: "You’re standing on top of Mount Everest!\nStill choking on thin air, freezing your socks off, and 100% glued to Earth's atmosphere.",
    listLine: "8.8 km ≈ Summit of Mount Everest",
  },
  {
    id: "10.7",
    kmValue: 10.7,
    label: "10.7 km",
    order: 2,
    headline: "Commercial Airplane Cruising (10.7 km)",
    body: "That's where you sit while eating a tiny bag of pretzels on a flight.\nSmooth ride, but zero gravity? Not a chance.",
    listLine: "10.7 km ≈ Commercial Airplane Flight",
  },
  {
    id: "140",
    kmValue: 140,
    order: 3,
    label: "140 km",
    headline: "The Edge of Space (140 km)",
    body: "Welcome to the Kármán Line!\nThe sky turns pitch black and stars pop out, but if you stop moving, Earth's gravity will smack you right back down.",
    listLine: "140 km ≈ Edge of Space (Kármán Line)",
  },
  {
    id: "420",
    kmValue: 420,
    order: 4,
    label: "420 km",
    headline: "Space Station Territory! (420 km)",
    body: "Nailed it!\nThis is where astronauts float on the International Space Station. But spoiler alert: GPS satellites think this is way too low and sit 50 TIMES HIGHER!",
    listLine: "420 km = International Space Station Orbit",
    isCorrect: true,
  },
];

type NorthPoleQuizProps = {
  active: boolean;
  onNext: () => void;
};

export default function NorthPoleQuiz({ active, onNext }: NorthPoleQuizProps) {
  const [visible, setVisible] = useState(false);
  const [barsGrown, setBarsGrown] = useState(false);
  const [buttonsVisible, setButtonsVisible] = useState(false);
  const [selected, setSelected] = useState<ChoiceId | null>(null);
  const [fadingOut, setFadingOut] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [revealVisible, setRevealVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      setBarsGrown(false);
      setButtonsVisible(false);
      setSelected(null);
      setFadingOut(false);
      setShowAnswer(false);
      setRevealVisible(false);
      return;
    }

    // Rebel Artist sequence: outer frame (600ms) -> majestic bar growth (2000ms) -> button reveal (5000ms)
    const t1 = window.setTimeout(() => setVisible(true), 600);
    const t2 = window.setTimeout(() => setBarsGrown(true), 2000);
    const t3 = window.setTimeout(() => setButtonsVisible(true), 5000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [active]);

  if (!active) return null;

  const handlePick = (id: ChoiceId) => {
    if (selected || fadingOut) return;
    setSelected(id);
    setFadingOut(true);

    // Patient, cinematic exit (800ms) before reveal card mounts
    window.setTimeout(() => {
      setShowAnswer(true);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setRevealVisible(true));
      });
    }, 800);
  };

  const choice = CHOICES.find((c) => c.id === selected);

  // Remaining options: scale ladder (small → big), correct answer (420 km) always last
  const restLadder =
    choice == null
      ? []
      : CHOICES.filter((c) => c.id !== choice.id).sort((a, b) => {
          if (a.id === "420") return 1;
          if (b.id === "420") return -1;
          return a.order - b.order;
        });

  // Maximum visual bar height in pixels (420 km = 100%)
  const MAX_BAR_HEIGHT_PX = 364;

  if (showAnswer && choice) {
    return (
      <div
        className={`opening-reveal${revealVisible ? " visible" : ""}`}
        style={{
          zIndex: 35,
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
        <div className="opening-reveal-main" style={{ width: "100%", maxWidth: "340px" }}>
          <div className="opening-reveal-copy">
            <h1 className="opening-reveal-headline u-h1">{choice.headline}</h1>
            <p className="opening-reveal-body u-p1">{choice.body}</p>
          </div>
        </div>

        <ul className="opening-reveal-rest" aria-label="Scale of altitudes" style={{ margin: "12px 0" }}>
          {restLadder.map((c) => (
            <li
              key={c.id}
              className={`opening-reveal-rest-item${c.isCorrect ? " is-correct" : ""}`}
            >
              <span className="opening-reveal-rest-line u-p1">{c.listLine}</span>
            </li>
          ))}
        </ul>

        <div
          style={{
            textAlign: "center",
            padding: "0 8px",
            margin: "8px 0",
            opacity: revealVisible ? 1 : 0,
            transform: revealVisible ? "translateY(0)" : "translateY(12px)",
            transition:
              "opacity 1.4s cubic-bezier(0.16, 1, 0.3, 1) 8.2s, transform 1.4s cubic-bezier(0.16, 1, 0.3, 1) 8.2s",
          }}
        >
          <p
            className="u-p1"
            style={{
              fontSize: "clamp(0.9rem, 3.2vw, 1.05rem)",
              color: "rgba(220, 235, 255, 0.95)",
              lineHeight: 1.4,
              margin: 0,
            }}
          >
            Now that you know how high space really is… let&apos;s try placing a GPS satellite into actual orbit!
          </p>
        </div>

        <button
          type="button"
          className="ctrl-btn rect opening-reveal-cta"
          style={{
            width: "min(100%, 300px)",
            marginTop: "0",
            opacity: revealVisible ? 1 : 0,
            transform: revealVisible ? "translateY(0)" : "translateY(12px)",
            transition:
              "opacity 1.4s cubic-bezier(0.16, 1, 0.3, 1) 10.2s, transform 1.4s cubic-bezier(0.16, 1, 0.3, 1) 10.2s",
          }}
          onClick={onNext}
        >
          Deploy a GPS Satellite 🛰️
        </button>
      </div>
    );
  }

  return (
    <div
      className={`sat-bridge ${visible ? "visible" : ""} ${fadingOut ? "fading" : ""}`}
      style={{
        zIndex: 30,
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: "calc(10dvh + env(safe-area-inset-top, 0px))",
        paddingBottom: "calc(10dvh + env(safe-area-inset-bottom, 0px))",
        paddingLeft: "var(--universe-side-pad, 20px)",
        paddingRight: "var(--universe-side-pad, 20px)",
        boxSizing: "border-box",
      }}
    >
      <div
        className="sat-bridge-stack"
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: "34em", padding: "0 12px" }}>
          <h2
            className="sat-bridge-copy u-h1 visible"
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              marginBottom: "14px",
            }}
          >
            Escape Velocity Check!
          </h2>
          <p className="sat-bridge-copy u-p1 visible">
            How far off the ground do you actually need to go before you&apos;re orbiting in space?
          </p>
        </div>

        <div
          style={{
            pointerEvents: "auto",
            marginTop: "12px",
            width: "100%",
            maxWidth: "340px",
            background: "rgba(10, 16, 28, 0.45)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(96, 165, 250, 0.2)",
            borderRadius: "16px",
            padding: "18px 16px 16px",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.1)",
          }}
        >
          {/* Bars container — vertical growth from 0 to target altitude */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-around",
              height: `${MAX_BAR_HEIGHT_PX + 10}px`,
              borderBottom: "2px solid rgba(148, 163, 184, 0.35)",
              paddingBottom: "2px",
              position: "relative",
            }}
          >
            {CHOICES.map((c, idx) => {
              // Perceptual Square-Root Scaling:
              const scaleRatio = Math.sqrt(c.kmValue / 420);
              const finalHeight = Math.round(scaleRatio * MAX_BAR_HEIGHT_PX);
              const isSelected = selected === c.id;
              const currentHeight = barsGrown ? finalHeight : 0;
              const barDelay = `${idx * 0.55}s`;

              return (
                <div
                  key={c.id}
                  onClick={() => handlePick(c.id)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    height: "100%",
                    flex: 1,
                    cursor: selected ? "default" : "pointer",
                    padding: "0 4px",
                    position: "relative",
                  }}
                >
                  {/* Bar graphic with slow, majestic upward grow animation */}
                  <div
                    style={{
                      width: "100%",
                      maxWidth: "40px",
                      height: `${currentHeight}px`,
                      background: isSelected
                        ? "linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)"
                        : "linear-gradient(180deg, rgba(96, 165, 250, 0.9) 0%, rgba(30, 64, 175, 0.85) 100%)",
                      borderRadius: "6px 6px 2px 2px",
                      boxShadow: isSelected
                        ? "0 0 24px rgba(56, 189, 248, 0.85), inset 0 1px 2px rgba(255,255,255,0.6)"
                        : "0 0 12px rgba(96, 165, 250, 0.35)",
                      border: "1px solid rgba(255, 255, 255, 0.25)",
                      transition: `height 1.6s cubic-bezier(0.16, 1, 0.3, 1) ${barDelay}, background 0.25s ease, boxShadow 0.25s ease`,
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Staggered Square Clickable Buttons under the graph */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              alignItems: "center",
              gap: "8px",
              marginTop: "14px",
            }}
          >
            {CHOICES.map((c, idx) => {
              const isSelected = selected === c.id;
              const btnDelay = `${idx * 0.35}s`;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!!selected}
                  onClick={() => handlePick(c.id)}
                  className={`ctrl-btn ${isSelected ? "selected" : ""}`}
                  style={{
                    flex: 1,
                    aspectRatio: "1 / 1",
                    maxHeight: "54px",
                    maxWidth: "60px",
                    minWidth: "0",
                    padding: 0,
                    borderRadius: "10px",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: buttonsVisible ? 1 : 0,
                    transform: buttonsVisible
                      ? "translateY(0) scale(1)"
                      : "translateY(10px) scale(0.92)",
                    transition: `opacity 1.1s cubic-bezier(0.16, 1, 0.3, 1) ${btnDelay}, transform 1.1s cubic-bezier(0.16, 1, 0.3, 1) ${btnDelay}, background 0.2s ease, box-shadow 0.2s ease`,
                  }}
                >
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
