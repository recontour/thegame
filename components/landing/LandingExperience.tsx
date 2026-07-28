"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Inter, Monsieur_La_Doulaise, Tangerine } from "next/font/google";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

/** Thinnest Inter for “raconteur” wordmark */
const interThin = Inter({
  weight: "100",
  subsets: ["latin"],
  display: "swap",
});

const UI_FONT =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

const PIECES_STEP = STORY_SLIDE_COUNT; // index 6 = 7th beat

/** Survive /people navigation (browser back returns to the same beat). */
const LANDING_STEP_KEY = "raconteur-landing-step";

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
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [dpr, setDpr] = useState<number | [number, number]>(1);
  const [scrollLocked, setScrollLocked] = useState(false);

  /** 0…5 photos, 6 = pieces / about me */
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);

  const introRef = useRef({ pieces: 0 });
  const piecesProgress = useRef(0);
  const piecesTarget = useRef(0);
  const [piecesUi, setPiecesUi] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  /** “about me.” — used so shatter pile clears the lower label, not the top story line */
  const aboutMeRef = useRef<HTMLDivElement>(null);
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
    // Prefer about-me label so pieces park under it (not under the top story line)
    const mark = aboutMeRef.current ?? copyRef.current;
    if (!stage || !mark) return;
    const sr = stage.getBoundingClientRect();
    if (sr.height < 1) return;
    const cr = mark.getBoundingClientRect();
    // Air under “about me.” so the pile sits mid-lower, clear of the label
    const ratio = (cr.bottom - sr.top) / sr.height;
    textClearFromTopRef.current = Math.min(0.9, Math.max(0.42, ratio + 0.05));
  }, []);

  // Preload hero for pieces while still on late story slides
  const preloadPieces = step >= STORY_SLIDE_COUNT - 2 || isPieces;
  const { texture: piecesTexture, status: piecesStatus } = useTextureLoader(
    preloadPieces ? LANDING_PIECES_HERO_SRC : null,
  );

  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  /** Blocks double-advance on trackpads (1→3 skips). */
  const storyLockUntil = useRef(0);
  const STORY_STEP_MS = 700;

  const enterPieces = useCallback((opts?: { restored?: boolean }) => {
    gsap.killTweensOf(introRef.current);
    if (opts?.restored) {
      // Returning from /people — skip the long intro, land already assembled-ready
      introRef.current.pieces = 1;
      piecesProgress.current = 0.04;
      piecesTarget.current = 0.04;
      setPiecesUi(0.04);
      return;
    }
    introRef.current.pieces = 0;
    piecesProgress.current = 0;
    piecesTarget.current = 0.04;
    setPiecesUi(0);
    gsap.to(introRef.current, {
      pieces: 1,
      duration: 1.35,
      ease: "power2.out",
    });
  }, []);

  const leavePiecesToStory = useCallback(() => {
    stepRef.current = STORY_SLIDE_COUNT - 1;
    setStep(STORY_SLIDE_COUNT - 1);
    gsap.killTweensOf(introRef.current);
    introRef.current.pieces = 0;
    piecesProgress.current = 0;
    piecesTarget.current = 0;
    setPiecesUi(0);
    storyLockUntil.current = performance.now() + STORY_STEP_MS;
  }, []);

  const goNext = useCallback(() => {
    if (scrollLocked) return;
    const s = stepRef.current;
    const now = performance.now();

    if (s === PIECES_STEP) {
      // Gentle discrete nudge (keys / intentional flick)
      piecesTarget.current = clamp01(piecesTarget.current + 0.2);
      return;
    }

    // Exactly one story step — ignore bursty wheel/trackpad events
    if (now < storyLockUntil.current) return;
    if (s < PIECES_STEP) {
      storyLockUntil.current = now + STORY_STEP_MS;
      const next = s + 1;
      stepRef.current = next;
      setStep(next);
      if (next === PIECES_STEP) enterPieces();
    }
  }, [scrollLocked, enterPieces]);

  const goPrev = useCallback(() => {
    if (scrollLocked) return;
    const s = stepRef.current;
    const now = performance.now();

    if (s === PIECES_STEP) {
      // Still assembling → ease back; near rest → return to image 6
      if (piecesTarget.current > 0.08 || piecesProgress.current > 0.08) {
        piecesTarget.current = clamp01(piecesTarget.current - 0.22);
        return;
      }
      leavePiecesToStory();
      return;
    }

    if (now < storyLockUntil.current) return;
    if (s > 0) {
      storyLockUntil.current = now + STORY_STEP_MS;
      const next = s - 1;
      stepRef.current = next;
      setStep(next);
    }
  }, [scrollLocked, leavePiecesToStory]);

  // Story: one step per gesture. Pieces: soft scrub + reliable swipe-back.
  useEffect(() => {
    let touchY0: number | null = null;
    let touchStartY: number | null = null;
    let touchAcc = 0;
    let piecesDragging = false;
    let piecesLeaveAcc = 0;
    let wheelAcc = 0;
    let wheelLeaveAcc = 0;
    let wheelResetTimer: ReturnType<typeof setTimeout> | null = null;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (scrollLocked) return;

      // 7th beat — scrub assemble; scroll up at rest → image 6
      if (stepRef.current === PIECES_STEP) {
        if (e.deltaY < 0) {
          // scrolling / swiping back
          if (
            piecesTarget.current <= 0.06 &&
            piecesProgress.current <= 0.08
          ) {
            wheelLeaveAcc += -e.deltaY;
            if (wheelLeaveAcc > 36) {
              wheelLeaveAcc = 0;
              leavePiecesToStory();
            }
            return;
          }
          piecesTarget.current = clamp01(
            piecesTarget.current + e.deltaY * 0.00115,
          );
          wheelLeaveAcc = 0;
          return;
        }
        wheelLeaveAcc = 0;
        piecesTarget.current = clamp01(
          piecesTarget.current + e.deltaY * 0.00115,
        );
        return;
      }

      // Story: accumulate into one step, then lock (stops 1→3 skips)
      if (performance.now() < storyLockUntil.current) {
        wheelAcc = 0;
        return;
      }

      wheelAcc += e.deltaY;
      if (wheelResetTimer) clearTimeout(wheelResetTimer);
      wheelResetTimer = setTimeout(() => {
        wheelAcc = 0;
      }, 180);

      if (Math.abs(wheelAcc) < 48) return;
      const dir = wheelAcc;
      wheelAcc = 0;
      if (dir > 0) goNext();
      else goPrev();
    };

    const onTouchStart = (e: TouchEvent) => {
      // Never hijack taps on real links/buttons (people CTA, Instagram)
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("a[href], button, [data-landing-cta]")) {
        touchY0 = null;
        touchStartY = null;
        touchAcc = 0;
        piecesLeaveAcc = 0;
        piecesDragging = false;
        return;
      }
      const y = e.touches[0]?.clientY ?? null;
      touchY0 = y;
      touchStartY = y;
      touchAcc = 0;
      piecesLeaveAcc = 0;
      piecesDragging = stepRef.current === PIECES_STEP;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (scrollLocked || touchY0 == null) return;
      const y = e.touches[0]?.clientY;
      if (y == null) return;
      const dy = touchY0 - y; // finger up → positive
      touchY0 = y;

      if (piecesDragging && stepRef.current === PIECES_STEP) {
        if (
          dy < 0 &&
          piecesTarget.current <= 0.06 &&
          piecesProgress.current <= 0.08
        ) {
          // Already at rest pile — accumulate swipe-down to leave
          piecesLeaveAcc += -dy;
          if (piecesLeaveAcc > 44) {
            piecesLeaveAcc = 0;
            leavePiecesToStory();
          }
          return;
        }
        piecesLeaveAcc = 0;
        piecesTarget.current = clamp01(piecesTarget.current + dy * 0.0019);
        return;
      }
      touchAcc += dy;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (scrollLocked) {
        touchY0 = null;
        touchStartY = null;
        touchAcc = 0;
        piecesLeaveAcc = 0;
        piecesDragging = false;
        return;
      }

      const endY = e.changedTouches[0]?.clientY ?? null;
      const totalDy =
        touchStartY != null && endY != null ? touchStartY - endY : touchAcc;

      if (piecesDragging) {
        piecesDragging = false;
        // Full-gesture swipe down near rest → image 6
        if (
          totalDy < -48 &&
          piecesTarget.current < 0.1 &&
          piecesProgress.current < 0.12
        ) {
          leavePiecesToStory();
        }
        touchY0 = null;
        touchStartY = null;
        touchAcc = 0;
        piecesLeaveAcc = 0;
        return;
      }

      touchY0 = null;
      touchStartY = null;
      touchAcc = 0;
      if (Math.abs(totalDy) < 52) return;
      if (performance.now() < storyLockUntil.current) return;
      if (totalDy > 0) goNext();
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
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      if (wheelResetTimer) clearTimeout(wheelResetTimer);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKey);
    };
  }, [scrollLocked, goNext, goPrev, leavePiecesToStory]);

  // Medium follow — smooth but not laggy
  useEffect(() => {
    if (!isPieces) return;
    let raf = 0;
    const loop = () => {
      const a = 1 - Math.exp(-11 * 0.016);
      piecesProgress.current +=
        (piecesTarget.current - piecesProgress.current) * a;
      setPiecesUi((prev) =>
        Math.abs(prev - piecesProgress.current) > 0.01
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

  /** Slow cinematic rise from below — plays on every visit to image 1 */
  const playTitleIntro = useCallback((motionOff: boolean) => {
    const lead = titleLeadRef.current;
    const tag = titleTagRef.current;
    if (!lead || !tag) return;

    gsap.killTweensOf([lead, tag]);

    if (motionOff) {
      gsap.set([lead, tag], { opacity: 1, y: 0 });
      return;
    }

    // Start well below the rest position
    gsap.set([lead, tag], { opacity: 0, y: 72 });
    gsap
      .timeline({ defaults: { ease: "power3.out" } })
      .to(lead, {
        opacity: 1,
        y: 0,
        duration: 2.8,
        delay: 0.15,
      })
      .to(
        tag,
        {
          opacity: 1,
          y: 0,
          duration: 2.8,
        },
        "<0.18", // almost together, tag follows a hair later
      );
  }, []);

  useEffect(() => {
    setMounted(true);
    setReduced(prefersReducedMotion());
    setMobile(isMobileDevice());
    setDpr(getMobileDpr());
    setScrollLocked(false);

    // Restore beat after /people (or any client remount of this page)
    try {
      const raw = sessionStorage.getItem(LANDING_STEP_KEY);
      if (raw == null) return;
      const saved = Number(raw);
      if (!Number.isInteger(saved) || saved < 0 || saved >= TOTAL_STEPS) return;
      if (saved === 0) return;
      stepRef.current = saved;
      setStep(saved);
      if (saved === PIECES_STEP) {
        // Defer so refs/state settle before shatter intro
        requestAnimationFrame(() => enterPieces({ restored: true }));
      }
    } catch {
      /* private mode / blocked storage */
    }
  }, [enterPieces]);

  // Persist step so back-from-/people returns here (not slide 0)
  useEffect(() => {
    if (!mounted) return;
    try {
      sessionStorage.setItem(LANDING_STEP_KEY, String(step));
    } catch {
      /* ignore */
    }
  }, [step, mounted]);

  // Every time we land on image 1 (including first load)
  useEffect(() => {
    if (step !== 0) return;
    const id = requestAnimationFrame(() => {
      playTitleIntro(prefersReducedMotion() || reduced);
    });
    return () => cancelAnimationFrame(id);
  }, [step, reduced, playTitleIntro]);

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
    // Remeasure after layout (about-me is in a separate lower band)
    const id = requestAnimationFrame(() => measureTextClear());
    return () => cancelAnimationFrame(id);
  }, [step, measureTextClear]);

  const slide = LANDING_SLIDES[storySlide] ?? LANDING_SLIDES[0];
  const showTitle = !isPieces && step === 0;
  const showBody = !isPieces && step > 0 && step < PIECES_STEP;
  const showAbout = isPieces;
  // Per-slide vertical placement (from top of stage)
  const copyTop = showAbout
    ? "30%"
    : showTitle || (showBody && step === 5)
      ? "65%"
      : showBody && step === 3
        ? "40%"
        : "8%";

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

        {/* Image 3: darken top ~60% so body copy stays readable (subject at bottom) */}
        {!isPieces && step === 2 && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 5,
              pointerEvents: "none",
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.74) 0%, rgba(0,0,0,0.52) 34%, rgba(0,0,0,0.28) 52%, rgba(0,0,0,0.08) 60%, rgba(0,0,0,0) 68%)",
              transition: "opacity 0.4s ease",
            }}
          />
        )}

        {showPiecesCanvas && (
          <WebGLErrorBoundary onError={setWebglError}>
            <Canvas
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 1,
                // Never steal taps from the people CTA (intermittent miss on mobile)
                pointerEvents: "none",
              }}
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
            // Title/image6: 65% · image4: 40% · others: 8%
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
            style={{
              margin: 0,
              lineHeight: 1.2,
              color: "#ffffff",
              textAlign: "center",
              display: showTitle ? "flex" : "none",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.35em",
            }}
          >
            <span
              ref={titleLeadRef}
              className={interThin.className}
              style={{
                display: "block",
                fontWeight: 100,
                fontSize: "clamp(2.1rem, 8.5vw, 2.85rem)",
                letterSpacing: "0.28em",
                textTransform: "lowercase",
                opacity: reduced ? 1 : 0,
                willChange: "opacity, transform",
              }}
            >
              raconteur
            </span>
            <span
              ref={titleTagRef}
              className={monsieur.className}
              style={{
                display: "block",
                fontWeight: 400,
                fontSize: "clamp(1.85rem, 7.5vw, 2.5rem)",
                letterSpacing: "0.02em",
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
            style={{
              display: showAbout ? "flex" : "none",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.85rem",
              margin: 0,
              textAlign: "center",
              width: "100%",
            }}
          >
            {/* Same type as landing story body (Tangerine) */}
            <p
              className={tangerine.className}
              style={{
                margin: 0,
                maxWidth: "100%",
                fontSize: "clamp(2.3rem, 8.7vw, 2.85rem)",
                fontWeight: 700,
                letterSpacing: "0.02em",
                lineHeight: 1.35,
                color: "rgba(255,255,255,0.95)",
                textAlign: "center",
              }}
            >
              Here is one of the stories I want to tell
            </p>
            {/*
              People CTA: high z-index + explicit navigate.
              No timer on the button — failures were hit-testing (WebGL canvas /
              full-screen layers / parent opacity) eating taps on mobile.
            */}
            <Link
              href="/people"
              data-landing-cta="people"
              onPointerDown={(e) => {
                // Don't let window swipe handlers treat this as a pieces scrub
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                  sessionStorage.setItem(LANDING_STEP_KEY, String(PIECES_STEP));
                } catch {
                  /* ignore */
                }
                router.push("/people");
              }}
              style={{
                // Keep clickable while the beat is still readable; disable when faded out
                pointerEvents: piecesLeave > 0.12 ? "auto" : "none",
                position: "relative",
                zIndex: 30,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: "0.15rem",
                // Larger tap target than the pill chrome
                padding: "0.85rem 1.7rem",
                minHeight: 44,
                minWidth: 120,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.38)",
                background: "rgba(255,255,255,0.08)",
                color: "#ffffff",
                textDecoration: "none",
                fontFamily: UI_FONT,
                fontSize: "clamp(0.72rem, 3.1vw, 0.82rem)",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                fontWeight: 500,
                WebkitTapHighlightColor: "transparent",
                backdropFilter: "blur(8px)",
                boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
                cursor: "pointer",
                touchAction: "manipulation",
              }}
            >
              people
            </Link>
          </div>
        </div>

        {/*
          “about me.” sits in the band between the people button and the bottom —
          vertically centered in that lower half so pieces have room underneath.
        */}
        {showAbout && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              // Starts roughly under the people CTA; ends above progress dots
              top: "48%",
              bottom: "max(2.75rem, env(safe-area-inset-bottom))",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              opacity: piecesLeave,
              transform: `translate3d(0, ${copyScrollY}px, 0)`,
              willChange: "opacity, transform",
              padding: "0 1.25rem",
              boxSizing: "border-box",
            }}
          >
            <div
              ref={aboutMeRef}
              className={monsieur.className}
              style={{
                margin: 0,
                fontSize: "clamp(2.2rem, 9vw, 2.9rem)",
                fontWeight: 400,
                letterSpacing: "0.04em",
                color: "#ffffff",
                textAlign: "center",
              }}
            >
              about me.
            </div>
          </div>
        )}

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
          aria-label="Connect"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.25rem",
            opacity: ctaOpacity,
            pointerEvents: ctaInteractive ? "auto" : "none",
            transform: `translate3d(0, ${(1 - ctaOpacity) * 16}px, 0)`,
            transition: reduced ? "none" : "opacity 0.2s linear",
          }}
        >
          <a
            href="https://www.instagram.com/ashwinunderscore/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram @ashwinunderscore"
            style={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.9rem",
              textDecoration: "none",
              color: "#ffffff",
              WebkitTapHighlightColor: "transparent",
              cursor: "pointer",
              padding: "1.25rem",
              width: "min(72vw, 220px)",
              height: "min(72vw, 220px)",
              aspectRatio: "1 / 1",
              boxSizing: "border-box",
              border: "none",
              borderRadius: 22,
              // Classic Instagram gradient (purple → pink → orange → yellow)
              background:
                "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
              boxShadow: "0 12px 40px rgba(188, 24, 136, 0.35)",
            }}
          >
            <svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <rect
                x="2.25"
                y="2.25"
                width="19.5"
                height="19.5"
                rx="5.5"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <circle
                cx="12"
                cy="12"
                r="4.4"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <circle cx="17.5" cy="6.5" r="1.25" fill="currentColor" />
            </svg>
            <span
              style={{
                fontFamily: UI_FONT,
                fontSize: "1rem",
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "#ffffff",
                fontWeight: 500,
              }}
            >
              Instagram
            </span>
            <span
              style={{
                fontFamily: UI_FONT,
                fontSize: "0.9rem",
                letterSpacing: "0.04em",
                color: "rgba(255,255,255,0.9)",
                textTransform: "none",
              }}
            >
              @ashwinunderscore
            </span>
          </a>
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
    const a = 1 - Math.exp(-11 * Math.min(dt, 0.05));
    progress.current += (target.current - progress.current) * a;
  });
  return null;
}
