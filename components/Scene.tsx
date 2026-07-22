"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Hero from "@/components/Hero";
import ContinueIndicator from "@/components/ContinueIndicator";
import EntryGate from "@/components/EntryGate";
import Gallery from "@/components/gallery/Gallery";
import GalleryProgress from "@/components/gallery/GalleryProgress";
import WebGLErrorBoundary from "@/components/WebGLErrorBoundary";
import { useGallerySwipe } from "@/components/gallery/useGallerySwipe";
import { defaultSeries } from "@/data/series";

type Phase = "landing" | "gallery";

const AUTO_ENTER_MS = 2800;
const GATE_FADE_MS = 900;

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

/**
 * Mobile-safe shell:
 * 1) Pure black — no Canvas on first paint
 * 2) First user pointerdown → mount WebGL, load textures, start reveal
 */
export default function Scene() {
  const debug = useDebugFlag();

  // WebGL must not mount until a user gesture (mobile stability)
  const [started, setStarted] = useState(false);
  const [gateMounted, setGateMounted] = useState(true);
  const [gateDismissing, setGateDismissing] = useState(false);

  const [revealed, setRevealed] = useState(false);
  const [seriesReady, setSeriesReady] = useState(false);
  const [phase, setPhase] = useState<Phase>("landing");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [canvasReady, setCanvasReady] = useState(false);
  const [heroStatus, setHeroStatus] = useState("hero:waiting-gesture");
  const [webglError, setWebglError] = useState<string | null>(null);
  const [viewportLabel, setViewportLabel] = useState("");
  const enteredGalleryRef = useRef(false);

  const handleEnter = useCallback(() => {
    if (started) return;
    console.log("[Scene] user gesture → mounting Canvas");
    setStarted(true);
    setGateDismissing(true);
    // Keep gate in DOM through the fade so the handoff stays black/cinematic
    window.setTimeout(() => {
      setGateMounted(false);
      console.log("[Scene] entry gate unmounted");
    }, GATE_FADE_MS);
  }, [started]);

  const handleRevealed = useCallback(() => setRevealed(true), []);
  const handleSeriesReady = useCallback(() => setSeriesReady(true), []);
  const handleHeroStatus = useCallback((s: string) => setHeroStatus(s), []);

  const enterGallery = useCallback(() => {
    if (enteredGalleryRef.current || !seriesReady) return;
    enteredGalleryRef.current = true;
    setPhase("gallery");
  }, [seriesReady]);

  useEffect(() => {
    if (!started || !revealed || !seriesReady || phase !== "landing") return;
    const id = window.setTimeout(enterGallery, AUTO_ENTER_MS);
    return () => window.clearTimeout(id);
  }, [started, revealed, seriesReady, phase, enterGallery]);

  useGallerySwipe({
    enabled: started && revealed && seriesReady && phase === "landing",
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

  useEffect(() => {
    if (canvasReady) {
      console.log("[Scene] Canvas ready", viewportLabel);
    }
  }, [canvasReady, viewportLabel]);

  const showLandingUi = started && revealed && phase === "landing";
  const showGalleryUi = started && phase === "gallery";

  return (
    <>
      {/* Always black full-screen base */}
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
        {/* Canvas only after first user interaction — never on cold load */}
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
                antialias: true,
                alpha: false,
                powerPreference: "default",
                stencil: false,
                depth: true,
                failIfMajorPerformanceCaveat: false,
              }}
              dpr={[1, 1.5]}
              camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 100 }}
              resize={{ scroll: false, debounce: 0 }}
              onCreated={({ gl, size }) => {
                console.log("[Scene] onCreated WebGL", {
                  w: size.width,
                  h: size.height,
                  dpr: gl.getPixelRatio(),
                });
                gl.setClearColor("#000000", 1);
                gl.domElement.style.width = "100%";
                gl.domElement.style.height = "100%";
                gl.domElement.style.display = "block";
                gl.domElement.style.touchAction = "none";
                gl.domElement.addEventListener(
                  "webglcontextlost",
                  (e) => {
                    e.preventDefault();
                    console.error("[Scene] webglcontextlost");
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
        )}
      </div>

      {/* Full-screen black gate — waits for first onPointerDown */}
      {gateMounted && (
        <EntryGate onEnter={handleEnter} dismissing={gateDismissing} />
      )}

      <ContinueIndicator visible={showLandingUi} />
      <GalleryProgress
        index={galleryIndex}
        total={defaultSeries.photos.length}
        visible={showGalleryUi}
      />

      {/* Temporary: confirm gesture while WebGL boots */}
      {started && !canvasReady && (
        <div
          style={{
            position: "fixed",
            top: 12,
            left: 12,
            zIndex: 45,
            pointerEvents: "none",
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: 10,
            color: "rgba(120, 255, 180, 0.7)",
            textShadow: "0 1px 2px #000",
          }}
        >
          gesture ok · waiting for WebGL…
        </div>
      )}

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
            `started: ${started} | canvas: ${canvasReady ? "ready" : "—"}`,
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
