"use client";

import { useEffect, useRef } from "react";
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
  /**
   * Live presentation 0 = full-bleed, 1 = framed.
   * Driven every frame via rAF — no React lag on mobile.
   */
  presentRef: React.MutableRefObject<number>;
  /** Live parallax energy from the scene (+ = advancing) */
  motionRef: React.MutableRefObject<number>;
  /**
   * Top of free space under the focused image (0 = top of stage, 1 = bottom).
   */
  bandTop?: number;
  enabled?: boolean;
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** easeOutBack — soft bounce into place from below */
function easeOutBack(t: number): number {
  const c1 = 1.45;
  const c3 = c1 + 1;
  const u = clamp01(t);
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
}

/**
 * Copy lives under the photo and is timed to present/motion.
 *
 * Enter (present ↑): slides up from below the frame, staggered.
 * Exit  (present ↓): same path reversed — drops back down out of focus.
 *
 *   1. Title first (parallax)
 *   2. Body bounce
 *   3. Quote quick
 */
export default function CardTextOverlay({
  card,
  presentRef,
  motionRef,
  bandTop = 0.55,
  enabled = true,
}: CardTextOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const quoteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;

    const tick = () => {
      const present = enabled ? clamp01(presentRef.current) : 0;
      const motion = motionRef.current;

      // Staggered rise from bottom (and reverse exit downward when present falls)
      const titleT = smoothstep(0.06, 0.42, present);
      const bodyRaw = smoothstep(0.22, 0.6, present);
      const bodyT = easeOutBack(bodyRaw);
      const quoteT = smoothstep(0.38, 0.7, present);

      // Off-frame distance (px) — enough to clear the band
      const OFF = 110;

      const titleEl = titleRef.current;
      if (titleEl) {
        // Start fully below; settle at 0. Light parallax on top.
        const fromBottom = (1 - titleT) * OFF;
        const paraY = -motion * 10 * titleT;
        titleEl.style.opacity = String(titleT);
        titleEl.style.transform = `translate3d(0, ${fromBottom + paraY}px, 0)`;
      }

      const bodyEl = bodyRef.current;
      if (bodyEl) {
        // Bounce uses overshoot of bodyT (>1 briefly) as a slight lift past rest
        const fromBottom = (1 - clamp01(bodyT)) * (OFF + 16);
        const overshootY = bodyT > 1 ? -(bodyT - 1) * 18 : 0;
        const scale = 0.96 + clamp01(bodyT) * 0.04;
        bodyEl.style.opacity = String(clamp01(bodyT));
        bodyEl.style.transform = `translate3d(0, ${fromBottom + overshootY}px, 0) scale(${scale})`;
      }

      const quoteEl = quoteRef.current;
      if (quoteEl) {
        const fromBottom = (1 - quoteT) * (OFF + 8);
        quoteEl.style.opacity = String(quoteT);
        quoteEl.style.transform = `translate3d(0, ${fromBottom}px, 0)`;
      }

      const root = rootRef.current;
      if (root) {
        // Keep visible while anything is mid-enter or mid-exit
        root.style.visibility = present > 0.02 ? "visible" : "hidden";
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [presentRef, motionRef, enabled, card?.id]);

  if (!card) return null;

  const topPct = `${(bandTop * 100).toFixed(2)}%`;

  return (
    <div
      ref={rootRef}
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
        gridTemplateRows: "auto auto 1fr",
        alignItems: "stretch",
        rowGap: "0.15rem",
        // Clip so rising/falling copy stays out of the photo
        overflow: "hidden",
        boxSizing: "border-box",
        transition: "top 0.35s ease-out",
        visibility: "hidden",
      }}
    >
      {/* Title — from bottom + parallax */}
      <div
        ref={titleRef}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 0,
          width: "100%",
          padding: "0.55rem 0 0.18rem",
          opacity: 0,
          willChange: "transform, opacity",
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

      {/* Body — from bottom with bounce */}
      <p
        ref={bodyRef}
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
          opacity: 0,
          transformOrigin: "center bottom",
          willChange: "transform, opacity",
        }}
      >
        {card.body}
      </p>

      {/* Quote — from bottom, quick */}
      <div
        ref={quoteRef}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 0,
          width: "100%",
          paddingTop: "0.2rem",
          opacity: 0,
          willChange: "transform, opacity",
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
