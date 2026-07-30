"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import WebGLErrorBoundary from "@/components/WebGLErrorBoundary";
import {
  CAMERA_FOV,
  CAMERA_Z,
  CAMERA_Y_SUN_FRAME,
  EARTH_SCREEN_BIAS,
  HOME_SCREEN_BIAS,
  ZOOM_Z_MAX,
  ZOOM_Z_MIN,
  ZOOM_Z_MOON_FRAME,
  ZOOM_Z_STEP,
  ZOOM_Z_SUN_FACTOR,
  ZOOM_Z_SUN_FRAME,
  ZOOM_Z_SUN_MAX,
  ZOOM_Z_SUN_MIN,
} from "@/components/universe/constants";
import AudioGate from "@/components/universe/AudioGate";
import CameraRig from "@/components/universe/CameraRig";
import MoonIntroOverlay from "@/components/universe/MoonIntroOverlay";
import OpeningPhone from "@/components/universe/OpeningPhone";
import OpeningQuiz from "@/components/universe/OpeningQuiz";
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
    /* 50px top + side clear for mute button */
    padding: var(--universe-top-pad, calc(50px + env(safe-area-inset-top, 0px)))
      max(8%, var(--universe-mute-clear, 52px)) 0;
  }

  .universe-ui.bottom {
    top: auto;
    bottom: 0;
    align-items: flex-end;
    padding: 0 max(8%, var(--universe-mute-clear, 52px))
      calc(28px + env(safe-area-inset-bottom, 0px));
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
    color: rgba(240, 244, 255, 0.88);
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    font-size: clamp(0.95rem, 3.4vw, 1.15rem);
    font-weight: 400;
    letter-spacing: 0.03em;
    text-align: center;
    text-shadow: 0 0 14px rgba(180, 210, 255, 0.35);
    opacity: 0;
    transition: opacity 1.2s ease;
    max-width: 88%;
    line-height: 1.4;
  }

  .universe-orbit-label.visible {
    opacity: 1;
  }

  .universe-orbit-label.moon-label {
    /* Between Moon (high) and Earth (lower third) — not glued to the disc */
    top: 32%;
    /* Edge-hugging copy — only a few px from the sides */
    max-width: 100%;
    width: 100%;
    padding: 0 4px;
    box-sizing: border-box;
  }

  .universe-orbit-label .moon-label-sub {
    display: block;
    margin-top: 8px;
    font-size: clamp(0.85rem, 3.1vw, 1rem);
    font-weight: 300;
    letter-spacing: 0.02em;
    color: rgba(220, 230, 250, 0.82);
    line-height: 1.45;
  }

  /* After “Farther than it looks” — next branch copy under the label */
  .moon-next-copy {
    display: block;
    margin-top: 0;
    max-height: 0;
    overflow: hidden;
    font-size: clamp(0.85rem, 3.1vw, 1rem);
    font-weight: 300;
    letter-spacing: 0.02em;
    color: rgba(230, 238, 255, 0.9);
    line-height: 1.5;
    white-space: pre-line;
    text-shadow: 0 0 14px rgba(180, 210, 255, 0.28);
    opacity: 0;
    transform: translateY(10px);
    transition:
      opacity 1.2s ease,
      transform 1.2s ease,
      max-height 1.2s ease,
      margin-top 1.2s ease;
  }

  .moon-next-copy.visible {
    margin-top: 22px;
    max-height: 28em;
    opacity: 1;
    transform: translateY(0);
  }

  /* Bottom choices under Earth: solar system vs light */
  .moon-choice-bar {
    position: absolute;
    bottom: max(28px, env(safe-area-inset-bottom, 0px) + 20px);
    left: 50%;
    transform: translateX(-50%) translateY(12px);
    z-index: 20;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: min(92%, 300px);
    max-width: calc(100% - 2 * var(--universe-mute-clear, 52px));
    pointer-events: none;
    opacity: 0;
    transition: opacity 1s ease, transform 1s ease;
    box-sizing: border-box;
  }

  .moon-choice-bar.visible {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
    pointer-events: auto;
  }

  .moon-choice-bar .ctrl-btn {
    width: 100%;
    max-width: 280px;
    white-space: nowrap;
  }

  /* After Sun snaps — Home docks here (fixed screen pin, not 3D) */
  .home-dock {
    position: absolute;
    left: 50%;
    bottom: max(22px, env(safe-area-inset-bottom, 0px) + 14px);
    transform: translateX(-50%);
    z-index: 22;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.7s ease;
  }

  .home-dock.visible {
    opacity: 1;
  }

  .home-dock-pin {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: radial-gradient(
      circle at 35% 30%,
      #f0f8ff 0%,
      #7ec8ff 45%,
      #2a7ad4 100%
    );
    box-shadow:
      0 0 4px 1px rgba(140, 210, 255, 0.95),
      0 0 10px 3px rgba(80, 160, 255, 0.65),
      0 0 18px 6px rgba(50, 120, 255, 0.35);
    animation: home-dock-pulse 1.8s ease-in-out infinite;
  }

  .home-dock-label {
    color: rgba(180, 220, 255, 0.95);
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    text-shadow:
      0 0 6px rgba(80, 160, 255, 0.85),
      0 0 14px rgba(60, 140, 255, 0.45);
    line-height: 1;
  }

  @keyframes home-dock-pulse {
    0%,
    100% {
      transform: scale(1);
      box-shadow:
        0 0 4px 1px rgba(140, 210, 255, 0.9),
        0 0 10px 3px rgba(80, 160, 255, 0.55),
        0 0 16px 5px rgba(50, 120, 255, 0.28);
    }
    50% {
      transform: scale(1.12);
      box-shadow:
        0 0 6px 2px rgba(160, 220, 255, 1),
        0 0 14px 5px rgba(90, 170, 255, 0.75),
        0 0 22px 8px rgba(60, 140, 255, 0.4);
    }
  }

  /* After GPS sat settles — fact + “Place the Moon” */
  .sat-bridge {
    position: absolute;
    left: 50%;
    top: 0;
    transform: translateX(-50%);
    width: min(92%, 300px);
    max-width: calc(100% - 2 * var(--universe-mute-clear, 52px));
    z-index: 20;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    padding: var(--universe-top-pad, calc(50px + env(safe-area-inset-top, 0px)))
      8px 0;
    pointer-events: none;
    box-sizing: border-box;
  }

  .sat-bridge-copy {
    margin: 0;
    width: 100%;
    color: #f0f4ff;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
    font-size: clamp(0.95rem, 3.5vw, 1.2rem);
    font-weight: 300;
    letter-spacing: 0.03em;
    line-height: 1.45;
    text-align: center;
    white-space: pre-line;
    text-shadow: 0 0 16px rgba(180, 210, 255, 0.3);
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 1.1s ease, transform 1.1s ease;
  }

  .sat-bridge-copy.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .sat-bridge-cta {
    pointer-events: auto;
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 1s ease, transform 1s ease;
  }

  .sat-bridge-cta.visible {
    opacity: 1;
    transform: translateY(0);
  }
`;

const HOME_TEXT = "Here's our home.";
const PROMPT_TEXT =
  "GPS satellites keep your maps working.\nDrag the satellite to where you think they actually orbit.";
const GPS_FACT_TEXT =
  "Most people put it much higher.\nGPS satellites actually orbit only about 20,200 km above Earth.";
const FARTHER_TEXT = "Now let's try something much farther.";
const FAR_ENOUGH_TEXT =
  "Okay, that's far enough.\nThe Moon isn't in another galaxy.";
const MOON_PLACE_TEXT = "Drag the Moon where you think it belongs.";
const ZOOM_FIRST_TEXT = "You might want to zoom out for this one first.";
const ZOOM_FIRST_FINEPRINT =
  "Once you hit Confirm, you can drag the Moon into place.";
const MOON_NEXT_TEXT =
  "Now that you've felt the real distance\nbetween Earth and the Moon…\nWould you like to keep going outward,\nor shall we talk about light?\nLight travels 299,792 km every second.\nEven that number becomes strange\nonce you start looking closely.";
const SUN_ZOOM_FIRST_TEXT =
  "Now for the Sun.\nZoom out a bit, then Confirm.";
const SUN_ZOOM_FIRST_FINEPRINT =
  "Once you hit Confirm, you can drag the Sun into place.";
const SUN_FAR_ENOUGH_TEXT =
  "Okay, that's far enough.\nHome is that tiny blue pin.";
const SUN_PLACE_TEXT = "Drag the Sun where you think it belongs.";

function PromptMessage({
  visible,
  text,
  far = false,
  placement = "top",
}: {
  visible: boolean;
  text: string;
  far?: boolean;
  placement?: "top" | "bottom";
}) {
  return (
    <div className={`universe-ui${placement === "bottom" ? " bottom" : ""}`}>
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

  /** Story starts after 🎧 unlock (autoplay needs a click) */
  const [audioReady, setAudioReady] = useState(false);
  const [openingActive, setOpeningActive] = useState(true);
  const [phoneExiting, setPhoneExiting] = useState(false);
  const [earthRevealed, setEarthRevealed] = useState(false);
  /** Hide 3D phone while answer-reveal card is up */
  const [openingReveal, setOpeningReveal] = useState(false);
  /** NDC y for centering the phone under the quiz options */
  const [phoneSlotNdcY, setPhoneSlotNdcY] = useState(-0.28);

  const [satelliteActive, setSatelliteActive] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);

  /** Post-sat bridge: GPS fact → farther line → Place Moon button */
  const [satBridgeVisible, setSatBridgeVisible] = useState(false);
  const [gpsFactVisible, setGpsFactVisible] = useState(false);
  const [fartherVisible, setFartherVisible] = useState(false);
  const [placeMoonBtnVisible, setPlaceMoonBtnVisible] = useState(false);
  /** NASA “pictures lie” overlay before moon zoom UI */
  const [moonIntroVisible, setMoonIntroVisible] = useState(false);

  const [moonPhase, setMoonPhase] = useState(false);
  const [moonVisible, setMoonVisible] = useState(false);
  const [moonInteractive, setMoonInteractive] = useState(false);
  const [zoomControlsVisible, setZoomControlsVisible] = useState(false);
  const [moonPromptVisible, setMoonPromptVisible] = useState(false);
  const [zoomFirstVisible, setZoomFirstVisible] = useState(false);
  /** Grayed-moon nudge — remount key restarts a soft CSS glow (no layout thrash) */
  const [confirmHintNudgeKey, setConfirmHintNudgeKey] = useState(0);
  const [farEnoughVisible, setFarEnoughVisible] = useState(false);
  const [moonLabelVisible, setMoonLabelVisible] = useState(false);
  /** 5s after “Farther than it looks” — branch copy + bottom choices */
  const [moonNextVisible, setMoonNextVisible] = useState(false);
  /** They yeeted the Moon past real distance before the snap */
  const [moonSmartAss, setMoonSmartAss] = useState(false);

  /** Solar System branch — true-scale Sun park → drag → 1 AU snap */
  const [sunPhase, setSunPhase] = useState(false);
  const [sunVisible, setSunVisible] = useState(false);
  const [sunInteractive, setSunInteractive] = useState(false);
  const [sunPromptVisible, setSunPromptVisible] = useState(false);
  const [sunLabelVisible, setSunLabelVisible] = useState(false);
  const [sunSmartAss, setSunSmartAss] = useState(false);
  /** After place — Home leaves 3D and docks to the bottom of the phone */
  const [sunHomeDocked, setSunHomeDocked] = useState(false);

  const [cameraZ, setCameraZ] = useState(CAMERA_Z);

  const handleAudioUnlocked = useCallback(() => {
    setAudioReady(true);
  }, []);

  /** After “Let's see what distance really is →” */
  const handleOpeningContinue = useCallback(() => {
    setOpeningReveal(false);
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
    window.setTimeout(() => {
      setSatBridgeVisible(true);
      setGpsFactVisible(true);
    }, 400);
    // Short pause, then invite the Moon beat
    window.setTimeout(() => {
      setFartherVisible(true);
      setPlaceMoonBtnVisible(true);
    }, 2800);
  }, []);

  /** “The Moon ?” — open the NASA truth overlay first */
  const handlePlaceMoon = useCallback(() => {
    setSatBridgeVisible(false);
    setGpsFactVisible(false);
    setFartherVisible(false);
    setPlaceMoonBtnVisible(false);
    setMoonIntroVisible(true);
  }, []);

  /** “Okay, let’s try.” — start zoom + grayed Moon beat */
  const handleMoonIntroContinue = useCallback(() => {
    setMoonIntroVisible(false);
    setMoonPhase(true);
    setMoonVisible(true);
    setZoomControlsVisible(true);
    setZoomFirstVisible(true);
  }, []);

  const handleZoomOut = useCallback(() => {
    if (sunPhase) {
      // Multiplicative 2× zoom-out — clear shrink, not a teleport
      setCameraZ((z) => {
        const next = Math.min(ZOOM_Z_SUN_MAX, z * ZOOM_Z_SUN_FACTOR);
        if (next >= ZOOM_Z_SUN_MAX - 0.001) {
          setFarEnoughVisible(true);
          setZoomFirstVisible(false);
        }
        return next;
      });
      return;
    }
    setCameraZ((z) => {
      const next = Math.min(ZOOM_Z_MAX, z + ZOOM_Z_STEP);
      if (next >= ZOOM_Z_MAX - 0.001) {
        setFarEnoughVisible(true);
        setZoomFirstVisible(false);
      }
      return next;
    });
  }, [sunPhase]);

  const handleZoomIn = useCallback(() => {
    if (sunPhase) {
      setFarEnoughVisible(false);
      setZoomFirstVisible(true);
      setCameraZ((z) => Math.max(ZOOM_Z_SUN_MIN, z / ZOOM_Z_SUN_FACTOR));
      return;
    }
    setFarEnoughVisible(false);
    setZoomFirstVisible(true);
    setCameraZ((z) => Math.max(ZOOM_Z_MIN, z - ZOOM_Z_STEP));
  }, [sunPhase]);

  const handleConfirm = useCallback(() => {
    setZoomControlsVisible(false);
    setFarEnoughVisible(false);
    setZoomFirstVisible(false);
    setConfirmHintNudgeKey(0);
    if (sunPhase) {
      setSunPromptVisible(false);
      setSunInteractive(true);
      window.setTimeout(() => setSunPromptVisible(true), 200);
      return;
    }
    setMoonPromptVisible(false);
    setMoonInteractive(true);
    window.setTimeout(() => setMoonPromptVisible(true), 200);
  }, [sunPhase]);

  const handleMoonGrayedTap = useCallback(() => {
    // Soft brightness flash only — no size change (keeps layout/WebGL smooth)
    setConfirmHintNudgeKey((k) => k + 1);
  }, []);

  const handleSunGrayedTap = useCallback(() => {
    setConfirmHintNudgeKey((k) => k + 1);
  }, []);

  /** Moon flies to 30× R; camera zooms out to fit — Earth stays face-on lower third */
  const handleMoonSnapStart = useCallback(() => {
    setMoonPromptVisible(false);
    setCameraZ(ZOOM_Z_MOON_FRAME);
  }, []);

  const handleMoonSettled = useCallback((info: { smartAss: boolean }) => {
    setMoonSmartAss(info.smartAss);
    window.setTimeout(() => setMoonLabelVisible(true), 200);
  }, []);

  /** Sun flies to 1 AU; Home docks bottom; camera reframes mid-gap */
  const handleSunSnapStart = useCallback(() => {
    setSunPromptVisible(false);
    setSunHomeDocked(true);
    setCameraZ(ZOOM_Z_SUN_FRAME);
  }, []);

  const handleSunSettled = useCallback((info: { smartAss: boolean }) => {
    setSunSmartAss(info.smartAss);
    window.setTimeout(() => setSunLabelVisible(true), 280);
  }, []);

  /** After the moon distance label lands, wait 5s then offer next branch */
  useEffect(() => {
    if (!moonLabelVisible || sunPhase) return;
    const t = window.setTimeout(() => setMoonNextVisible(true), 1700);
    return () => window.clearTimeout(t);
  }, [moonLabelVisible, sunPhase]);

  /** “Explore the Solar System ?” — Earth vs Sun only; clear moon/sat clutter */
  const handleExploreSolarSystem = useCallback(() => {
    setMoonNextVisible(false);
    setMoonLabelVisible(false);
    // Drop orbit lesson pieces — invisible / irrelevant at solar scale
    setMoonVisible(false);
    setMoonInteractive(false);
    setMoonPromptVisible(false);
    setSatelliteActive(false);
    setSunPhase(true);
    setSunVisible(true);
    setSunInteractive(false);
    setSunPromptVisible(false);
    setSunLabelVisible(false);
    setSunHomeDocked(false);
    setFarEnoughVisible(false);
    setZoomFirstVisible(true);
    setZoomControlsVisible(true);
    setConfirmHintNudgeKey(0);
    // Close readable frame: Home pin + grayed Sun
    setCameraZ(ZOOM_Z_SUN_MIN);
  }, []);

  const handleTellAboutLight = useCallback(() => {
    // Branch reserved for light / speed-of-light path
  }, []);

  const zoomMin = sunPhase ? ZOOM_Z_SUN_MIN : ZOOM_Z_MIN;
  const zoomMax = sunPhase ? ZOOM_Z_SUN_MAX : ZOOM_Z_MAX;
  const canZoomOut = cameraZ < zoomMax - 0.001;
  const canZoomIn = cameraZ > zoomMin + 0.001;

  // Top copy: moon beat or sun beat
  const phaseTopCopy = sunPhase
    ? sunInteractive
      ? SUN_PLACE_TEXT
      : farEnoughVisible
        ? SUN_FAR_ENOUGH_TEXT
        : ""
    : moonInteractive
      ? MOON_PLACE_TEXT
      : farEnoughVisible
        ? FAR_ENOUGH_TEXT
        : "";

  const showPhaseTopPrompt = sunPhase
    ? (farEnoughVisible && !sunInteractive) ||
      (sunPromptVisible && sunInteractive && phaseTopCopy.length > 0)
    : (moonPhase && farEnoughVisible && !moonInteractive) ||
      (moonPhase &&
        moonPromptVisible &&
        moonInteractive &&
        phaseTopCopy.length > 0);

  const zoomMidTitle = sunPhase ? SUN_ZOOM_FIRST_TEXT : ZOOM_FIRST_TEXT;
  const zoomMidFineprint = sunPhase
    ? SUN_ZOOM_FIRST_FINEPRINT
    : ZOOM_FIRST_FINEPRINT;

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
                far: 100000,
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
                targetY={sunHomeDocked ? CAMERA_Y_SUN_FRAME : 0}
                screenBias={
                  sunHomeDocked
                    ? 0.22
                    : sunPhase
                      ? HOME_SCREEN_BIAS
                      : EARTH_SCREEN_BIAS
                }
              />
              {audioReady && openingActive && !openingReveal && (
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
                onMoonGrayedTap={handleMoonGrayedTap}
                sunMode={sunPhase}
                sunHomeDocked={sunHomeDocked}
                sunVisible={sunVisible}
                sunInteractive={sunInteractive}
                sunParkCameraZ={cameraZ}
                onSunSnapStart={handleSunSnapStart}
                onSunSettled={handleSunSettled}
                onSunGrayedTap={handleSunGrayedTap}
              />
            </Canvas>
          </WebGLErrorBoundary>

          {/* After place: Home is a fixed bottom pin (not stuck mid-scene) */}
          <div
            className={`home-dock${sunHomeDocked ? " visible" : ""}`}
            aria-hidden={!sunHomeDocked}
          >
            <div className="home-dock-pin" />
            <span className="home-dock-label">Home</span>
          </div>

          {/* Always mounted — unmounting would stop the looping <audio> */}
          <AudioGate onUnlocked={handleAudioUnlocked} />

          <OpeningQuiz
            active={audioReady && openingActive && !phoneExiting}
            onContinue={handleOpeningContinue}
            onPhoneSlotNdc={setPhoneSlotNdcY}
            onRevealPhase={setOpeningReveal}
          />
          <PromptMessage visible={promptVisible} text={PROMPT_TEXT} />
          <PromptMessage
            visible={promptVisible}
            text={HOME_TEXT}
            placement="bottom"
          />
          {satBridgeVisible && (
            <div className="sat-bridge">
              <p
                className={`sat-bridge-copy${gpsFactVisible ? " visible" : ""}`}
              >
                {GPS_FACT_TEXT}
              </p>
              <p
                className={`sat-bridge-copy${fartherVisible ? " visible" : ""}`}
              >
                {FARTHER_TEXT}
              </p>
              <button
                type="button"
                className={`ctrl-btn rect sat-bridge-cta${
                  placeMoonBtnVisible ? " visible" : ""
                }`}
                onClick={handlePlaceMoon}
              >
                The Moon ?
              </button>
            </div>
          )}
          <MoonIntroOverlay
            visible={moonIntroVisible}
            onContinue={handleMoonIntroContinue}
          />
          <PromptMessage
            visible={showPhaseTopPrompt}
            text={phaseTopCopy}
            far={
              farEnoughVisible &&
              (sunPhase ? !sunInteractive : !moonInteractive)
            }
          />
          <div
            className={`universe-orbit-label moon-label${
              moonLabelVisible ? " visible" : ""
            }`}
          >
            {moonSmartAss
              ? "Impressive. You've just placed the Moon somewhere near Mars."
              : "Farther than it looks."}
            <span className="moon-label-sub">
              The Moon is actually about 384,000 km away, roughly 30 Earth
              diameters.
            </span>
            <span
              className={`moon-next-copy${moonNextVisible ? " visible" : ""}`}
            >
              {MOON_NEXT_TEXT}
            </span>
          </div>
          <div
            className={`universe-orbit-label moon-label sun-label${
              sunLabelVisible ? " visible" : ""
            }`}
          >
            {sunSmartAss
              ? "That's past the Kuiper belt. Ambitious."
              : "The Sun is much farther than it feels."}
            <span className="moon-label-sub">
              About 150 million km (1 AU). Size is simplified so you can see
              it — real Sun is ~109× Earth’s width. Distance here is true for
              this scale (~215 Sun-widths from Home).
            </span>
          </div>
          <div
            className={`moon-choice-bar${moonNextVisible ? " visible" : ""}`}
            aria-hidden={!moonNextVisible}
          >
            <button
              type="button"
              className="ctrl-btn rect"
              disabled={!moonNextVisible}
              onClick={handleExploreSolarSystem}
            >
              Explore the Solar System ?
            </button>
            <button
              type="button"
              className="ctrl-btn rect"
              disabled={!moonNextVisible}
              onClick={handleTellAboutLight}
            >
              Tell me about light
            </button>
          </div>
          <ZoomControls
            visible={zoomControlsVisible}
            canZoomIn={canZoomIn}
            canZoomOut={canZoomOut}
            showMidCopy={zoomFirstVisible && !farEnoughVisible}
            fineprintNudgeKey={confirmHintNudgeKey}
            midTitle={zoomMidTitle}
            midFineprint={zoomMidFineprint}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onConfirm={handleConfirm}
          />
        </div>
      </div>
    </>
  );
}
