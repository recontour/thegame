"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import Link from "next/link";
import { Canvas, useFrame } from "@react-three/fiber";
import { Monsieur_La_Doulaise, Tangerine } from "next/font/google";
import gsap from "gsap";
import {
  getMobileDpr,
  isMobileDevice,
} from "@/components/gallery/loadMobileSafeTexture";
import { useTextureLoader } from "@/components/gallery/useTextureLoader";
import {
  LANDING_PIECES_HERO_SRC,
  LANDING_SLIDES,
  LANDING_SWAP_PHOTOS,
  STORY_SLIDE_COUNT,
  TOTAL_STEPS,
} from "@/data/landingPhotos";
import WebGLErrorBoundary from "@/components/WebGLErrorBoundary";
import ShatterPlane from "@/components/landing/ShatterPlane";
import StorySwapCanvas from "@/components/landing/StorySwapCanvas";
import { smoothstep } from "@/components/landing/useLandingProgress";

const tangerine = Tangerine({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
});

const monsieur = Monsieur_La_Doulaise({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const UI_FONT =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

const PIECES_STEP = STORY_SLIDE_COUNT; // index 6 = 7th beat

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * One continuous vertical story:
 * steps 0–5 → 9:16 zoom-blur photos
 * step 6 → black + hero.webp shatter + “about me.”
 * Swipe up/down moves freely through all 7 beats.
 */
export default function LandingExperience() {
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [dpr, setDpr] = useState<number | [number, number]>(1);
  const [scrollLocked, setScrollLocked] = useState(true);

  /** 0…5 photos, 6 = pieces / about me */
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);

  const introRef = useRef({ pieces: 0 });
  const piecesProgress = useRef(0);
  const piecesTarget = useRef(0);
  const [piecesUi, setPiecesUi] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const textClearFromTopRef = useRef(0.72);

  const titleLeadRef = useRef<HTMLSpanElement>(null);
  const titleTagRef = useRef<HTMLSpanElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const [webglError, setWebglError] = useState<string | null>(null);
  const [storyReady, setStoryReady] = useState(false);

  const isPieces = step === PIECES_STEP;
  const storySlide = Math.min(step, STORY_SLIDE_COUNT - 1);

  const getIntroReveal = useCallback(() => introRef.current.pieces, []);
  const getTextClearFromTop = useCallback(
    () => textClearFromTopRef.current,
    [],
  );
  const getTargetSlide = useCallback(
    () => Math.min(stepRef.current, STORY_SLIDE_COUNT - 1),
    [],
  );
  const getPiecesProgress = useCallback(() => piecesProgress.current, []);

  const measureTextClear = useCallback(() => {
    const stage = stageRef.current;
    const copy = copyRef.current;
    if (!stage || !copy) return;
    const sr = stage.getBoundingClientRect();
    if (sr.height < 1) return;
    const cr = copy.getBoundingClientRect();
    const ratio = (cr.bottom - sr.top) / sr.height;
    textClearFromTopRef.current = Math.min(0.85, Math.max(0.35, ratio + 0.01));
  }, []);

  // Preload hero for pieces while still on late story slides
  const preloadPieces = step >= STORY_SLIDE_COUNT - 2 || isPieces;
  const { texture: piecesTexture, status: piecesStatus } = useTextureLoader(
    preloadPieces ? LANDING_PIECES_HERO_SRC : null,
  );

  const enterPieces = useCallback(() => {
    introRef.current.pieces = 0;
    piecesProgress.current = 0;
    piecesTarget.current = 0;
    setPiecesUi(0);
    gsap.killTweensOf(introRef.current);
    gsap.to(introRef.current, {
      pieces: 1,
      duration: 2.4,
      ease: "sine.inOut",
    });
  }, []);

  const goNext = useCallback(() => {
    if (scrollLocked) return;
    const s = stepRef.current;

    // On pieces beat: further up = assemble / CTAs
    if (s === PIECES_STEP) {
      piecesTarget.current = Math.min(1, piecesTarget.current + 0.14);
      return;
    }

    if (s < PIECES_STEP) {
      const next = s + 1;
      stepRef.current = next;
      setStep(next);
      if (next === PIECES_STEP) enterPieces();
    }
  }, [scrollLocked, enterPieces]);

  const goPrev = useCallback(() => {
    if (scrollLocked) return;
    const s = stepRef.current;

    // On pieces: first unwind assemble, then return to image 6
    if (s === PIECES_STEP) {
      if (piecesTarget.current > 0.04) {
        piecesTarget.current = Math.max(0, piecesTarget.current - 0.14);
        return;
      }
      stepRef.current = STORY_SLIDE_COUNT - 1;
      setStep(STORY_SLIDE_COUNT - 1);
      gsap.killTweensOf(introRef.current);
      introRef.current.pieces = 0;
      piecesProgress.current = 0;
      piecesTarget.current = 0;
      setPiecesUi(0);
      return;
    }

    if (s > 0) {
      const next = s - 1;
      stepRef.current = next;
      setStep(next);
    }
  }, [scrollLocked]);

  // Single continuous navigation for all 7 beats
  useEffect(() => {
    let touchY0: number | null = null;
    let lastWheel = 0;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (scrollLocked) return;
      const now = performance.now();
      if (now - lastWheel < 380) return;
      if (Math.abs(e.deltaY) < 8) return;
      lastWheel = now;
      if (e.deltaY > 0) goNext();
      else goPrev();
    };

    const onTouchStart = (e: TouchEvent) => {
      touchY0 = e.touches[0]?.clientY ?? null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (scrollLocked || touchY0 == null) return;
      const y = e.changedTouches[0]?.clientY;
      if (y == null) return;
      const dy = touchY0 - y;
      touchY0 = null;
      if (Math.abs(dy) < 40) return;
      if (dy > 0) goNext();
      else goPrev();
    };

    const onKey = (e: KeyboardEvent) => {
      if (scrollLocked) return;
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowRight" ||
        e.key === " " ||
        e.key === "PageDown"
      ) {
        e.preventDefault();
        goNext();
      } else if (
        e.key === "ArrowUp" ||
        e.key === "ArrowLeft" ||
        e.key === "PageUp"
      ) {
        e.preventDefault();
        goPrev();
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [scrollLocked, goNext, goPrev]);

  // Smooth pieces assemble progress
  useEffect(() => {
    if (!isPieces) return;
    let raf = 0;
    const loop = () => {
      const a = 1 - Math.exp(-8 * 0.016);
      piecesProgress.current +=
        (piecesTarget.current - piecesProgress.current) * a;
      setPiecesUi((prev) =>
        Math.abs(prev - piecesProgress.current) > 0.012
          ? piecesProgress.current
          : prev,
      );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isPieces]);

  useEffect(() => {
    measureTextClear();
    const onResize = () => measureTextClear();
    window.addEventListener("resize", onResize);
    const t1 = window.setTimeout(measureTextClear, 120);
    const t2 = window.setTimeout(measureTextClear, 500);
    void document.fonts?.ready?.then(() => measureTextClear());
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [measureTextClear, step]);

  // Intro: both title lines together, 1.5s — lock first 3s
  useEffect(() => {
    setMounted(true);
    const motionOff = prefersReducedMotion();
    setReduced(motionOff);
    setMobile(isMobileDevice());
    setDpr(getMobileDpr());

    if (motionOff) {
      setScrollLocked(false);
      if (titleLeadRef.current)
        gsap.set(titleLeadRef.current, { opacity: 1, y: 0 });
      if (titleTagRef.current)
        gsap.set(titleTagRef.current, { opacity: 1, y: 0 });
      return;
    }

    setScrollLocked(true);
    if (titleLeadRef.current)
      gsap.set(titleLeadRef.current, { opacity: 0, y: 12 });
    if (titleTagRef.current)
      gsap.set(titleTagRef.current, { opacity: 0, y: 12 });

    const tl = gsap.timeline();
    tl.call(() => setScrollLocked(false), undefined, 3);

    const titleEls = [titleLeadRef.current, titleTagRef.current].filter(
      Boolean,
    ) as HTMLElement[];
    if (titleEls.length) {
      tl.to(
        titleEls,
        {
          opacity: 1,
          y: 0,
          duration: 1.5,
          ease: "power2.out",
          stagger: 0,
        },
        0.3,
      );
    }

    return () => {
      tl.kill();
    };
  }, []);

  // Body / about-me fades
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    if (step === 0) return;
    gsap.fromTo(
      el,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" },
    );
    measureTextClear();
  }, [step, measureTextClear]);

  const slide = LANDING_SLIDES[storySlide] ?? LANDING_SLIDES[0];
  const showTitle = !isPieces && step === 0;
  const showBody = !isPieces && step > 0 && step < PIECES_STEP;
  const showAbout = isPieces;
  // Title + image 6 — lower placement at 65%
  const copyTop = showTitle || (showBody && step === 5) ? "65%" : "8%";

  const piecesLeave = reduced
    ? 1
    : isPieces
      ? 1 - smoothstep(0.05, 0.36, piecesUi)
      : 1;
  const copyScrollY = (1 - piecesLeave) * -28;

  const ctaOpacity = reduced && isPieces
    ? 1
    : isPieces
      ? smoothstep(0.72, 0.9, piecesUi)
      : 0;
  const ctaInteractive = ctaOpacity > 0.45;

  // Keep story canvas mounted so swipe-back is instant
  const showStoryCanvas = mounted && !reduced && !webglError;
  const showPiecesCanvas =
    mounted && isPieces && !reduced && !webglError;

  const srcList = useMemo(() => LANDING_SWAP_PHOTOS, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "none",
        overflow: "hidden",
      }}
    >
      <div
        ref={stageRef}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 430,
          height: "100dvh",
          minHeight: "100vh",
          background: "#000000",
          overflow: "hidden",
        }}
      >
        {/* Story always under — hidden on pieces beat (black + shatter on top) */}
        {showStoryCanvas && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: isPieces ? 0 : 1,
              pointerEvents: isPieces ? "none" : "auto",
              transition: "opacity 0.45s ease",
            }}
          >
            <StorySwapCanvas
              srcs={srcList}
              getTargetSlide={getTargetSlide}
              onReady={() => setStoryReady(true)}
              onError={setWebglError}
            />
          </div>
        )}

        {showPiecesCanvas && (
          <WebGLErrorBoundary onError={setWebglError}>
            <Canvas
              style={{ position: "absolute", inset: 0 }}
              dpr={dpr}
              gl={{
                antialias: !mobile,
                alpha: false,
                powerPreference: "default",
                stencil: false,
                depth: true,
              }}
              camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 80 }}
              onCreated={({ gl }) => gl.setClearColor("#000000", 1)}
            >
              <color attach="background" args={["#000000"]} />
              <PiecesProgressBridge
                progress={piecesProgress}
                target={piecesTarget}
              />
              {piecesTexture && piecesStatus === "ready" && (
                <ShatterPlane
                  texture={piecesTexture}
                  getProgress={getPiecesProgress}
                  getIntroReveal={getIntroReveal}
                  getTextClearFromTop={getTextClearFromTop}
                />
              )}
            </Canvas>
          </WebGLErrorBoundary>
        )}

        {(reduced || webglError) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={isPieces ? LANDING_PIECES_HERO_SRC : slide.src}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.9,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Copy */}
        <div
          ref={copyRef}
          style={{
            position: "absolute",
            // Title + image 6 at 65%; other body slides upper band
            top: copyTop,
            left: 0,
            right: 0,
            zIndex: 10,
            textAlign: "left",
            padding: "0 1.25rem 1.25rem 1rem",
            pointerEvents: "none",
            opacity: isPieces ? piecesLeave : 1,
            transform: `translate3d(0, ${isPieces ? copyScrollY : 0}px, 0)`,
            willChange: "opacity, transform",
          }}
        >
          <h1
            className={monsieur.className}
            style={{
              margin: 0,
              fontSize: "clamp(2.35rem, 9.5vw, 3.1rem)",
              fontWeight: 400,
              letterSpacing: "0.02em",
              lineHeight: 1.15,
              color: "#ffffff",
              textAlign: "center",
              display: showTitle ? "flex" : "none",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.12em",
              // Anchor block so 70% is the vertical start of the title
              transform: "translateY(0)",
            }}
          >
            <span
              ref={titleLeadRef}
              style={{
                display: "block",
                opacity: reduced ? 1 : 0,
                willChange: "opacity, transform",
              }}
            >
              raconteur
            </span>
            <span
              ref={titleTagRef}
              style={{
                display: "block",
                fontSize: "1.05em",
                opacity: reduced ? 1 : 0,
                willChange: "opacity, transform",
              }}
            >
              for those who care
            </span>
          </h1>

          <div
            ref={showBody ? bodyRef : undefined}
            className={tangerine.className}
            style={{
              display: showBody ? "block" : "none",
              margin: 0,
              maxWidth: "100%",
              // ~1.5× previous size; solid white so it doesn’t wash out on photos
              fontSize: "clamp(2.3rem, 8.7vw, 2.85rem)",
              fontWeight: 700,
              letterSpacing: "0.02em",
              lineHeight: 1.35,
              color: "rgba(255,255,255,0.95)",
              textAlign: step === 5 ? "center" : "left",
            }}
          >
            {showBody &&
              slide.lines.map((line, i) => (
                <p
                  key={`${step}-${i}`}
                  style={{
                    margin: i === slide.lines.length - 1 ? 0 : "0 0 0.28em",
                  }}
                >
                  {line}
                </p>
              ))}
          </div>

          <div
            ref={showAbout ? bodyRef : undefined}
            className={monsieur.className}
            style={{
              display: showAbout ? "block" : "none",
              margin: 0,
              textAlign: "center",
              fontSize: "clamp(2.2rem, 9vw, 2.9rem)",
              fontWeight: 400,
              letterSpacing: "0.04em",
              color: "#ffffff",
            }}
          >
            about me.
          </div>
        </div>

        {/* 7-step progress (6 photos + pieces) */}
        {storyReady && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: 18,
              left: 0,
              right: 0,
              zIndex: 12,
              display: "flex",
              justifyContent: "center",
              gap: 6,
              pointerEvents: "none",
            }}
          >
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <span
                key={i}
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background:
                    i === step
                      ? "rgba(255,255,255,0.75)"
                      : "rgba(255,255,255,0.2)",
                }}
              />
            ))}
          </div>
        )}

        <nav
          aria-label="Experiences"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.75rem",
            opacity: ctaOpacity,
            pointerEvents: ctaInteractive ? "auto" : "none",
            transform: `translate3d(0, ${(1 - ctaOpacity) * 16}px, 0)`,
            transition: reduced ? "none" : "opacity 0.2s linear",
          }}
        >
          <p
            style={{
              margin: "0 0 0.5rem",
              fontFamily: UI_FONT,
              fontSize: "0.62rem",
              letterSpacing: "0.36em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.34)",
            }}
          >
            Enter
          </p>
          <Link
            href="/gal"
            style={{
              fontFamily: UI_FONT,
              fontSize: "0.82rem",
              letterSpacing: "0.42em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.82)",
              textDecoration: "none",
              padding: "0.75rem 1.5rem",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Gal
          </Link>
          <Link
            href="/work"
            style={{
              fontFamily: UI_FONT,
              fontSize: "0.82rem",
              letterSpacing: "0.42em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.82)",
              textDecoration: "none",
              padding: "0.75rem 1.5rem",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Work
          </Link>
        </nav>
      </div>
    </div>
  );
}

/** Keep pieces assemble progress smooth inside R3F without extra React work. */
function PiecesProgressBridge({
  progress,
  target,
}: {
  progress: MutableRefObject<number>;
  target: MutableRefObject<number>;
}) {
  useFrame((_, dt) => {
    const a = 1 - Math.exp(-8 * Math.min(dt, 0.05));
    progress.current += (target.current - progress.current) * a;
  });
  return null;
}
