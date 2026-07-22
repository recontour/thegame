"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Hero from "@/components/Hero";
import ContinueIndicator from "@/components/ContinueIndicator";
import EntryGate from "@/components/EntryGate";
import Gallery from "@/components/gallery/Gallery";
import GalleryProgress from "@/components/gallery/GalleryProgress";
import WebGLErrorBoundary from "@/components/WebGLErrorBoundary";
import { useGallerySwipe } from "@/components/gallery/useGallerySwipe";
import { getMobileDpr, isMobileDevice } from "@/components/gallery/loadMobileSafeTexture";
import { defaultSeries } from "@/data/series";

type Phase = "landing" | "gallery";

const AUTO_ENTER_MS = 2800;
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
 * Mobile-safe shell:
 * 1) Pure black — no Canvas until first tap
 * 2) Load ONLY the hero texture first
 * 3) After hero is visible, allow gallery (series loads then)
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
  const [phase, setPhase] = useState<Phase>("landing");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [canvasReady, setCanvasReady] = useState(false);
  const [heroStatus, setHeroStatus] = useState("hero:waiting-gesture");
  const [webglError, setWebglError] = useState<string | null>(null);
  const [viewportLabel, setViewportLabel] = useState("");
  const enteredGalleryRef = useRef(false);

  const handleEnter = useCallback(() => {
    if (started) return;
    console.log("[Scene] user gesture → mounting Canvas", {
      mobile: isMobileDevice(),
      dpr,
    });
    setStarted(true);
    setGateDismissing(true);
    window.setTimeout(() => {
      setGateMounted(false);
      console.log("[Scene] entry gate unmounted");
    }, GATE_FADE_MS);
  }, [started, dpr]);

  const handleRevealed = useCallback(() => setRevealed(true), []);
  const handleHeroVisible = useCallback(() => {
    console.log("[Scene] hero image visible — series may load later");
    setHeroVisible(true);
  }, []);
  const handleSeriesReady = useCallback(() => setSeriesReady(true), []);
  const handleSeriesProgress = useCallback((loaded: number, total: number) => {
    setSeriesProgress({ loaded, total });
  }, []);
  const handleHeroStatus = useCallback((s: string) => setHeroStatus(s), []);

  const enterGallery = useCallback(() => {
    // Can enter once hero finished reveal; series loads on gallery mount
    if (enteredGalleryRef.current || !revealed) return;
    enteredGalleryRef.current = true;
    console.log("[Scene] enter gallery");
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
    const update = () => {
      setViewportLabel(
        `${window.innerWidth}×${window.innerHeight} dpr=${window.devicePixelRatio} mobile=${isMobileDevice()}`,
      );
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const showLandingUi = started && revealed && phase === "landing";
  const showGalleryUi = started && phase === "gallery";
  // Boot / load HUD until series finishes (helps real-device debugging)
  const showBootHud =
    debug ||
    webglError ||
    heroStatus.includes("error") ||
    (started &&
      (!heroVisible ||
        seriesProgress.loaded < seriesProgress.total));

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
              camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 100 }}
              resize={{ scroll: false, debounce: 0 }}
              onCreated={({ gl, size }) => {
                console.log("[Scene] onCreated WebGL", {
                  w: size.width,
                  h: size.height,
                  dpr: gl.getPixelRatio(),
                  maxTex: gl.capabilities?.maxTextureSize,
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
              {/* Hero only on landing */}
              {phase === "landing" && (
                <Hero
                  onRevealed={handleRevealed}
                  onHeroVisible={handleHeroVisible}
                  onStatus={handleHeroStatus}
                />
              )}
              {/*
                After hero is loaded+visible: start sequential gallery loads (preload).
                Visible planes only when phase === "gallery".
              */}
              {heroVisible && (
                <Gallery
                  series={defaultSeries}
                  active={phase === "gallery"}
                  preload
                  onIndexChange={setGalleryIndex}
                  onReady={handleSeriesReady}
                  onLoadProgress={handleSeriesProgress}
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
      <GalleryProgress
        index={galleryIndex}
        total={defaultSeries.photos.length}
        visible={showGalleryUi}
      />

      {showBootHud && (
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
            color: webglError || heroStatus.includes("error")
              ? "#ff8a8a"
              : "rgba(180, 255, 200, 0.75)",
            textShadow: "0 1px 2px #000",
            whiteSpace: "pre-wrap",
          }}
        >
          {[
            "MOBILE TEXTURE BOOT",
            `started:${started} canvas:${canvasReady} heroVisible:${heroVisible}`,
            `phase:${phase} revealed:${revealed} seriesReady:${seriesReady}`,
            `series ${seriesProgress.loaded}/${seriesProgress.total}`,
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
