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

/** Portrait frame — 9:19.5. Desktop only; phones fill the real viewport. */
const PORTRAIT_ASPECT = 9 / 19.5;

/** True phones/tablets — not the desktop letterbox column. */
function useFillViewport(): boolean {
  const [fill, setFill] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(
      "(hover: none) and (pointer: coarse), (max-width: 820px)",
    ).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(
      "(hover: none) and (pointer: coarse), (max-width: 820px)",
    );
    const apply = () => setFill(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return fill;
}

/**
 * Root shell: black page + centered portrait stage + WebGL + HTML copy.
 * Swipe / wheel only. No chrome, no buttons.
 *
 * Mobile: stage is 100vw × 100dvh (edge to edge).
 * Desktop: tall letterboxed phone frame.
 *
 * Important: drag bias + phase live in refs so the morph does not re-render
 * the R3F tree mid-transition (that was flashing the material black on mobile).
 */
export default function StoryCarousel() {
  const stageRef = useRef<HTMLDivElement>(null);
  const fillViewport = useFillViewport();
  const [cap] = useState<StoryCapability>(() => detectStoryCapability());
  const [index, setIndex] = useState(0);
  /** Story phase — mutated synchronously; scene reads the ref every frame */
  const phaseRef = useRef<StoryPhase>("full");
  /** Finger drag preview in card units — ref only, never React state */
  const dragBiasRef = useRef(0);
  const [textVisible, setTextVisible] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
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
    setTextVisible(false);
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
    setTextVisible(false);
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
    // Gentle preview only — never steal the full-screen beat
    dragBiasRef.current = THREE.MathUtils.clamp(-deltaY / 420, -0.22, 0.22);
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
        touchAction: "none",
        overscrollBehavior: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div
        ref={stageRef}
        style={{
          position: "relative",
          // Mobile: own the whole screen. Desktop: tall phone column.
          width: fillViewport
            ? "100vw"
            : `min(100vw, calc(100dvh * ${PORTRAIT_ASPECT}))`,
          height: fillViewport
            ? "100dvh"
            : `min(100dvh, calc(100vw / ${PORTRAIT_ASPECT}))`,
          maxWidth: "100vw",
          maxHeight: "100dvh",
          background: "#050508",
          overflow: "hidden",
          touchAction: "none",
          // Column edge only on desktop letterbox — no fake chrome on phone
          boxShadow: fillViewport
            ? "none"
            : "0 0 0 1px rgba(255,255,255,0.04), 0 24px 80px rgba(0,0,0,0.65)",
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
                gl.outputColorSpace = THREE.SRGBColorSpace;
              }}
            >
              <CarouselScene
                cards={cards}
                targetIndex={index}
                phaseRef={phaseRef}
                dragBiasRef={dragBiasRef}
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

        <SwipeHint />
      </div>
    </div>
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
