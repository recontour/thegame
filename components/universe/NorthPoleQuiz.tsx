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
    headline: "Mount Everest",
    body: "That’s the height of Mount Everest.\nYou’d still be well inside the atmosphere — just very cold and out of breath.",
    listLine: "8.8 km ≈ Summit of Mount Everest",
  },
  {
    id: "10.7",
    kmValue: 10.7,
    label: "10.7 km",
    order: 2,
    headline: "Airplane Altitude",
    body: "That’s normal cruising height for airplanes.\nHigh enough for a smooth flight, but nowhere near space.",
    listLine: "10.7 km ≈ Commercial Airplane Flight",
  },
  {
    id: "140",
    kmValue: 140,
    order: 3,
    label: "140 km",
    headline: "Edge of Space",
    body: "Now we’re talking.\nThis is roughly where space begins. You’d see the blackness above you… but Earth’s gravity would still pull you back down.",
    listLine: "140 km ≈ Edge of Space (Karman Line)",
  },
  {
    id: "420",
    kmValue: 420,
    order: 4,
    label: "420 km",
    headline: "ISS Orbit",
    body: "Spot on!\nThis is where the International Space Station orbits. Some Low Earth Orbit satellites operate here, but GPS satellites need to cover the entire globe — so they sit much higher!",
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
  const [selected, setSelected] = useState<ChoiceId | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      setSelected(null);
      setShowAnswer(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setVisible(true);
    }, 600);

    return () => clearTimeout(timer);
  }, [active]);

  if (!active) return null;

  const handlePick = (id: ChoiceId) => {
    if (selected) return;
    setSelected(id);
    window.setTimeout(() => {
      setShowAnswer(true);
    }, 450);
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
        className="opening-reveal visible"
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

        <div style={{ textAlign: "center", padding: "0 8px", margin: "8px 0" }}>
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
          style={{ width: "min(100%, 300px)", marginTop: "0" }}
          onClick={onNext}
        >
          Place a GPS Satellite →
        </button>
      </div>
    );
  }

  return (
    <div
      className={`sat-bridge ${visible ? "visible" : ""}`}
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
              letterSpacing: "0.12em",
              marginBottom: "16px",
            }}
          >
            How high is high enough?
          </h2>
          <p className="sat-bridge-copy u-p1 visible">
            How high above Earth do you think satellites need to be?
          </p>
        </div>

        <div
          style={{
            pointerEvents: "auto",
            marginTop: "12px",
            width: "100%",
            maxWidth: "340px",
            background: "rgba(10, 16, 28, 0.12)",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(96, 165, 250, 0.12)",
            borderRadius: "16px",
            padding: "16px 14px 14px",
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.5)",
          }}
        >
          {/* Bars container (without top labels) */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-around",
              height: `${MAX_BAR_HEIGHT_PX + 10}px`,
              borderBottom: "2px solid rgba(148, 163, 184, 0.3)",
              paddingBottom: "2px",
              position: "relative",
            }}
          >
            {CHOICES.map((c) => {
              // Perceptual Square-Root Scaling:
              const scaleRatio = Math.sqrt(c.kmValue / 420);
              const finalHeight = Math.round(scaleRatio * MAX_BAR_HEIGHT_PX);
              const isSelected = selected === c.id;

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
                  {/* Bar graphic */}
                  <div
                    style={{
                      width: "100%",
                      maxWidth: "40px",
                      height: `${finalHeight}px`,
                      background: isSelected
                        ? "linear-gradient(180deg, #38bdf8 0%, #0284c7 100%)"
                        : "linear-gradient(180deg, #60a5fa 0%, #1e40af 100%)",
                      borderRadius: "6px 6px 2px 2px",
                      boxShadow: isSelected
                        ? "0 0 16px rgba(56, 189, 248, 0.8), inset 0 1px 2px rgba(255,255,255,0.6)"
                        : "0 0 10px rgba(96, 165, 250, 0.3)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      transition: "height 0.4s ease, background 0.2s ease, boxShadow 0.2s ease",
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Square Clickable Buttons under the graph */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-around",
              alignItems: "center",
              gap: "8px",
              marginTop: "14px",
            }}
          >
            {CHOICES.map((c) => {
              const isSelected = selected === c.id;
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
