"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Hero from "@/components/Hero";
import ContinueIndicator from "@/components/ContinueIndicator";
import EntryGate from "@/components/EntryGate";
import ScrollGallery from "@/components/gallery/ScrollGallery";
import ScrollProgress from "@/components/gallery/ScrollProgress";
import WebGLErrorBoundary from "@/components/WebGLErrorBoundary";
import { useGallerySwipe } from "@/components/gallery/useGallerySwipe";
import {
  getMobileDpr,
  isMobileDevice,
} from "@/components/gallery/loadMobileSafeTexture";
import { defaultSeries } from "@/data/series";

type Phase = "landing" | "gallery";

const AUTO_ENTER_MS = 3200;
const GATE_FADE_MS = 900;

const DEBUG_DEFAULT = false;

function useDebugFlag() {
  const [debug, setDebug] = useState(DEBUG_DEFAULT);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("debug") === "1") setDebug(true);
    } catch {
      /* ignore */
    }
  }, []);
  return debug;
}

/**
 * Experience shell:
 * black void → tap → hero emerge → scroll journey through the series.
 */
export default function Scene() {
  const debug = useDebugFlag();
  const dpr = useMemo(() => getMobileDpr(), []);

  const [started, setStarted] = useState(false);
  const [gateMounted, setGateMounted] = useState(true);
  const [gateDismissing, setGateDismissing] = useState(false);

  const [heroVisible, setHeroVisible] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [seriesReady, setSeriesReady] = useState(false);
  const [seriesProgress, setSeriesProgress] = useState({ loaded: 0, total: 8 });
  const [scrollProgress, setScrollProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>("landing");
  const [canvasReady, setCanvasReady] = useState(false);
  const [heroStatus, setHeroStatus] = useState("hero:waiting-gesture");
  const [webglError, setWebglError] = useState<string | null>(null);
  const enteredGalleryRef = useRef(false);

  const handleEnter = useCallback(() => {
    if (started) return;
    console.log("[Scene] user gesture → mounting Canvas", {
      mobile: isMobileDevice(),
      dpr,
    });
    setStarted(true);
    setGateDismissing(true);
    window.setTimeout(() => setGateMounted(false), GATE_FADE_MS);
  }, [started, dpr]);

  const handleRevealed = useCallback(() => setRevealed(true), []);
  const handleHeroVisible = useCallback(() => setHeroVisible(true), []);
  const handleSeriesReady = useCallback(() => setSeriesReady(true), []);
  const handleSeriesProgress = useCallback((loaded: number, total: number) => {
    setSeriesProgress({ loaded, total });
  }, []);
  const handleScrollProgress = useCallback((p: number) => {
    setScrollProgress(p);
  }, []);
  const handleHeroStatus = useCallback((s: string) => setHeroStatus(s), []);

  const enterGallery = useCallback(() => {
    if (enteredGalleryRef.current || !revealed) return;
    enteredGalleryRef.current = true;
    console.log("[Scene] enter scroll gallery");
    setPhase("gallery");
  }, [revealed]);

  useEffect(() => {
    if (!started || !revealed || phase !== "landing") return;
    const id = window.setTimeout(enterGallery, AUTO_ENTER_MS);
    return () => window.clearTimeout(id);
  }, [started, revealed, phase, enterGallery]);

  // Vertical intent after hero also enters the void (swipe / scroll metaphor)
  useGallerySwipe({
    enabled: started && revealed && phase === "landing",
    onSwipeLeft: enterGallery,
    onSwipeRight: enterGallery,
  });

  // First downward wheel/touch after reveal also enters
  useEffect(() => {
    if (!started || !revealed || phase !== "landing") return;

    const enter = () => enterGallery();
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 8) enter();
    };
    let y0: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      y0 = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (y0 != null && y != null && y0 - y > 36) enter();
    };

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [started, revealed, phase, enterGallery]);

  const showLandingUi = started && revealed && phase === "landing";
  const showGalleryUi = started && phase === "gallery" && seriesReady;
  const showBootHud =
    debug ||
    webglError ||
    heroStatus.includes("error") ||
    (started && !heroVisible);

  return (
    <>
      <div
        className="scene-root"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100dvh",
          minHeight: "100vh",
          zIndex: 0,
          background: "#000000",
          touchAction: "none",
          overflow: "hidden",
          transform: "translateZ(0)",
        }}
      >
        {started && (
          <WebGLErrorBoundary onError={setWebglError}>
            <Canvas
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                display: "block",
                background: "#000000",
                outline: "none",
                touchAction: "none",
              }}
              gl={{
                antialias: !isMobileDevice(),
                alpha: false,
                powerPreference: "default",
                stencil: false,
                depth: true,
                failIfMajorPerformanceCaveat: false,
              }}
              dpr={dpr}
              camera={{
                position: [0, 0, 5],
                fov: 50,
                near: 0.1,
                far: 80,
              }}
              resize={{ scroll: false, debounce: 0 }}
              onCreated={({ gl }) => {
                gl.setClearColor("#000000", 1);
                gl.domElement.style.touchAction = "none";
                gl.domElement.addEventListener(
                  "webglcontextlost",
                  (e) => {
                    e.preventDefault();
                    setWebglError("WebGL context lost");
                  },
                  false,
                );
                setCanvasReady(true);
              }}
            >
              <color attach="background" args={["#000000"]} />
              {/* No fog — keeps photographs clean and full contrast */}

              {phase === "landing" && (
                <Hero
                  onRevealed={handleRevealed}
                  onHeroVisible={handleHeroVisible}
                  onStatus={handleHeroStatus}
                />
              )}

              {/* Preload series after hero appears; activate scroll journey after handoff */}
              {heroVisible && (
                <ScrollGallery
                  series={defaultSeries}
                  active={phase === "gallery"}
                  preload
                  onReady={handleSeriesReady}
                  onLoadProgress={handleSeriesProgress}
                  onScrollProgress={handleScrollProgress}
                />
              )}
            </Canvas>
          </WebGLErrorBoundary>
        )}
      </div>

      {gateMounted && (
        <EntryGate onEnter={handleEnter} dismissing={gateDismissing} />
      )}

      <ContinueIndicator visible={showLandingUi} />
      <ScrollProgress progress={scrollProgress} visible={showGalleryUi} />

      {showBootHud && (
        <div
          style={{
            position: "fixed",
            top: 10,
            left: 10,
            zIndex: 50,
            pointerEvents: "none",
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: 10,
            lineHeight: 1.45,
            color: webglError ? "#ff8a8a" : "rgba(180, 255, 200, 0.7)",
            textShadow: "0 1px 2px #000",
            whiteSpace: "pre-wrap",
          }}
        >
          {[
            `canvas:${canvasReady} hero:${heroVisible}`,
            `phase:${phase} series ${seriesProgress.loaded}/${seriesProgress.total}`,
            heroStatus,
            webglError,
          ]
            .filter(Boolean)
            .join("\n")}
        </div>
      )}
    </>
  );
}
