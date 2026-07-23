"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import type { Series } from "@/data/series";
import {
  buildCollagePieces,
  restPoseFor,
  type ScatterPiece,
} from "@/components/collage/scatter";
import { useCollageFlick } from "@/components/collage/useCollageFlick";

type CollageGalleryProps = {
  series: Series;
  onIndexChange?: (index: number) => void;
};

const PROMOTED_WIDTH_VW = 95;
const PROMOTED_MAX_PX = 1600;

/**
 * Fairy-tale pacing — sequential, unhurried, deliberate.
 * Out → breath → in. No snappy overlap.
 */
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
 * Shared layout model for rest + promoted:
 * always center-anchored (xPercent/yPercent -50) so left/top/width
 * interpolate without a mid-flight snap.
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
    // Clear any CSS translate leftover from idle drift
    translate: "none",
  };
}

function applyRest(el: HTMLElement, rest: RestPose, animate: boolean) {
  // Kill CSS idle animation before tweening so it can't fight GSAP
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
      onComplete: () => {
        el.classList.remove("is-settling");
      },
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
      // Long decelerating float into place
      ease: "power3.out",
      overwrite: "auto",
      onComplete: () => {
        el.classList.remove("is-settling");
      },
    });
  }

  gsap.set(el, vars);
  el.classList.remove("is-settling");
  return null;
}

export default function CollageGallery({
  series,
  onIndexChange,
}: CollageGalleryProps) {
  const photos = series.photos;
  const count = photos.length;

  const layoutSeed = useRef(0);
  const pieces = useMemo(
    () => buildCollagePieces(count, layoutSeed.current),
    [count],
  );

  const primaryPieceIndex = useMemo(() => {
    const map = new Array<number>(count).fill(-1);
    pieces.forEach((p, i) => {
      if (p.isPrimary && map[p.photoIndex] < 0) map[p.photoIndex] = i;
    });
    return map;
  }, [pieces, count]);

  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const busy = useRef(false);
  const seedRef = useRef(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const pieceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const restsRef = useRef<ScatterPiece[]>(pieces);

  useEffect(() => {
    restsRef.current = pieces;
  }, [pieces]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const els = pieceRefs.current;
      restsRef.current.forEach((rest, i) => {
        const el = els[i];
        if (!el) return;
        applyRest(el, rest, false);
      });

      const stage = stageRef.current;
      if (stage) {
        gsap.fromTo(
          stage,
          { opacity: 0 },
          { opacity: 1, duration: 0.45, ease: "power2.out" },
        );
      }

      const primary0 = primaryPieceIndex[0];
      const first = primary0 >= 0 ? els[primary0] : null;
      if (first) {
        // Opening: long, soft rise from the mess
        gsap.delayedCall(0.35, () => {
          applyPromoted(first, true, vary(1.8, 2.2));
        });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [count, primaryPieceIndex]);

  useEffect(() => {
    onIndexChange?.(index);
  }, [index, onIndexChange]);

  const go = useCallback(
    (dir: 1 | -1) => {
      if (busy.current || count < 2) return;

      const from = indexRef.current;
      const to = (from + dir + count) % count;
      const fromPi = primaryPieceIndex[from];
      const toPi = primaryPieceIndex[to];
      const fromEl = fromPi >= 0 ? pieceRefs.current[fromPi] : null;
      const toEl = toPi >= 0 ? pieceRefs.current[toPi] : null;
      if (!fromEl || !toEl) return;

      busy.current = true;
      seedRef.current += 1;

      fromEl.classList.add("is-settling");
      toEl.classList.add("is-settling");
      gsap.set([fromEl, toEl], { translate: "none" });

      const newRest = {
        ...restsRef.current[fromPi],
        ...restPoseFor(from, seedRef.current),
      };
      restsRef.current[fromPi] = newRest as ScatterPiece;

      const outDur = vary(OUT_MIN, OUT_MAX);
      const breath = vary(BREATH_MIN, BREATH_MAX);
      const inDur = vary(IN_MIN, IN_MAX);

      // Fairy-tale sequence: leave → rest in the void → next arrives
      const tl = gsap.timeline({
        onComplete: () => {
          indexRef.current = to;
          setIndex(to);
          busy.current = false;
          fromEl.classList.remove("is-settling");
          toEl.classList.remove("is-settling");
        },
      });

      tl.call(() => {
        fromEl.classList.remove("is-promoted");
      });

      // 1) Current drifts back into the collage and settles
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

      // 2) Hold — let it sit in the mess a beat
      tl.to({}, { duration: breath });

      // 3) Next slowly lifts from its seat into the center
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
    [count, primaryPieceIndex],
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
          inset: "-28%",
          zIndex: 1,
        }}
      >
        {pieces.map((piece, i) => {
          const photo = photos[piece.photoIndex];
          if (!photo) return null;
          const promoted =
            piece.isPrimary && piece.photoIndex === index;

          return (
            <div
              key={piece.id}
              ref={(el) => {
                pieceRefs.current[i] = el;
              }}
              className={
                promoted
                  ? "collage-piece is-promoted"
                  : piece.isPrimary
                    ? "collage-piece is-primary"
                    : "collage-piece is-filler"
              }
              style={{
                position: "absolute",
                transformOrigin: "50% 50%",
                willChange: "transform, opacity, left, top, width",
                pointerEvents: "none",
                ["--dx" as string]: `${piece.driftX}px`,
                ["--dy" as string]: `${piece.driftY}px`,
                ["--dur" as string]: `${piece.driftDur}s`,
                ["--delay" as string]: `${(i % 8) * -0.85}s`,
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
        /* Only non-primary fillers drift — primaries stay GSAP-clean (no snap) */
        .collage-piece.is-filler:not(.is-settling) {
          animation: collageDrift var(--dur, 10s) ease-in-out infinite;
          animation-delay: var(--delay, 0s);
        }
        .collage-piece.is-primary,
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
