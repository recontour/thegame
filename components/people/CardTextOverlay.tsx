"use client";

import type { StoryCard } from "@/data/people";

type CardTextOverlayProps = {
  card: StoryCard | null;
  /** 0..1 visibility after focus settles */
  visible: boolean;
  /**
   * Top of free space under the focused image (0 = top of stage, 1 = bottom).
   * Text is vertically centered in [bandTop … bottom].
   */
  bandTop?: number;
};

/**
 * HTML overlay — crisp title, body, quote under the focused card.
 * Vertically centers copy in whatever space remains below the image.
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
        padding: "0 1.25rem",
        pointerEvents: "none",
        zIndex: 5,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: visible ? 1 : 0,
        transform: visible ? "translate3d(0,0,0)" : "translate3d(0, 10px, 0)",
        transition:
          "opacity 0.55s ease, transform 0.55s ease, top 0.35s ease-out",
        textAlign: "center",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: "100%",
          // If copy is taller than the band, allow gentle scroll-less clamp
          maxHeight: "100%",
          overflow: "hidden",
        }}
      >
        <p
          style={{
            margin: "0 0 0.55rem",
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
            fontSize: "clamp(0.65rem, 2.6vw, 0.72rem)",
            lineHeight: 1.3,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 500,
            color: "rgba(210,218,235,0.55)",
            textShadow: "0 1px 10px rgba(0,0,0,0.5)",
          }}
        >
          {card.title}
        </p>
        <p
          style={{
            margin: "0 0 0.7rem",
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
            fontSize: "clamp(0.72rem, 3.1vw, 0.86rem)",
            lineHeight: 1.42,
            letterSpacing: "0.015em",
            fontWeight: 400,
            color: "rgba(245,245,250,0.9)",
            whiteSpace: "pre-line",
            textShadow: "0 1px 12px rgba(0,0,0,0.55)",
          }}
        >
          {card.body}
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: 'ui-serif, Georgia, "Times New Roman", serif',
            fontSize: "clamp(0.68rem, 2.9vw, 0.8rem)",
            lineHeight: 1.4,
            fontStyle: "italic",
            letterSpacing: "0.01em",
            color: "rgba(200,210,230,0.78)",
            whiteSpace: "pre-line",
            textShadow: "0 1px 10px rgba(0,0,0,0.5)",
          }}
        >
          {card.quote}
        </p>
        {card.attribution ? (
          <p
            style={{
              margin: "0.35rem 0 0",
              fontFamily:
                'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
              fontSize: "clamp(0.6rem, 2.5vw, 0.7rem)",
              lineHeight: 1.3,
              letterSpacing: "0.04em",
              fontStyle: "normal",
              color: "rgba(180,190,210,0.55)",
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
