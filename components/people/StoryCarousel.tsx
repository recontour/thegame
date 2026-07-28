"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    touch-action: none;
    overscroll-behavior: none;
    user-select: none;
    -webkit-user-select: none;
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
  const stageRef = useRef<HTMLDivElement>(null);
  const [cap] = useState<StoryCapability>(() => detectStoryCapability());
  const [index, setIndex] = useState(0);
  /** Story phase — mutated synchronously; scene reads the ref every frame */
  const phaseRef = useRef<StoryPhase>("full");
  /** Finger drag preview in card units — ref only, never React state */
  const dragBiasRef = useRef(0);
  /** Shared with WebGL + HTML copy (rAF) — no React lag on mobile */
  const presentRef = useRef(0);
  const motionRef = useRef(0);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [textBandTop, setTextBandTop] = useState(0.55);

  const cards = PEOPLE_CARDS;
  const n = cards.length;

  const textures = useCarouselTextures(cards, index, cap);

  /**
   * Next beat:
   *   full    → settle this image (text arrives after the morph)
   *   settled → next image, full-bleed again
   */
  const goNext = useCallback(() => {
    if (phaseRef.current === "full") {
      phaseRef.current = "settled";
      return;
    }
    phaseRef.current = "full";
    setIndex((i) => (i + 1) % n);
  }, [n]);

  /**
   * Prev beat (mirror of next):
   *   settled → expand this image full again
   *   full    → previous image, already settled
   */
  const goPrev = useCallback(() => {
    if (phaseRef.current === "settled") {
      phaseRef.current = "full";
      return;
    }
    phaseRef.current = "settled";
    setIndex((i) => (i - 1 + n) % n);
  }, [n]);

  const onDrag = useCallback((deltaY: number, active: boolean) => {
    if (!active) {
      dragBiasRef.current = 0;
      return;
    }
    // Stronger scrub — feeds live parallax while the finger is down
    // Finger up (negative dy) → positive bias → next
    dragBiasRef.current = THREE.MathUtils.clamp(-deltaY / 280, -0.55, 0.55);
  }, []);

  useVerticalSwipe({
    enabled: !webglError,
    onNext: goNext,
    onPrev: goPrev,
    onDrag,
    // Let each beat finish breathing before the next swipe lands
    cooldownMs: 1400,
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
                  dragBiasRef={dragBiasRef}
                  presentRef={presentRef}
                  motionRef={motionRef}
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
