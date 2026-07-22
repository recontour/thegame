"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { Series } from "@/data/series";
import {
  buildScatter,
  scatterForIndex,
  type ScatterPiece,
} from "@/components/collage/scatter";
import { useCollageFlick } from "@/components/collage/useCollageFlick";

type CollageGalleryProps = {
  series: Series;
  onIndexChange?: (index: number) => void;
};

// ~2–3% side padding each side → ~94–96vw wide
const PROMOTED_WIDTH_VW = 95;
const PROMOTED_MAX_PX = 1600; // don't cap hard on desktop; let vw lead
const ANIM_OUT = 0.36;
const ANIM_IN = 0.55;

function applyRest(el: HTMLElement, rest: ScatterPiece, animate: boolean) {
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
    filter: "saturate(0.9) contrast(0.95) brightness(0.9)",
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
    // ~2.5% inset each side; height capped so tall frames still fit
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
    zIndex: 40,
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
 * One living collage: every image is a single DOM node in the mess.
 * The focused image is the same node, promoted to center — not a second layer.
 * Thumbs only (no full-res).
 */
export default function CollageGallery({
  series,
  onIndexChange,
}: CollageGalleryProps) {
  const photos = series.photos;
  const count = photos.length;

  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const busy = useRef(false);
  const seedRef = useRef(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const pieceRefs = useRef<(HTMLDivElement | null)[]>([]);
  const restsRef = useRef<ScatterPiece[]>(buildScatter(count, 0));

  // Mount: place everyone in the mess, then promote the first piece
  useEffect(() => {
    const pieces = pieceRefs.current;
    restsRef.current = buildScatter(count, 0);

    pieces.forEach((el, i) => {
      if (!el) return;
      if (i === 0) {
        // Start in collage, then rise — so it always “comes from” the mess
        applyRest(el, restsRef.current[i], false);
      } else {
        applyRest(el, restsRef.current[i], false);
      }
    });

    const first = pieces[0];
    const stage = stageRef.current;
    if (stage) {
      gsap.fromTo(
        stage,
        { opacity: 0 },
        { opacity: 1, duration: 0.4, ease: "power2.out" },
      );
    }

    if (first) {
      // Brief beat in the collage, then promote
      gsap.delayedCall(0.12, () => {
        applyPromoted(first, true);
      });
    }
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

      // New rest pose for the demoted image so it falls into a fresh spot
      const newRest = scatterForIndex(from, count, seedRef.current);
      restsRef.current[from] = newRest;

      // Demote current: shrink / fade / drift back into the mess
      const outTween = applyRest(fromEl, newRest, true);

      // Promote next: rise from its current collage seat into the center
      // Slight delay so they cross in the void
      const inTween = gsap.delayedCall(0.06, () => {
        applyPromoted(toEl, true);
      });

      const done = () => {
        indexRef.current = to;
        setIndex(to);
        busy.current = false;
      };

      if (outTween) {
        outTween.eventCallback("onComplete", done);
      } else {
        gsap.delayedCall(ANIM_IN + 0.08, done);
      }

      // Safety unlock
      gsap.delayedCall(ANIM_OUT + ANIM_IN + 0.05, () => {
        if (busy.current) {
          busy.current = false;
          indexRef.current = to;
          setIndex(to);
        }
        inTween.kill();
      });
    },
    [count],
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
      {/* Single layer — every image lives here */}
      <div
        style={{
          position: "absolute",
          inset: "-18%",
          zIndex: 1,
        }}
      >
        {photos.map((photo, i) => {
          const rest = restsRef.current[i];
          const promoted = i === index;
          return (
            <div
              key={photo.id}
              ref={(el) => {
                pieceRefs.current[i] = el;
              }}
              className={
                promoted ? "collage-piece is-promoted" : "collage-piece"
              }
              style={{
                position: "absolute",
                // left/top/width/opacity owned by GSAP after mount — avoid React overwrites
                transformOrigin: "50% 50%",
                willChange: "transform, opacity, left, top, width",
                pointerEvents: "none",
                ["--dx" as string]: `${rest?.driftX ?? 6}px`,
                ["--dy" as string]: `${rest?.driftY ?? 5}px`,
                ["--dur" as string]: `${rest?.driftDur ?? 10}s`,
                ["--delay" as string]: `${(i % 5) * -1.2}s`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumb}
                alt={photo.alt ?? ""}
                draggable={false}
                loading="eager"
                decoding="async"
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  maxHeight: "inherit",
                  objectFit: "contain",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Minimal progress */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          bottom: "clamp(1.2rem, 3.5vh, 2rem)",
          transform: "translateX(-50%)",
          zIndex: 50,
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
