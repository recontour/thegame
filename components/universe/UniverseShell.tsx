"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import WebGLErrorBoundary from "@/components/WebGLErrorBoundary";
import Earth from "@/components/universe/Earth";
import Stars from "@/components/universe/Stars";

/**
 * Layout CSS — media queries, not JS.
 * Mobile: full bleed. Desktop: tall letterboxed phone column.
 * Touch / click only. No wheel, no desktop scroll physics.
 */
const UNIVERSE_LAYOUT_CSS = `
  .universe-shell {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    background: #000000;
    display: flex;
    align-items: center;
    justify-content: center;
    touch-action: none;
    overscroll-behavior: none;
    overscroll-behavior-x: none;
    overscroll-behavior-y: none;
    -webkit-overflow-scrolling: auto;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  /* Desktop: tall letterboxed phone column (~9:19.5) */
  .universe-stage {
    position: relative;
    width: min(100vw, calc(100dvh * 9 / 19.5));
    height: min(100dvh, calc(100vw / (9 / 19.5)));
    max-width: 100%;
    max-height: 100%;
    background: #000000;
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
    .universe-stage {
      width: 100% !important;
      height: 100% !important;
      max-width: none !important;
      max-height: none !important;
      box-shadow: none !important;
      border-radius: 0;
    }
  }

  .universe-canvas {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    display: block !important;
    touch-action: none;
  }

  .universe-ui {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 10;
  }

  .universe-message {
    color: #f0f4ff;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    font-size: clamp(1.3rem, 4.5vw, 1.8rem);
    font-weight: 300;
    letter-spacing: 0.04em;
    text-align: center;
    max-width: 80%;
    line-height: 1.45;
    white-space: pre-line;
    text-shadow: 0 0 18px rgba(180, 210, 255, 0.35);
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 1.4s ease, transform 1.4s ease;
  }

  .universe-message.visible {
    opacity: 1;
    transform: translateY(0);
  }
`;

const WELCOME_TEXT = "Welcome.\nThis is our home.";

/**
 * Typewriter welcome — Earth first, then text, then soft fade out.
 */
function WelcomeMessage() {
  const [text, setText] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let typeTimer: ReturnType<typeof setTimeout> | undefined;
    let i = 0;

    const startTimer = setTimeout(() => {
      setVisible(true);
      setText("");

      const type = () => {
        if (i < WELCOME_TEXT.length) {
          setText(WELCOME_TEXT.slice(0, i + 1));
          i += 1;
          typeTimer = setTimeout(type, 95);
        }
      };
      type();
    }, 1200);

    // Give the slower typewriter time to finish + a beat to read
    const fadeTimer = setTimeout(() => {
      setVisible(false);
    }, 8500);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(fadeTimer);
      if (typeTimer) clearTimeout(typeTimer);
    };
  }, []);

  return (
    <div className="universe-ui">
      <div
        className={`universe-message${visible ? " visible" : ""}`}
        aria-live="polite"
      >
        {text}
      </div>
    </div>
  );
}

/**
 * Portrait stage + spinning Earth + welcome copy.
 * WebGL lives only in this client tree.
 */
export default function UniverseShell() {
  const stageRef = useRef<HTMLDivElement>(null);

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

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: UNIVERSE_LAYOUT_CSS }} />
      <div className="universe-shell">
        <div ref={stageRef} className="universe-stage" aria-label="Universe">
          <WebGLErrorBoundary>
            <Canvas
              className="universe-canvas"
              dpr={[1, 2]}
              gl={{ antialias: true, alpha: false }}
              camera={{ fov: 45, near: 0.1, far: 1000, position: [0, 0, 3.2] }}
              style={{ background: "#000000" }}
            >
              <color attach="background" args={["#000000"]} />
              <ambientLight intensity={0.55} />
              <directionalLight intensity={1.1} position={[5, 3, 5]} />
              <Stars />
              <Suspense fallback={null}>
                <Earth />
              </Suspense>
            </Canvas>
          </WebGLErrorBoundary>
          <WelcomeMessage />
        </div>
      </div>
    </>
  );
}
