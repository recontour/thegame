"use client";

import { useEffect, useRef, useState } from "react";
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
  /** Desired card for the current story index (may change mid-swipe) */
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

/** Same hermite the photo morph uses — one shared ease curve */
function hermite(t: number): number {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
}

/**
 * Map present → layer progress with a small delay, same duration window.
 * Keeps title/body/quote stitched to the photo beat (not independent physics).
 */
function layerT(present: number, delay: number, span = 0.78): number {
  return hermite(clamp01((present - delay) / span));
}

/**
 * Only swap title/body/quote once present is essentially 0 — content is
 * parked under the fold so the user never sees words rewrite mid-screen.
 */
const SWAP_BELOW = 0.05;

/**
 * Copy under the photo.
 *
 * Story `card` can change the moment you swipe. We keep painting the previous
 * copy until present has dropped (exit down complete), swap off-screen, then
 * the new copy rises on the next settle. No mid-page text reload.
 */
export default function CardTextOverlay({
  card,
  presentRef,
  motionRef,
  bandTop = 0.55,
  enabled = true,
}: CardTextOverlayProps) {
  /** What is actually painted (lags story index until safe) */
  const [shown, setShown] = useState<StoryCard | null>(card);
  const pendingRef = useRef<StoryCard | null>(card);
  const shownIdRef = useRef<string | null>(card?.id ?? null);

  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const quoteRef = useRef<HTMLDivElement>(null);

  // Remember latest desired card; never paint it until off-screen
  useEffect(() => {
    pendingRef.current = card;
  }, [card]);

  useEffect(() => {
    let raf = 0;

    const tick = () => {
      const present = enabled ? clamp01(presentRef.current) : 0;
      const motion = motionRef.current;
      const root = rootRef.current;
      const pending = pendingRef.current;

      // Swap only when fully under the fold (invisible)
      if (
        pending &&
        pending.id !== shownIdRef.current &&
        present <= SWAP_BELOW
      ) {
        shownIdRef.current = pending.id;
        setShown(pending);
      }

      // One clock with the photo: present 0 = full / text under fold,
      // present 1 = framed / text home. Light stagger only — no bounce physics.
      let offPx = 280;
      if (root) {
        const bandH = root.clientHeight || 0;
        const stageH = root.parentElement?.clientHeight ?? 0;
        offPx = Math.max(bandH + 32, stageH * 0.48, 220);
      }

      // Shared ease (matches FloatingCard blend feel), tiny cascade
      const titleT = layerT(present, 0.0, 0.78);
      const bodyT = layerT(present, 0.1, 0.78);
      const quoteT = layerT(present, 0.2, 0.78);

      const titleEl = titleRef.current;
      if (titleEl) {
        const t = titleT;
        // Pure rise from bottom; slight parallax only when nearly in
        const y = (1 - t) * offPx - motion * 8 * t;
        titleEl.style.opacity = String(t);
        titleEl.style.filter = "none";
        titleEl.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      }

      const bodyEl = bodyRef.current;
      if (bodyEl) {
        const t = bodyT;
        const y = (1 - t) * offPx;
        bodyEl.style.opacity = String(t);
        bodyEl.style.filter = "none";
        bodyEl.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      }

      const quoteEl = quoteRef.current;
      if (quoteEl) {
        const t = quoteT;
        const y = (1 - t) * offPx;
        quoteEl.style.opacity = String(t);
        quoteEl.style.filter = "none";
        quoteEl.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      }

      if (root) {
        root.style.visibility =
          enabled && present > 0.02 ? "visible" : "hidden";
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [presentRef, motionRef, enabled]);

  if (!shown) return null;

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
          {shown.title}
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
        {shown.body}
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
          {shown.quote}
        </p>
        {shown.attribution ? (
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
            {shown.attribution}
          </p>
        ) : null}
      </div>
    </div>
  );
}
