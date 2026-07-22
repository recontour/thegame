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
const ANIM_OUT = 0.36;
const ANIM_IN = 0.55;

function applyRest(
  el: HTMLElement,
  rest: Pick<
    ScatterPiece,
    | "left"
    | "top"
    | "width"
    | "rotate"
    | "opacity"
    | "zIndex"
  >,
  animate: boolean,
) {
  const vars = {
    left: `${rest.left}%`,
    top: `${rest.top}%`,
    width: `${rest.width}vw`,
    xPercent: 0,
    yPercent: 0,
    x: 0,
    y: 0,
    scale: 1,
    rotation: rest.rotate,
    opacity: rest.opacity,
    zIndex: rest.zIndex,
    filter: "saturate(0.92) contrast(0.96) brightness(0.94)",
  };

  if (animate) {
    return gsap.to(el, {
      ...vars,
      duration: ANIM_OUT,
      ease: "power3.inOut",
      overwrite: "auto",
    });
  }

  gsap.set(el, vars);
  return null;
}

function applyPromoted(el: HTMLElement, animate: boolean) {
  const vars = {
    left: "50%",
    top: "50%",
    width: `${PROMOTED_WIDTH_VW}vw`,
    maxWidth: `${PROMOTED_MAX_PX}px`,
    maxHeight: "92dvh",
    xPercent: -50,
    yPercent: -50,
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    opacity: 1,
    zIndex: 50,
    filter: "none",
  };

  if (animate) {
    return gsap.to(el, {
      ...vars,
      duration: ANIM_IN,
      ease: "power3.out",
      overwrite: "auto",
    });
  }

  gsap.set(el, vars);
  return null;
}

/**
 * Unified living collage:
 * - Many tiles (thumbs reused) carpet the full background
 * - One primary tile per photo promotes from the mess to center
 */
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

  /** piece array index of the primary tile for each photoIndex */
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

  // Mount: place all tiles, promote first primary from the mess
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
          { opacity: 1, duration: 0.4, ease: "power2.out" },
        );
      }

      const primary0 = primaryPieceIndex[0];
      const first = primary0 >= 0 ? els[primary0] : null;
      if (first) {
        gsap.delayedCall(0.12, () => applyPromoted(first, true));
      } else {
        console.warn("[collage] missing primary tile for photo 0");
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

      // Demote: land in a fresh scatter pose inside the carpet
      const newRest = {
        ...restsRef.current[fromPi],
        ...restPoseFor(from, count, seedRef.current),
      };
      restsRef.current[fromPi] = newRest;
      const outTween = applyRest(fromEl, newRest, true);

      // Promote: rise from its seat in the mess
      const inTween = gsap.delayedCall(0.06, () => {
        applyPromoted(toEl, true);
      });

      const done = () => {
        indexRef.current = to;
        setIndex(to);
        busy.current = false;
      };

      if (outTween) outTween.eventCallback("onComplete", done);
      else gsap.delayedCall(ANIM_IN + 0.08, done);

      gsap.delayedCall(ANIM_OUT + ANIM_IN + 0.05, () => {
        if (busy.current) {
          busy.current = false;
          indexRef.current = to;
          setIndex(to);
        }
        inTween.kill();
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
      {/* Full-bleed collage carpet */}
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
                promoted ? "collage-piece is-promoted" : "collage-piece"
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
                    console.warn(
                      "[collage] thumb failed, using full-res",
                      photo.thumb,
                    );
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
          0%, 100% { translate: 0 0; }
          50% { translate: var(--dx, 8px) var(--dy, 6px); }
        }
        .collage-piece:not(.is-promoted) {
          animation: collageDrift var(--dur, 10s) ease-in-out infinite;
          animation-delay: var(--delay, 0s);
        }
        .collage-piece.is-promoted {
          animation: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .collage-piece { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
