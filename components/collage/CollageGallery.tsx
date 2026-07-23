"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import type { Series } from "@/data/series";
import {
  buildHomeLayout,
  homeWithNudge,
  type ScatterPiece,
} from "@/components/collage/scatter";
import { useCollageFlick } from "@/components/collage/useCollageFlick";

type CollageGalleryProps = {
  series: Series;
  onIndexChange?: (index: number) => void;
};

const PROMOTED_WIDTH_VW = 95;
const PROMOTED_MAX_PX = 1600;

/** Fairy-tale pacing — out → breath → in */
const OUT_MIN = 1.35;
const OUT_MAX = 1.75;
const BREATH_MIN = 0.45;
const BREATH_MAX = 0.75;
const IN_MIN = 1.65;
const IN_MAX = 2.15;

type RestPose = Pick<
  ScatterPiece,
  "left" | "top" | "width" | "rotate" | "opacity" | "zIndex"
>;

function vary(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/**
 * Shared center-anchored layout so rest ↔ promote interpolates cleanly.
 */
function layoutVars(pose: {
  left: number | string;
  top: number | string;
  width: string;
  rotate: number;
  opacity: number;
  zIndex: number;
  filter: string;
  maxWidth?: string;
  maxHeight?: string;
}) {
  return {
    left: typeof pose.left === "number" ? `${pose.left}%` : pose.left,
    top: typeof pose.top === "number" ? `${pose.top}%` : pose.top,
    width: pose.width,
    maxWidth: pose.maxWidth ?? "none",
    maxHeight: pose.maxHeight ?? "none",
    xPercent: -50,
    yPercent: -50,
    x: 0,
    y: 0,
    scale: 1,
    rotation: pose.rotate,
    opacity: pose.opacity,
    zIndex: pose.zIndex,
    filter: pose.filter,
    translate: "none",
  };
}

function applyRest(el: HTMLElement, rest: RestPose, animate: boolean) {
  el.classList.add("is-settling");
  el.classList.remove("is-promoted");

  const vars = layoutVars({
    left: rest.left,
    top: rest.top,
    width: `${rest.width}vw`,
    rotate: rest.rotate,
    opacity: rest.opacity,
    zIndex: rest.zIndex,
    filter: "saturate(0.95) contrast(0.98) brightness(0.98)",
  });

  if (animate) {
    return gsap.to(el, {
      ...vars,
      duration: vary(OUT_MIN, OUT_MAX),
      ease: "sine.inOut",
      overwrite: "auto",
      onComplete: () => el.classList.remove("is-settling"),
    });
  }

  gsap.set(el, vars);
  el.classList.remove("is-settling");
  return null;
}

function applyPromoted(
  el: HTMLElement,
  animate: boolean,
  duration = vary(IN_MIN, IN_MAX),
) {
  el.classList.add("is-settling", "is-promoted");

  const vars = layoutVars({
    left: 50,
    top: 50,
    width: `${PROMOTED_WIDTH_VW}vw`,
    maxWidth: `${PROMOTED_MAX_PX}px`,
    maxHeight: "92dvh",
    rotate: 0,
    opacity: 1,
    zIndex: 50,
    filter: "none",
  });

  if (animate) {
    return gsap.to(el, {
      ...vars,
      duration,
      ease: "power3.out",
      overwrite: "auto",
      onComplete: () => el.classList.remove("is-settling"),
    });
  }

  gsap.set(el, vars);
  el.classList.remove("is-settling");
  return null;
}

/**
 * Exactly one tile per series photo.
 * Promote/demote always moves that same node — nothing appears from nowhere.
 */
export default function CollageGallery({
  series,
  onIndexChange,
}: CollageGalleryProps) {
  const photos = series.photos;
  const count = photos.length;

  const homes = useMemo(() => buildHomeLayout(count), [count]);

  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const busy = useRef(false);
  const seedRef = useRef(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const pieceRefs = useRef<(HTMLDivElement | null)[]>([]);
  /** Current rest pose per photo (starts as home, tiny nudge on demote) */
  const restsRef = useRef<ScatterPiece[]>(homes.map((h) => ({ ...h })));

  useEffect(() => {
    restsRef.current = homes.map((h) => ({ ...h }));
  }, [homes]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const els = pieceRefs.current;
      restsRef.current.forEach((rest, i) => {
        const el = els[i];
        if (el) applyRest(el, rest, false);
      });

      const stage = stageRef.current;
      if (stage) {
        gsap.fromTo(
          stage,
          { opacity: 0 },
          { opacity: 1, duration: 0.5, ease: "power2.out" },
        );
      }

      const first = els[0];
      if (first) {
        gsap.delayedCall(0.4, () => {
          applyPromoted(first, true, vary(1.8, 2.2));
        });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [count]);

  useEffect(() => {
    onIndexChange?.(index);
  }, [index, onIndexChange]);

  const go = useCallback(
    (dir: 1 | -1) => {
      if (busy.current || count < 2) return;

      const from = indexRef.current;
      const to = (from + dir + count) % count;
      const fromEl = pieceRefs.current[from];
      const toEl = pieceRefs.current[to];
      if (!fromEl || !toEl) return;

      busy.current = true;
      seedRef.current += 1;

      fromEl.classList.add("is-settling");
      toEl.classList.add("is-settling");
      gsap.set([fromEl, toEl], { translate: "none" });

      // Return to its known home in the collage (slight nudge only)
      const home = homes[from] ?? restsRef.current[from];
      const newRest = homeWithNudge(home, seedRef.current);
      restsRef.current[from] = newRest;

      const outDur = vary(OUT_MIN, OUT_MAX);
      const breath = vary(BREATH_MIN, BREATH_MAX);
      const inDur = vary(IN_MIN, IN_MAX);

      const tl = gsap.timeline({
        onComplete: () => {
          indexRef.current = to;
          setIndex(to);
          busy.current = false;
          fromEl.classList.remove("is-settling");
          toEl.classList.remove("is-settling");
        },
      });

      // 1) Focused image slowly returns to its place in the mess
      tl.call(() => {
        fromEl.classList.remove("is-promoted");
      });

      tl.to(fromEl, {
        ...layoutVars({
          left: newRest.left,
          top: newRest.top,
          width: `${newRest.width}vw`,
          rotate: newRest.rotate,
          opacity: newRest.opacity,
          zIndex: newRest.zIndex,
          filter: "saturate(0.95) contrast(0.98) brightness(0.98)",
        }),
        duration: outDur,
        ease: "sine.inOut",
        overwrite: "auto",
      });

      // 2) Pause — it’s home
      tl.to({}, { duration: breath });

      // 3) The chosen collage image (already visible) rises into focus
      tl.call(() => {
        toEl.classList.add("is-promoted");
      });

      tl.to(toEl, {
        ...layoutVars({
          left: 50,
          top: 50,
          width: `${PROMOTED_WIDTH_VW}vw`,
          maxWidth: `${PROMOTED_MAX_PX}px`,
          maxHeight: "92dvh",
          rotate: 0,
          opacity: 1,
          zIndex: 50,
          filter: "none",
        }),
        duration: inDur,
        ease: "power3.out",
        overwrite: "auto",
      });
    },
    [count, homes],
  );

  const next = useCallback(() => go(1), [go]);
  const prev = useCallback(() => go(-1), [go]);

  useCollageFlick({
    enabled: true,
    onNext: next,
    onPrev: prev,
  });

  return (
    <div
      ref={stageRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1,
        background: "#000000",
        overflow: "hidden",
        touchAction: "none",
        userSelect: "none",
        opacity: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          // Side bleed ok; keep top/bottom locked to the viewport band
          top: 0,
          bottom: 0,
          left: "-10%",
          right: "-10%",
          zIndex: 1,
          overflow: "hidden",
        }}
      >
        {photos.map((photo, i) => {
          const rest = restsRef.current[i] ?? homes[i];
          const promoted = i === index;

          return (
            <div
              key={photo.id}
              ref={(el) => {
                pieceRefs.current[i] = el;
              }}
              className={
                promoted
                  ? "collage-piece is-promoted"
                  : "collage-piece is-resting"
              }
              style={{
                position: "absolute",
                transformOrigin: "50% 50%",
                willChange: "transform, opacity, left, top, width",
                pointerEvents: "none",
                ["--dx" as string]: `${rest?.driftX ?? 6}px`,
                ["--dy" as string]: `${rest?.driftY ?? 5}px`,
                ["--dur" as string]: `${rest?.driftDur ?? 10}s`,
                ["--delay" as string]: `${(i % 6) * -1.1}s`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumb}
                alt={photo.alt ?? ""}
                draggable={false}
                loading="eager"
                decoding="async"
                onError={(e) => {
                  const el = e.currentTarget;
                  if (el.src !== photo.src && !el.dataset.fallback) {
                    el.dataset.fallback = "1";
                    el.src = photo.src;
                  }
                }}
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  maxHeight: "inherit",
                  objectFit: "cover",
                }}
              />
            </div>
          );
        })}
      </div>

      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          bottom: "clamp(1.2rem, 3.5vh, 2rem)",
          transform: "translateX(-50%)",
          zIndex: 60,
          display: "flex",
          gap: 6,
          pointerEvents: "none",
        }}
      >
        {photos.map((p, i) => (
          <span
            key={p.id}
            style={{
              width: i === index ? 14 : 4,
              height: 2,
              borderRadius: 1,
              background:
                i === index
                  ? "rgba(255,255,255,0.5)"
                  : "rgba(255,255,255,0.14)",
              transition: "width 0.25s ease, background 0.25s ease",
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes collageDrift {
          0%, 100% { translate: 0px 0px; }
          50% { translate: var(--dx, 8px) var(--dy, 6px); }
        }
        /* Gentle drift only while resting in the collage */
        .collage-piece.is-resting:not(.is-settling) {
          animation: collageDrift var(--dur, 10s) ease-in-out infinite;
          animation-delay: var(--delay, 0s);
        }
        .collage-piece.is-promoted,
        .collage-piece.is-settling {
          animation: none !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .collage-piece { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
