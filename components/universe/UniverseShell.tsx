"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import WebGLErrorBoundary from "@/components/WebGLErrorBoundary";
import {
  CAMERA_FOV,
  CAMERA_Z,
  ZOOM_Z_MAX,
  ZOOM_Z_MIN,
  ZOOM_Z_MOON_FRAME,
  ZOOM_Z_STEP,
} from "@/components/universe/constants";
import CameraRig from "@/components/universe/CameraRig";
import OpeningPhone from "@/components/universe/OpeningPhone";
import OpeningQuiz from "@/components/universe/OpeningQuiz";
import OrbitLabel from "@/components/universe/OrbitLabel";
import PlanetStage from "@/components/universe/PlanetStage";
import Stars from "@/components/universe/Stars";
import ZoomControls from "@/components/universe/ZoomControls";

/**
 * Full-bleed portrait column. WebGL covers the whole stage (stars included).
 * Earth is face-on and optically lowered via camera view-offset (not world Y).
 * Moon uses true teaching ratio (30× R); we zoom out to fit it.
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
    left: 0;
    right: 0;
    top: 0;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    pointer-events: none;
    z-index: 10;
    /* Match opening quiz: 50px from top (+ safe area) */
    padding: calc(50px + env(safe-area-inset-top, 0px)) 8% 0;
  }

  .universe-message {
    color: #f0f4ff;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    font-size: clamp(1.15rem, 4.2vw, 1.65rem);
    font-weight: 300;
    letter-spacing: 0.04em;
    text-align: center;
    max-width: 90%;
    line-height: 1.45;
    white-space: pre-line;
    text-shadow: 0 0 18px rgba(180, 210, 255, 0.35);
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 1.4s ease, transform 1.4s ease;
  }

  .universe-message.prompt-text {
    font-size: clamp(0.95rem, 3.5vw, 1.2rem);
    letter-spacing: 0.03em;
  }

  .universe-message.far-text {
    font-size: clamp(0.9rem, 3.3vw, 1.1rem);
    color: #c8d6f0;
  }

  .universe-message.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .universe-orbit-label {
    position: absolute;
    left: 50%;
    top: 62%;
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
    top: 12%;
  }
`;

const PROMPT_TEXT =
  "Drag the satellite to where you think\nGPS satellites orbit";
const MOON_TOP_TEXT = "Now place the Moon where you think it is.";
const FAR_ENOUGH_TEXT =
  "Okay, that's far enough.\nThe Moon isn't in another galaxy.";
const MOON_PLACE_TEXT = "Drag the Moon where you think it belongs.";

function PromptMessage({
  visible,
  text,
  far = false,
}: {
  visible: boolean;
  text: string;
  far?: boolean;
}) {
  return (
    <div className="universe-ui">
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

export default function UniverseShell() {
  const stageRef = useRef<HTMLDivElement>(null);

  const [openingActive, setOpeningActive] = useState(true);
  const [phoneExiting, setPhoneExiting] = useState(false);
  const [earthRevealed, setEarthRevealed] = useState(false);
  /** NDC y for centering the phone under the quiz options */
  const [phoneSlotNdcY, setPhoneSlotNdcY] = useState(-0.28);

  const [satelliteActive, setSatelliteActive] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [orbitLabelVisible, setOrbitLabelVisible] = useState(false);

  const [moonPhase, setMoonPhase] = useState(false);
  const [moonVisible, setMoonVisible] = useState(false);
  const [moonInteractive, setMoonInteractive] = useState(false);
  const [zoomControlsVisible, setZoomControlsVisible] = useState(false);
  const [moonPromptVisible, setMoonPromptVisible] = useState(false);
  const [farEnoughVisible, setFarEnoughVisible] = useState(false);
  const [moonLabelVisible, setMoonLabelVisible] = useState(false);
  const [cameraZ, setCameraZ] = useState(CAMERA_Z);

  const handleOpeningAnswered = useCallback((_choice: string) => {
    setPhoneExiting(true);
    setEarthRevealed(true);
  }, []);

  const handlePhoneExitDone = useCallback(() => {
    setOpeningActive(false);
    setSatelliteActive(true);
    window.setTimeout(() => setPromptVisible(true), 400);
  }, []);

  const handleSatelliteSettled = useCallback(() => {
    setPromptVisible(false);
    window.setTimeout(() => setOrbitLabelVisible(true), 200);
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
      if (next >= ZOOM_Z_MAX - 0.001) setFarEnoughVisible(true);
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
    window.setTimeout(() => setMoonPromptVisible(true), 200);
  }, []);

  /** Moon flies to 30× R; camera zooms out to fit — Earth stays face-on lower third */
  const handleMoonSnapStart = useCallback(() => {
    setMoonPromptVisible(false);
    setCameraZ(ZOOM_Z_MOON_FRAME);
  }, []);

  const handleMoonSettled = useCallback(() => {
    window.setTimeout(() => setMoonLabelVisible(true), 200);
  }, []);

  const canZoomOut = cameraZ < ZOOM_Z_MAX - 0.001;
  const canZoomIn = cameraZ > ZOOM_Z_MIN + 0.001;

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
                far: 5000,
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
              <CameraRig targetZ={cameraZ} />
              {openingActive && (
                <Suspense fallback={null}>
                  <OpeningPhone
                    exiting={phoneExiting}
                    slotNdcY={phoneSlotNdcY}
                    onExitDone={handlePhoneExitDone}
                  />
                </Suspense>
              )}
              <PlanetStage
                earthRevealed={earthRevealed}
                satelliteActive={satelliteActive}
                onSatelliteSettled={handleSatelliteSettled}
                moonVisible={moonVisible}
                moonInteractive={moonInteractive}
                onMoonSnapStart={handleMoonSnapStart}
                onMoonSettled={handleMoonSettled}
              />
            </Canvas>
          </WebGLErrorBoundary>

          <OpeningQuiz
            active={openingActive && !phoneExiting}
            onAnswered={handleOpeningAnswered}
            onPhoneSlotNdc={setPhoneSlotNdcY}
          />
          <PromptMessage visible={promptVisible} text={PROMPT_TEXT} />
          <PromptMessage
            visible={moonPhase && moonPromptVisible}
            text={moonTopCopy}
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
            showMidCopy={!farEnoughVisible}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onConfirm={handleConfirm}
          />
        </div>
      </div>
    </>
  );
}
