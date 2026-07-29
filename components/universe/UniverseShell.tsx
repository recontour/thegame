"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import WebGLErrorBoundary from "@/components/WebGLErrorBoundary";
import {
  CAMERA_FOV,
  CAMERA_Z,
  ZOOM_Z_FRAME,
  ZOOM_Z_MAX,
  ZOOM_Z_MIN,
  ZOOM_Z_STEP,
} from "@/components/universe/constants";
import CameraRig from "@/components/universe/CameraRig";
import OrbitLabel from "@/components/universe/OrbitLabel";
import PlanetStage, {
  stagePoseOffset,
  type StagePose,
} from "@/components/universe/PlanetStage";
import Stars from "@/components/universe/Stars";
import ZoomControls from "@/components/universe/ZoomControls";

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
    padding: 12% 8% 18%;
  }

  .universe-ui.prompt {
    align-items: flex-end;
    padding-bottom: 14%;
  }

  /* Moon / far-enough copy — top of the phone column */
  .universe-ui.top {
    align-items: flex-start;
    padding-top: max(12px, env(safe-area-inset-top, 0px) + 16px);
    padding-bottom: 0;
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

  .universe-message.prompt-text {
    font-size: clamp(1rem, 3.6vw, 1.25rem);
    max-width: 88%;
    letter-spacing: 0.03em;
  }

  .universe-message.far-text {
    font-size: clamp(0.95rem, 3.4vw, 1.15rem);
    max-width: 90%;
    color: #c8d6f0;
  }

  .universe-message.zoom-hint {
    font-size: clamp(0.9rem, 3.2vw, 1.05rem);
    opacity: 0;
    max-width: 88%;
  }

  .universe-message.zoom-hint.visible {
    opacity: 0.75;
  }

  .universe-message.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .universe-orbit-label {
    position: absolute;
    left: 50%;
    top: 60%;
    transform: translate(-50%, 0);
    z-index: 11;
    pointer-events: none;
    color: rgba(240, 244, 255, 0.85);
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    font-size: clamp(0.72rem, 2.6vw, 0.88rem);
    font-weight: 300;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-align: center;
    text-shadow: 0 0 12px rgba(180, 210, 255, 0.35);
    opacity: 0;
    transition: opacity 1.2s ease;
    white-space: nowrap;
  }

  .universe-orbit-label.visible {
    opacity: 1;
  }

  .universe-orbit-label.moon-label {
    top: 18%;
  }
`;

const WELCOME_TEXT = "Welcome.\nThis is our home.";
const PROMPT_TEXT =
  "Drag the satellite to where you think\nGPS satellites orbit";
const MOON_TOP_TEXT = "Now place the Moon where you think it is.";
const FAR_ENOUGH_TEXT =
  "Okay, that's far enough.\nThe Moon isn't in another galaxy.";
const MOON_PLACE_TEXT = "Drag the Moon where you think it belongs.";

/**
 * TEST MODE: welcome is near-instant so we can iterate on later beats.
 * TODO: restore slow typewriter + long hold before ship.
 */
const WELCOME_TEST_MS = 400;

function WelcomeMessage({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    setVisible(true);

    const fadeTimer = setTimeout(() => {
      setVisible(false);
    }, WELCOME_TEST_MS);

    const doneTimer = setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    }, WELCOME_TEST_MS + 200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div className="universe-ui">
      <div
        className={`universe-message${visible ? " visible" : ""}`}
        aria-live="polite"
      >
        {WELCOME_TEXT}
      </div>
    </div>
  );
}

function PromptMessage({
  visible,
  text,
  placement = "bottom",
  far = false,
}: {
  visible: boolean;
  text: string;
  placement?: "bottom" | "top";
  far?: boolean;
}) {
  return (
    <div
      className={`universe-ui ${placement === "top" ? "top" : "prompt"}`}
    >
      <div
        className={`universe-message prompt-text${far ? " far-text" : ""}${
          visible ? " visible" : ""
        }`}
        aria-live="polite"
      >
        {text}
      </div>
    </div>
  );
}

/**
 * Portrait stage: welcome → sat → moon zoom → moon drop.
 */
export default function UniverseShell() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [satelliteActive, setSatelliteActive] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [orbitLabelVisible, setOrbitLabelVisible] = useState(false);
  const [stagePose, setStagePose] = useState<StagePose>("center");

  // Moon beat
  const [moonPhase, setMoonPhase] = useState(false);
  const [moonVisible, setMoonVisible] = useState(false);
  const [moonInteractive, setMoonInteractive] = useState(false);
  const [zoomControlsVisible, setZoomControlsVisible] = useState(false);
  const [moonPromptVisible, setMoonPromptVisible] = useState(false);
  const [farEnoughVisible, setFarEnoughVisible] = useState(false);
  const [moonLabelVisible, setMoonLabelVisible] = useState(false);
  const [cameraZ, setCameraZ] = useState(CAMERA_Z);

  const handleWelcomeDone = useCallback(() => {
    setShowWelcome(false);
    setSatelliteActive(true);
    setStagePose("prompt");
    // TEST: snappy handoffs — restore longer beats later
    window.setTimeout(() => setPromptVisible(true), 120);
  }, []);

  const handleSatelliteSettled = useCallback(() => {
    setPromptVisible(false);
    window.setTimeout(() => setOrbitLabelVisible(true), 200);
    // TEST: snappy moon beat — restore longer pause later
    window.setTimeout(() => {
      setMoonPhase(true);
      setMoonVisible(true);
      setZoomControlsVisible(true);
      setMoonPromptVisible(true);
    }, 350);
  }, []);

  const handleZoomOut = useCallback(() => {
    setCameraZ((z) => {
      const next = Math.min(ZOOM_Z_MAX, z + ZOOM_Z_STEP);
      if (next >= ZOOM_Z_MAX - 0.001) {
        setFarEnoughVisible(true);
      }
      return next;
    });
  }, []);

  const handleZoomIn = useCallback(() => {
    setFarEnoughVisible(false);
    setCameraZ((z) => Math.max(ZOOM_Z_MIN, z - ZOOM_Z_STEP));
  }, []);

  const handleConfirm = useCallback(() => {
    setZoomControlsVisible(false);
    setFarEnoughVisible(false);
    setMoonPromptVisible(false);
    setMoonInteractive(true);
    // Short place prompt
    window.setTimeout(() => setMoonPromptVisible(true), 200);
  }, []);

  /**
   * Same moment the moon starts flying home:
   * - keep a zoomed-out *size* so both fit (Earth can stay small)
   * - ease Earth to the pre-zoom *screen position* (low in the column)
   * - moon distance is frame-tuned so it stays in focus up top
   */
  const handleMoonSnapStart = useCallback(() => {
    setMoonPromptVisible(false);
    setStagePose("moon");
    setCameraZ((z) => Math.max(z, ZOOM_Z_FRAME));
  }, []);

  const handleMoonSettled = useCallback(() => {
    window.setTimeout(() => setMoonLabelVisible(true), 200);
  }, []);

  const canZoomOut = cameraZ < ZOOM_Z_MAX - 0.001;
  const canZoomIn = cameraZ > ZOOM_Z_MIN + 0.001;

  // Top-of-screen moon copy (far-enough replaces the main line)
  const moonTopCopy = moonInteractive
    ? MOON_PLACE_TEXT
    : farEnoughVisible
      ? FAR_ENOUGH_TEXT
      : MOON_TOP_TEXT;

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
              camera={{
                fov: CAMERA_FOV,
                near: 0.1,
                far: 1000,
                position: [0, 0, CAMERA_Z],
              }}
              style={{ background: "#000000" }}
              onCreated={({ gl }) => {
                gl.domElement.style.touchAction = "none";
              }}
            >
              <color attach="background" args={["#000000"]} />
              <ambientLight intensity={1.55} />
              <directionalLight intensity={3.0} position={[5, 3, 5]} />
              <Stars />
              <CameraRig
                targetZ={cameraZ}
                targetY={stagePoseOffset(stagePose)}
              />
              <PlanetStage
                pose={stagePose}
                satelliteActive={satelliteActive}
                onSatelliteSettled={handleSatelliteSettled}
                moonVisible={moonVisible}
                moonInteractive={moonInteractive}
                onMoonSnapStart={handleMoonSnapStart}
                onMoonSettled={handleMoonSettled}
              />
            </Canvas>
          </WebGLErrorBoundary>
          {showWelcome && <WelcomeMessage onDone={handleWelcomeDone} />}
          <PromptMessage visible={promptVisible} text={PROMPT_TEXT} />
          {/* Moon main line / far-enough — top of column */}
          <PromptMessage
            visible={moonPhase && moonPromptVisible}
            text={moonTopCopy}
            placement="top"
            far={farEnoughVisible && !moonInteractive}
          />
          <OrbitLabel visible={orbitLabelVisible} />
          <div
            className={`universe-orbit-label moon-label${
              moonLabelVisible ? " visible" : ""
            }`}
          >
            Actual Moon distance
          </div>
          <ZoomControls
            visible={zoomControlsVisible}
            canZoomIn={canZoomIn}
            canZoomOut={canZoomOut}
            showZoomHint={!farEnoughVisible}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onConfirm={handleConfirm}
          />
        </div>
      </div>
    </>
  );
}
