"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import type { Series } from "@/data/series";
import { buildScatter } from "@/components/collage/scatter";
import { useCollageFlick } from "@/components/collage/useCollageFlick";

type CollageGalleryProps = {
  series: Series;
  onIndexChange?: (index: number) => void;
};

/**
 * Chaotic thumbnail collage + one dead-center full-resolution photograph.
 * DOM-based for mobile performance and true image fidelity.
 */
export default function CollageGallery({
  series,
  onIndexChange,
}: CollageGalleryProps) {
  const photos = series.photos;
  const count = photos.length;
  const scatter = useMemo(() => buildScatter(count), [count]);

  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const busy = useRef(false);

  const heroWrapRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Preload full-res neighbors for snappy handoffs
  useEffect(() => {
    const preload = (src: string) => {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    };
    preload(photos[index]?.src ?? "");
    preload(photos[(index + 1) % count]?.src ?? "");
    preload(photos[(index - 1 + count) % count]?.src ?? "");
  }, [index, photos, count]);

  useEffect(() => {
    onIndexChange?.(index);
  }, [index, onIndexChange]);

  // Entrance: collage settles, hero snaps in
  useEffect(() => {
    const stage = stageRef.current;
    const hero = heroWrapRef.current;
    if (!stage || !hero) return;

    gsap.fromTo(
      stage,
      { opacity: 0 },
      { opacity: 1, duration: 0.45, ease: "power2.out" },
    );
    gsap.fromTo(
      hero,
      { y: 36, opacity: 0, scale: 0.94 },
      { y: 0, opacity: 1, scale: 1, duration: 0.5, ease: "power3.out", delay: 0.05 },
    );
  }, []);

  const go = useCallback(
    (dir: 1 | -1) => {
      if (busy.current || count < 2) return;
      const from = indexRef.current;
      const to = (from + dir + count) % count;
      const wrap = heroWrapRef.current;
      const img = heroImgRef.current;
      if (!wrap || !img) {
        indexRef.current = to;
        setIndex(to);
        return;
      }

      busy.current = true;
      const nextSrc = photos[to].src;

      // Preload next full-res, then run snappy handoff (once)
      let startedAnim = false;
      const run = () => {
        if (startedAnim) return;
        startedAnim = true;

        const tl = gsap.timeline({
          onComplete: () => {
            indexRef.current = to;
            setIndex(to);
            gsap.set(wrap, { y: 0, x: 0, opacity: 1, scale: 1, rotate: 0 });
            busy.current = false;
          },
        });

        // Current full-res flies out into the mess
        tl.to(
          wrap,
          {
            y: dir > 0 ? -140 : 140,
            x: dir > 0 ? 18 : -18,
            rotate: dir > 0 ? -6 : 6,
            scale: 0.82,
            opacity: 0,
            duration: 0.38,
            ease: "power3.in",
          },
          0,
        );

        // Swap source while off-screen, rise from opposite side
        tl.add(() => {
          img.src = nextSrc;
          gsap.set(wrap, {
            y: dir > 0 ? 160 : -160,
            x: dir > 0 ? -12 : 12,
            rotate: dir > 0 ? 5 : -5,
            scale: 0.88,
            opacity: 0,
          });
        });

        tl.to(wrap, {
          y: 0,
          x: 0,
          rotate: 0,
          scale: 1,
          opacity: 1,
          duration: 0.42,
          ease: "power3.out",
        });
      };

      const nextImage = new Image();
      nextImage.decoding = "async";
      nextImage.onload = run;
      nextImage.onerror = run;
      nextImage.src = nextSrc;
      if (nextImage.complete) run();
    },
    [count, photos],
  );

  const next = useCallback(() => go(1), [go]);
  const prev = useCallback(() => go(-1), [go]);

  useCollageFlick({
    enabled: true,
    onNext: next,
    onPrev: prev,
  });

  const current = photos[index];

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
      {/* Living collage — thumbnails only */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-8%",
          zIndex: 1,
          pointerEvents: "none",
        }}
      >
        {photos.map((photo, i) => {
          const s = scatter[i];
          if (!s) return null;
          const isFocus = i === index;
          return (
            <div
              key={photo.id}
              className="collage-piece"
              style={{
                position: "absolute",
                left: `${s.left}%`,
                top: `${s.top}%`,
                width: `${s.width}vw`,
                maxWidth: 280,
                zIndex: s.zIndex,
                opacity: isFocus ? s.opacity * 0.55 : s.opacity,
                transform: `rotate(${s.rotate}deg)`,
                // CSS variables for idle drift
                ["--dx" as string]: `${s.driftX}px`,
                ["--dy" as string]: `${s.driftY}px`,
                ["--dur" as string]: `${s.driftDur}s`,
                ["--delay" as string]: `${(i % 5) * -1.1}s`,
                transition: "opacity 0.35s ease",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.thumb}
                alt=""
                draggable={false}
                loading="eager"
                decoding="async"
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                  objectFit: "contain",
                  // Soften the mess so the center hero owns focus
                  filter: "saturate(0.92) contrast(0.96)",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Dead-center full-resolution hero — clean, sharp */}
      <div
        ref={heroWrapRef}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          padding: "6vh 5vw",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={heroImgRef}
          src={current?.src}
          alt={current?.alt ?? ""}
          draggable={false}
          decoding="async"
          style={{
            display: "block",
            maxWidth: "min(92vw, 720px)",
            maxHeight: "78dvh",
            width: "auto",
            height: "auto",
            objectFit: "contain",
            // No filters — portfolio quality
            filter: "none",
            boxShadow: "0 12px 48px rgba(0,0,0,0.55)",
          }}
        />
      </div>

      {/* Whisper progress */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          bottom: "clamp(1.2rem, 3.5vh, 2rem)",
          transform: "translateX(-50%)",
          zIndex: 30,
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
                  ? "rgba(255,255,255,0.55)"
                  : "rgba(255,255,255,0.16)",
              transition: "width 0.25s ease, background 0.25s ease",
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes collageDrift {
          0%, 100% {
            translate: 0 0;
          }
          50% {
            translate: var(--dx, 8px) var(--dy, 6px);
          }
        }
        .collage-piece {
          will-change: transform;
          animation: collageDrift var(--dur, 10s) ease-in-out infinite;
          animation-delay: var(--delay, 0s);
        }
        @media (prefers-reduced-motion: reduce) {
          .collage-piece {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
