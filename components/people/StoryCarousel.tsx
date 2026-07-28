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

/** Portrait frame — 9:19.5 (tall modern phone). Letterboxed on desktop. */
const PORTRAIT_ASPECT = 9 / 19.5;

/**
 * Root shell: black page + centered portrait stage + WebGL + HTML copy.
 * Swipe / wheel only. No chrome, no buttons.
 */
export default function StoryCarousel() {
  const stageRef = useRef<HTMLDivElement>(null);
  // Lazy init on client — SSR falls back to mid tier defaults inside detect
  const [cap] = useState<StoryCapability>(() => detectStoryCapability());
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<StoryPhase>("full");
  const [dragBias, setDragBias] = useState(0);
  const [textVisible, setTextVisible] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const [webglError, setWebglError] = useState<string | null>(null);
  /** Free space under focused image starts here (stage height fraction) */
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
    setTextVisible(false);
    if (phase === "full") {
      setPhase("settled");
      return;
    }
    setIndex((i) => (i + 1) % n);
    setPhase("full");
  }, [n, phase]);

  /**
   * Prev beat (mirror of next):
   *   settled → expand this image full again
   *   full    → previous image, already settled
   */
  const goPrev = useCallback(() => {
    setTextVisible(false);
    if (phase === "settled") {
      setPhase("full");
      return;
    }
    setIndex((i) => (i - 1 + n) % n);
    setPhase("settled");
  }, [n, phase]);

  const onDrag = useCallback((deltaY: number, active: boolean) => {
    if (!active) {
      setDragBias(0);
      return;
    }
    // Gentle preview only — never steal the full-screen beat
    const bias = THREE.MathUtils.clamp(-deltaY / 420, -0.22, 0.22);
    setDragBias(bias);
  }, []);

  useVerticalSwipe({
    enabled: !webglError,
    onNext: goNext,
    onPrev: goPrev,
    onDrag,
    cooldownMs: 900,
    targetRef: stageRef,
  });

  const onFocusSettled = useCallback((i: number, settled: boolean) => {
    setFocusIndex(i);
    // Copy only after the morph into the framed rest pose
    setTextVisible(settled);
  }, []);

  const onTextBandTop = useCallback((topFrac: number) => {
    setTextBandTop((prev) =>
      Math.abs(prev - topFrac) > 0.008 ? topFrac : prev,
    );
  }, []);

  const dpr = useMemo(() => {
    if (!cap) return 1;
    return cap.dpr;
  }, [cap]);

  const activeCard = cards[focusIndex] ?? cards[0];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#030306",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Kill overscroll on the page chrome
        touchAction: "none",
        overscrollBehavior: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* Portrait stage — mobile fills width; desktop is a centered tall frame */}
      <div
        ref={stageRef}
        style={{
          position: "relative",
          width: `min(100vw, calc(100dvh * ${PORTRAIT_ASPECT}))`,
          height: `min(100dvh, calc(100vw / ${PORTRAIT_ASPECT}))`,
          maxWidth: "100vw",
          maxHeight: "100dvh",
          background: "#050508",
          overflow: "hidden",
          touchAction: "none",
          // Subtle edge so letterboxing reads as intentional on desktop
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.04), 0 24px 80px rgba(0,0,0,0.65)",
        }}
      >
        <WebGLErrorBoundary onError={setWebglError}>
          {!webglError && (
            <Canvas
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
                // sRGB output for correct WebP colors
                gl.outputColorSpace = THREE.SRGBColorSpace;
              }}
            >
              <CarouselScene
                cards={cards}
                targetIndex={index}
                phase={phase}
                dragBias={dragBias}
                textures={textures}
                cap={cap}
                onFocusSettled={onFocusSettled}
                onTextBandTop={onTextBandTop}
              />
            </Canvas>
          )}
        </WebGLErrorBoundary>

        <CardTextOverlay
          card={activeCard}
          visible={textVisible && !webglError}
          bandTop={textBandTop}
        />

        <SwipeHint phase={phase} />
      </div>
    </div>
  );
}

function SwipeHint({ phase }: { phase: StoryPhase }) {
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

  const label = phase === "full" ? "scroll" : "scroll";

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
      {label}
    </div>
  );
}
