"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Hero from "@/components/Hero";
import ContinueIndicator from "@/components/ContinueIndicator";
import EntryGate from "@/components/EntryGate";
import CollageGallery from "@/components/collage/CollageGallery";
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
 * black void → tap → hero emerge → chaotic collage gallery.
 */
export default function Scene() {
  const debug = useDebugFlag();
  const dpr = useMemo(() => getMobileDpr(), []);

  const [started, setStarted] = useState(false);
  const [gateMounted, setGateMounted] = useState(true);
  const [gateDismissing, setGateDismissing] = useState(false);

  const [heroVisible, setHeroVisible] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [phase, setPhase] = useState<Phase>("landing");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [canvasReady, setCanvasReady] = useState(false);
  const [heroStatus, setHeroStatus] = useState("hero:waiting-gesture");
  const [webglError, setWebglError] = useState<string | null>(null);
  const enteredGalleryRef = useRef(false);

  const handleEnter = useCallback(() => {
    if (started) return;
    setStarted(true);
    setGateDismissing(true);
    window.setTimeout(() => setGateMounted(false), GATE_FADE_MS);
  }, [started]);

  const handleRevealed = useCallback(() => setRevealed(true), []);
  const handleHeroVisible = useCallback(() => {
    setHeroVisible(true);
    // Warm collage thumbs while hero still holds the frame
    defaultSeries.photos.forEach((p) => {
      const img = new Image();
      img.decoding = "async";
      img.src = p.thumb;
    });
  }, []);
  const handleHeroStatus = useCallback((s: string) => setHeroStatus(s), []);

  const enterGallery = useCallback(() => {
    if (enteredGalleryRef.current || !revealed) return;
    enteredGalleryRef.current = true;
    setPhase("gallery");
  }, [revealed]);

  useEffect(() => {
    if (!started || !revealed || phase !== "landing") return;
    const id = window.setTimeout(enterGallery, AUTO_ENTER_MS);
    return () => window.clearTimeout(id);
  }, [started, revealed, phase, enterGallery]);

  useGallerySwipe({
    enabled: started && revealed && phase === "landing",
    onSwipeLeft: enterGallery,
    onSwipeRight: enterGallery,
  });

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
  const showBootHud =
    debug ||
    webglError ||
    heroStatus.includes("error") ||
    (started && phase === "landing" && !heroVisible);

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
        }}
      >
        {/* WebGL only for landing hero — frees GPU once collage takes over */}
        {started && phase === "landing" && (
          <WebGLErrorBoundary onError={setWebglError}>
            <Canvas
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                display: "block",
                background: "#000000",
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
              camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 80 }}
              resize={{ scroll: false, debounce: 0 }}
              onCreated={({ gl }) => {
                gl.setClearColor("#000000", 1);
                setCanvasReady(true);
              }}
            >
              <color attach="background" args={["#000000"]} />
              <Hero
                onRevealed={handleRevealed}
                onHeroVisible={handleHeroVisible}
                onStatus={handleHeroStatus}
              />
            </Canvas>
          </WebGLErrorBoundary>
        )}
      </div>

      {phase === "gallery" && (
        <CollageGallery
          series={defaultSeries}
          onIndexChange={setGalleryIndex}
        />
      )}

      {gateMounted && (
        <EntryGate onEnter={handleEnter} dismissing={gateDismissing} />
      )}

      <ContinueIndicator visible={showLandingUi} />

      {/* Quiet index — only in gallery, nearly invisible */}
      {phase === "gallery" && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            top: 14,
            right: 16,
            zIndex: 40,
            pointerEvents: "none",
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
            fontSize: 10,
            letterSpacing: "0.2em",
            color: "rgba(255,255,255,0.28)",
          }}
        >
          {String(galleryIndex + 1).padStart(2, "0")}
          <span style={{ opacity: 0.5 }}> / </span>
          {String(defaultSeries.photos.length).padStart(2, "0")}
        </div>
      )}

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
            color: webglError ? "#ff8a8a" : "rgba(180,255,200,0.7)",
            textShadow: "0 1px 2px #000",
          }}
        >
          {`canvas:${canvasReady} hero:${heroVisible} · ${heroStatus}`}
          {webglError ? `\n${webglError}` : ""}
        </div>
      )}
    </>
  );
}
