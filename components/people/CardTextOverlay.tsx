"use client";

import { Cormorant_Upright, Special_Elite } from "next/font/google";
import type { StoryCard } from "@/data/people";

/** Title / header under each photo */
const specialElite = Special_Elite({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

/** Photo description body */
const cormorantUpright = Cormorant_Upright({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

type CardTextOverlayProps = {
  card: StoryCard | null;
  /** 0..1 visibility after focus settles */
  visible: boolean;
  /**
   * Top of free space under the focused image (0 = top of stage, 1 = bottom).
   * Layout fills [bandTop … bottom]:
   *   title  — vertically centered between image and description
   *   body   — left-aligned description
   *   quote  — vertically centered between description and bottom
   */
  bandTop?: number;
};

/**
 * HTML overlay under the focused card.
 */
export default function CardTextOverlay({
  card,
  visible,
  bandTop = 0.55,
}: CardTextOverlayProps) {
  if (!card) return null;

  const topPct = `${(bandTop * 100).toFixed(2)}%`;

  return (
    <div
      aria-live="polite"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: topPct,
        bottom: "max(0.75rem, env(safe-area-inset-bottom))",
        padding: "0 3%",
        pointerEvents: "none",
        zIndex: 5,
        display: "grid",
        // Title zone | body (content) | quote zone — equal air above/below body
        gridTemplateRows: "1fr auto 1fr",
        alignItems: "stretch",
        opacity: visible ? 1 : 0,
        transform: visible ? "translate3d(0,0,0)" : "translate3d(0, 10px, 0)",
        transition:
          "opacity 0.55s ease, transform 0.55s ease, top 0.35s ease-out",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Title — Special Elite, centered under the image */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 0,
          width: "100%",
        }}
      >
        <p
          className={specialElite.className}
          style={{
            margin: 0,
            width: "100%",
            textAlign: "center",
            fontSize: "clamp(1.05rem, 4.6vw, 1.35rem)",
            lineHeight: 1.3,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 400,
            color: "rgba(235,240,250,0.9)",
            textShadow: "0 1px 12px rgba(0,0,0,0.55)",
          }}
        >
          {card.title}
        </p>
      </div>

      {/* Description — Cormorant Upright, left aligned */}
      <p
        className={cormorantUpright.className}
        style={{
          margin: 0,
          width: "100%",
          textAlign: "left",
          fontSize: "clamp(1.05rem, 4.4vw, 1.28rem)",
          lineHeight: 1.4,
          letterSpacing: "0.01em",
          fontWeight: 500,
          color: "rgba(248,248,252,0.94)",
          whiteSpace: "pre-line",
          textShadow: "0 1px 12px rgba(0,0,0,0.55)",
        }}
      >
        {card.body}
      </p>

      {/* Quote — centered in the gap above the bottom */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 0,
          width: "100%",
        }}
      >
        <p
          style={{
            margin: 0,
            width: "100%",
            textAlign: "center",
            fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
            fontSize: "clamp(0.82rem, 3.5vw, 0.98rem)",
            lineHeight: 1.4,
            fontStyle: "italic",
            letterSpacing: "0.01em",
            color: "rgba(210,218,235,0.85)",
            whiteSpace: "pre-line",
            textShadow: "0 1px 10px rgba(0,0,0,0.5)",
          }}
        >
          {card.quote}
        </p>
        {card.attribution ? (
          <p
            style={{
              margin: "0.4rem 0 0",
              width: "100%",
              textAlign: "center",
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
              fontSize: "clamp(0.68rem, 2.8vw, 0.78rem)",
              lineHeight: 1.3,
              letterSpacing: "0.04em",
              fontStyle: "normal",
              color: "rgba(180,190,210,0.58)",
              textShadow: "0 1px 8px rgba(0,0,0,0.45)",
            }}
          >
            {card.attribution}
          </p>
        ) : null}
      </div>
    </div>
  );
}
