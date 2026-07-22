"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Hero from "@/components/Hero";
import ContinueIndicator from "@/components/ContinueIndicator";
import Gallery from "@/components/gallery/Gallery";
import GalleryProgress from "@/components/gallery/GalleryProgress";
import WebGLErrorBoundary from "@/components/WebGLErrorBoundary";
import { useGallerySwipe } from "@/components/gallery/useGallerySwipe";
import { defaultSeries } from "@/data/series";

type Phase = "landing" | "gallery";

const AUTO_ENTER_MS = 2800;

/** Set true (or open with ?debug=1) to show on-screen diagnostics on mobile. */
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

export default function Scene() {
  const debug = useDebugFlag();
  const [revealed, setRevealed] = useState(false);
  const [seriesReady, setSeriesReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("landing");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [canvasReady, setCanvasReady] = useState(false);
  const [heroStatus, setHeroStatus] = useState("hero:boot");
  const [webglError, setWebglError] = useState<string | null>(null);
  const [viewportLabel, setViewportLabel] = useState("");
  const enteredRef = useRef(false);

  const handleRevealed = useCallback(() => setRevealed(true), []);
  const handleSeriesReady = useCallback(() => setSeriesReady(true), []);
  const handleHeroStatus = useCallback((s: string) => setHeroStatus(s), []);

  const enterGallery = useCallback(() => {
    if (enteredRef.current || !seriesReady) return;
    enteredRef.current = true;
    setPhase("gallery");
  }, [seriesReady]);

  useEffect(() => {
    if (!revealed || !seriesReady || phase !== "landing") return;
    const id = window.setTimeout(enterGallery, AUTO_ENTER_MS);
    return () => window.clearTimeout(id);
  }, [revealed, seriesReady, phase, enterGallery]);

  useGallerySwipe({
    enabled: revealed && seriesReady && phase === "landing",
    onSwipeLeft: enterGallery,
    onSwipeRight: enterGallery,
  });

  useEffect(() => {
    const update = () => {
      setViewportLabel(
        `${window.innerWidth}×${window.innerHeight} dpr=${window.devicePixelRatio}`,
      );
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const showLandingUi = revealed && phase === "landing";
  const showGalleryUi = phase === "gallery";

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
          // iOS: isolate compositing for WebGL
          transform: "translateZ(0)",
        }}
      >
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
              antialias: true,
              alpha: false,
              // "high-performance" can fail / fall back badly on some phones
              powerPreference: "default",
              stencil: false,
              depth: true,
              failIfMajorPerformanceCaveat: false,
            }}
            dpr={[1, 1.5]}
            camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 100 }}
            // Resize from the fixed parent, not the window alone
            resize={{ scroll: false, debounce: 0 }}
            onCreated={({ gl, size }) => {
              gl.setClearColor("#000000", 1);
              gl.domElement.style.width = "100%";
              gl.domElement.style.height = "100%";
              gl.domElement.style.display = "block";
              gl.domElement.style.touchAction = "none";
              // Avoid iOS context loss surprises where possible
              gl.domElement.addEventListener(
                "webglcontextlost",
                (e) => {
                  e.preventDefault();
                  setWebglError("WebGL context lost");
                },
                false,
              );
              setCanvasReady(true);
              setViewportLabel(
                (v) =>
                  `${v} | canvas ${Math.round(size.width)}×${Math.round(size.height)}`,
              );
            }}
          >
            <color attach="background" args={["#000000"]} />
            {/* No Suspense around Hero — texture load is stateful, not suspending */}
            {phase === "landing" && (
              <Hero
                onRevealed={handleRevealed}
                onStatus={handleHeroStatus}
              />
            )}
            {revealed && (
              <Gallery
                series={defaultSeries}
                active={phase === "gallery"}
                onIndexChange={setGalleryIndex}
                onReady={handleSeriesReady}
              />
            )}
          </Canvas>
        </WebGLErrorBoundary>
      </div>

      <ContinueIndicator visible={showLandingUi} />
      <GalleryProgress
        index={galleryIndex}
        total={defaultSeries.photos.length}
        visible={showGalleryUi}
      />

      {/* Always-on quiet status if something fails; full HUD with ?debug=1 */}
      {(debug || webglError || heroStatus.includes("error")) && (
        <div
          style={{
            position: "fixed",
            top: 10,
            left: 10,
            right: 10,
            zIndex: 50,
            pointerEvents: "none",
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: 10,
            lineHeight: 1.45,
            color: webglError ? "#ff8a8a" : "rgba(255,255,255,0.55)",
            textShadow: "0 1px 2px #000",
            whiteSpace: "pre-wrap",
          }}
        >
          {[
            debug ? "DEBUG ON (?debug=1)" : "STATUS",
            `canvas: ${canvasReady ? "ready" : "pending"}`,
            `phase: ${phase} | revealed: ${revealed} | series: ${seriesReady}`,
            heroStatus,
            viewportLabel,
            webglError ? `webgl: ${webglError}` : null,
          ]
            .filter(Boolean)
            .join("\n")}
        </div>
      )}
    </>
  );
}
