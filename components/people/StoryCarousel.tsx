"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import WebGLErrorBoundary from "@/components/WebGLErrorBoundary";
import {
  detectStoryCapability,
  type StoryCapability,
} from "@/components/people/capability";
import CarouselScene, {
  type StoryPhase,
} from "@/components/people/CarouselScene";
import CardTextOverlay from "@/components/people/CardTextOverlay";
import { useCarouselTextures } from "@/components/people/useCarouselTextures";
import { useVerticalSwipe } from "@/components/people/useVerticalSwipe";
import { PEOPLE_CARDS } from "@/data/people";

/**
 * Layout CSS — media queries, not JS.
 * JS matchMedia was leaving the tall PC column on some phones
 * (hydration + hover/pointer quirks). CSS always wins.
 */
const PEOPLE_LAYOUT_CSS = `
  .people-shell {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    background: #030306;
    display: flex;
    align-items: center;
    justify-content: center;
    /* Kill iOS horizontal back-swipe / overscroll competing with our story */
    touch-action: none;
    overscroll-behavior: none;
    overscroll-behavior-x: none;
    overscroll-behavior-y: none;
    -webkit-overflow-scrolling: auto;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  /* Desktop: tall letterboxed phone column */
  .people-stage {
    position: relative;
    width: min(100vw, calc(100dvh * 9 / 19.5));
    height: min(100dvh, calc(100vw / (9 / 19.5)));
    max-width: 100%;
    max-height: 100%;
    background: #050508;
    overflow: hidden;
    touch-action: none;
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.04),
      0 24px 80px rgba(0, 0, 0, 0.65);
  }

  /*
   * Real devices + narrow windows: fill the shell edge-to-edge.
   * Use 100% of the fixed shell (not 100vw) — 100vw can leave side gutters
   * on iOS Safari when the scrollbar/safe-area math differs.
   */
  @media (max-width: 900px), (hover: none) and (pointer: coarse) {
    .people-stage {
      width: 100% !important;
      height: 100% !important;
      max-width: none !important;
      max-height: none !important;
      box-shadow: none !important;
      border-radius: 0;
    }
  }

  .people-canvas {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    display: block !important;
    touch-action: none;
  }
`;

/**
 * Root shell: black page + stage + WebGL + HTML copy.
 * Swipe / wheel only. No chrome, no buttons.
 *
 * Important: drag bias + phase live in refs so the morph does not re-render
 * the R3F tree mid-transition (that was flashing the material black on mobile).
 */
export default function StoryCarousel() {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);
  const [cap] = useState<StoryCapability>(() => detectStoryCapability());
  const [index, setIndex] = useState(0);
  /** Story phase — mutated synchronously; scene reads the ref every frame */
  const phaseRef = useRef<StoryPhase>("full");
  /** Shared with WebGL + HTML copy (rAF) — no React lag on mobile */
  const presentRef = useRef(0);
  /** Parallax from *committed* travel only — never from live finger scrub */
  const motionRef = useRef(0);
  /**
   * calm = default slow cinematic morph.
   * rush = only when a flick lands *during* an in-flight transition.
   */
  const paceRef = useRef<"calm" | "rush">("calm");
  /** Scene sets true while present/position still chasing targets */
  const animatingRef = useRef(false);
  /**
   * Indices that reached the framed+text phase this page load.
   * Full tour complete only when size === n; then next from last → home.
   * Reverse wrap (1→12) never redirects.
   */
  const seenSettledRef = useRef<Set<number>>(new Set());
  const [webglError, setWebglError] = useState<string | null>(null);
  const [textBandTop, setTextBandTop] = useState(0.55);

  const cards = PEOPLE_CARDS;
  const n = cards.length;

  const textures = useCarouselTextures(cards, index, cap);

  /**
   * At rest → always calm (slow).
   * Mid-transition flick → rush a bit + still advance (impatient path).
   */
  const noteIntent = useCallback(() => {
    if (animatingRef.current) {
      paceRef.current = "rush";
    } else {
      paceRef.current = "calm";
    }
  }, []);

  const markSettledSeen = useCallback((i: number) => {
    seenSettledRef.current.add(i);
  }, []);

  /**
   * Next beat:
   *   full    → settle this image (text arrives after the morph)
   *   settled → next image full-bleed
   *   settled on last + all 12 seen this visit → home (/)
   */
  const goNext = useCallback(() => {
    noteIntent();
    if (phaseRef.current === "full") {
      phaseRef.current = "settled";
      markSettledSeen(index);
      return;
    }
    // Framed+text on last image, and every card was settled this session
    // → end of the story loop, leave for main page (not wrap to #1)
    if (
      index === n - 1 &&
      seenSettledRef.current.size >= n
    ) {
      router.push("/");
      return;
    }
    phaseRef.current = "full";
    setIndex((i) => (i + 1) % n);
  }, [n, noteIntent, markSettledSeen, index, router]);

  /**
   * Prev beat (mirror of next):
   *   settled → expand this image full again
   *   full    → previous image, already settled
   * Never redirects — reverse wrap 1→12 is a free loop.
   */
  const goPrev = useCallback(() => {
    noteIntent();
    if (phaseRef.current === "settled") {
      phaseRef.current = "full";
      return;
    }
    const prev = (index - 1 + n) % n;
    phaseRef.current = "settled";
    markSettledSeen(prev);
    setIndex(prev);
  }, [n, noteIntent, markSettledSeen, index]);

  useVerticalSwipe({
    enabled: !webglError,
    onNext: goNext,
    onPrev: goPrev,
    // Pure trigger. Slightly longer micro-debounce so iOS pointer+touch
    // doesn't double-fire and accidentally enter rush.
    threshold: 24,
    cooldownMs: 140,
    targetRef: stageRef,
  });

  const onTextBandTop = useCallback((topFrac: number) => {
    setTextBandTop((prev) =>
      Math.abs(prev - topFrac) > 0.008 ? topFrac : prev,
    );
  }, []);

  // Kick R3F resize after mount — mobile browser chrome can change the shell
  // size after first paint, leaving a non-full canvas.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const fire = () => window.dispatchEvent(new Event("resize"));
    fire();
    const ro = new ResizeObserver(() => fire());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dpr = useMemo(() => {
    if (!cap) return 1;
    return cap.dpr;
  }, [cap]);

  // Content follows story index; opacity/stagger is driven by presentRef (rAF)
  const activeCard = cards[index] ?? cards[0];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PEOPLE_LAYOUT_CSS }} />
      <div className="people-shell">
        <div ref={stageRef} className="people-stage">
          <WebGLErrorBoundary onError={setWebglError}>
            {!webglError && (
              <Canvas
                className="people-canvas"
                dpr={dpr}
                gl={{
                  antialias: cap.tier !== "low",
                  alpha: false,
                  powerPreference: "default",
                  stencil: false,
                  depth: true,
                }}
                camera={{
                  position: [0, 0.15, 5.2],
                  fov: 42,
                  near: 0.1,
                  far: 40,
                }}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  touchAction: "none",
                }}
                onCreated={({ gl }) => {
                  gl.setClearColor(0x050508, 1);
                  gl.outputColorSpace = THREE.SRGBColorSpace;
                }}
              >
                <CarouselScene
                  cards={cards}
                  targetIndex={index}
                  phaseRef={phaseRef}
                  presentRef={presentRef}
                  motionRef={motionRef}
                  paceRef={paceRef}
                  animatingRef={animatingRef}
                  textures={textures}
                  cap={cap}
                  onTextBandTop={onTextBandTop}
                />
              </Canvas>
            )}
          </WebGLErrorBoundary>

          <CardTextOverlay
            card={activeCard}
            presentRef={presentRef}
            motionRef={motionRef}
            bandTop={textBandTop}
            enabled={!webglError}
          />

          <SwipeHint />
        </div>
      </div>
    </>
  );
}

function SwipeHint() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setShow(false), 5200);
    const hide = () => setShow(false);
    window.addEventListener("pointerdown", hide, { once: true });
    window.addEventListener("wheel", hide, { once: true, passive: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("pointerdown", hide);
      window.removeEventListener("wheel", hide);
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: "max(1rem, env(safe-area-inset-top))",
        left: 0,
        right: 0,
        textAlign: "center",
        pointerEvents: "none",
        zIndex: 4,
        opacity: show ? 0.4 : 0,
        transition: "opacity 1.6s ease",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        fontSize: 11,
        letterSpacing: "0.28em",
        textTransform: "uppercase",
        color: "rgba(230,235,245,0.72)",
      }}
    >
      scroll
    </div>
  );
}
