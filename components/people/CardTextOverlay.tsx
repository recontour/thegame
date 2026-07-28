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

/** Soft overshoot at the end of the rise */
function easeOutBack(t: number): number {
  const c1 = 1.35;
  const c3 = c1 + 1;
  const u = clamp01(t);
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
}

/**
 * Copy under the photo — rises from fully below the stage (out of frame /
 * out of focus), then settles. Exit reverses: drops back under the fold.
 *
 * Important: offsets are in *band height* / stage px, not a tiny 100px nudge
 * (that looked like text spawning mid-page).
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
      const root = rootRef.current;

      // How far "below the fold" is — at least the full band height so copy
      // starts completely under the stage bottom, never mid-screen.
      let offPx = 280;
      if (root) {
        const bandH = root.clientHeight || 0;
        const stageH = root.parentElement?.clientHeight ?? 0;
        // Prefer full band; also clear a chunk of stage so it feels off-frame
        offPx = Math.max(bandH + 24, stageH * 0.42, 200);
      }

      // Stagger: title leads, body, then quote — all share the same path up
      const titleT = smoothstep(0.05, 0.48, present);
      const bodyT = easeOutBack(smoothstep(0.18, 0.62, present));
      const quoteT = smoothstep(0.32, 0.72, present);

      const titleEl = titleRef.current;
      if (titleEl) {
        const t = titleT;
        // Fully below when t=0; rest when t=1. Parallax only once visible.
        const y = (1 - t) * offPx - motion * 12 * t;
        const blur = (1 - t) * 10;
        titleEl.style.opacity = String(t);
        titleEl.style.filter = blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : "none";
        titleEl.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      }

      const bodyEl = bodyRef.current;
      if (bodyEl) {
        const t = clamp01(bodyT);
        // easeOutBack can overshoot >1 → slight lift past rest
        const y =
          (1 - t) * (offPx * 1.05) -
          (bodyT > 1 ? (bodyT - 1) * 14 : 0);
        const blur = (1 - t) * 12;
        const scale = 0.97 + t * 0.03;
        bodyEl.style.opacity = String(t);
        bodyEl.style.filter = blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : "none";
        bodyEl.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
      }

      const quoteEl = quoteRef.current;
      if (quoteEl) {
        const t = quoteT;
        const y = (1 - t) * (offPx * 1.08);
        const blur = (1 - t) * 8;
        quoteEl.style.opacity = String(t);
        quoteEl.style.filter = blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : "none";
        quoteEl.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      }

      if (root) {
        // Visible for enter *and* exit (while still sliding under the fold)
        root.style.visibility = present > 0.015 ? "visible" : "hidden";
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
        // Clip so rising copy never paints over the photo mid-rise
        overflow: "hidden",
        boxSizing: "border-box",
        transition: "top 0.35s ease-out",
        visibility: "hidden",
      }}
    >
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
          willChange: "transform, opacity, filter",
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
          willChange: "transform, opacity, filter",
        }}
      >
        {card.body}
      </p>

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
          willChange: "transform, opacity, filter",
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
