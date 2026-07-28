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
   *   title  — tight under the image
   *   body   — left-aligned description
   *   quote  — remaining space toward the bottom
   */
  bandTop?: number;
};

/**
 * HTML overlay under the focused card.
 * Title padding stays tight so copy fits on short mobile bands
 * (e.g. What Remains).
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
        bottom: "max(0.5rem, env(safe-area-inset-bottom))",
        padding: "0 3%",
        pointerEvents: "none",
        zIndex: 5,
        display: "grid",
        // Title + body hug content; leftover air goes under the quote
        gridTemplateRows: "auto auto 1fr",
        alignItems: "stretch",
        rowGap: "0.15rem",
        opacity: visible ? 1 : 0,
        transform: visible ? "translate3d(0,0,0)" : "translate3d(0, 14px, 0)",
        transition:
          "opacity 1.1s cubic-bezier(0.22, 0.61, 0.36, 1), transform 1.15s cubic-bezier(0.22, 0.61, 0.36, 1), top 0.55s ease-out",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {/* Title — Special Elite, tight under the image */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 0,
          width: "100%",
          // Space under the photo without reopening a huge flexible title zone
          padding: "0.55rem 0 0.18rem",
        }}
      >
        <p
          className={specialElite.className}
          style={{
            margin: 0,
            width: "100%",
            textAlign: "center",
            fontSize: "clamp(0.98rem, 4.2vw, 1.28rem)",
            lineHeight: 1.2,
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
          fontSize: "clamp(0.98rem, 4.1vw, 1.22rem)",
          lineHeight: 1.35,
          letterSpacing: "0.01em",
          fontWeight: 500,
          color: "rgba(248,248,252,0.94)",
          whiteSpace: "pre-line",
          textShadow: "0 1px 12px rgba(0,0,0,0.55)",
        }}
      >
        {card.body}
      </p>

      {/* Quote — sits in whatever room is left */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 0,
          width: "100%",
          paddingTop: "0.2rem",
        }}
      >
        <p
          style={{
            margin: 0,
            width: "100%",
            textAlign: "center",
            fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
            fontSize: "clamp(0.78rem, 3.3vw, 0.95rem)",
            lineHeight: 1.35,
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
              margin: "0.28rem 0 0",
              width: "100%",
              textAlign: "center",
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
              fontSize: "clamp(0.64rem, 2.6vw, 0.75rem)",
              lineHeight: 1.25,
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
