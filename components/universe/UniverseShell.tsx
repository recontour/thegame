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
import OpeningPhone from "@/components/universe/OpeningPhone";
import OpeningQuiz from "@/components/universe/OpeningQuiz";
import PhotoSheetOverlay from "@/components/universe/PhotoSheetOverlay";
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
    /* Shared side gutter — mute clear is top-only, not side margin */
    padding: var(--universe-top-pad, calc(10dvh + env(safe-area-inset-top, 0px)))
      var(--universe-side-pad, 20px) 0;
  }

  .universe-ui.bottom {
    top: auto;
    bottom: 0;
    align-items: flex-end;
    padding: 0 var(--universe-side-pad, 20px)
      calc(4dvh + env(safe-area-inset-bottom, 0px));
  }

  /* Animation shell only — type via .u-h1 / .u-p1 */
  .universe-message {
    max-width: 100%;
    white-space: pre-line;
    opacity: 0;
    transform: translateY(12px);
    transition:
      opacity 1.65s cubic-bezier(0.22, 1, 0.36, 1),
      transform 1.65s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .universe-message.far-text {
    color: #c8d6f0;
  }

  .universe-message.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .universe-orbit-label {
    position: absolute;
    left: 0;
    right: 0;
    top: 62%;
    transform: none;
    z-index: 11;
    pointer-events: none;
    text-align: center;
    opacity: 0;
    transition: opacity 1.2s ease;
    width: 100%;
    max-width: 100%;
    padding: 0 var(--universe-side-pad, 20px);
    box-sizing: border-box;
  }

  .universe-orbit-label.visible {
    opacity: 1;
  }

  .universe-orbit-label.moon-label {
    /* Between Moon (high) and Earth (lower third) — not glued to the disc */
    top: 32%;
  }

  .universe-orbit-label .moon-label-lead {
    display: block;
  }

  .universe-orbit-label .moon-label-sub {
    display: block;
    margin-top: 8px;
  }

  /* After “Farther than it looks” — next branch copy under the label */
  .moon-next-copy {
    display: block;
    margin-top: 0;
    max-height: 0;
    overflow: hidden;
    white-space: pre-line;
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
    width: min(100%, 300px);
    max-width: calc(100% - 2 * var(--universe-side-pad, 20px));
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

  /* Light lesson — copy sits mid-upper so the Moon isn’t covered */
  .light-story {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    transform: none;
    width: 100%;
    max-width: 100%;
    z-index: 22;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    /* Push past the Moon band (Moon sits high on the column) */
    padding:
      calc(var(--universe-top-pad, calc(10dvh + env(safe-area-inset-top, 0px))) + 12vh)
      var(--universe-side-pad, 20px) 0;
    pointer-events: none;
    box-sizing: border-box;
    text-align: center;
  }

  .light-story-intro {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    width: 100%;
    opacity: 1;
    transition: opacity 0.85s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .light-story-intro.is-hidden {
    opacity: 0;
    pointer-events: none;
    max-height: 0;
    gap: 0;
    overflow: hidden;
    transition:
      opacity 0.7s ease,
      max-height 0.7s ease,
      gap 0.7s ease;
  }

  .light-story-title {
    /* .u-h1 + section accent */
    color: #f5f0e4;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-shadow: 0 0 20px rgba(255, 210, 120, 0.35);
    opacity: 0;
    transform: translateY(12px);
    transition:
      opacity 1.3s cubic-bezier(0.22, 1, 0.36, 1),
      transform 1.3s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .light-story-line {
    max-width: 32em;
    opacity: 0;
    transform: translateY(12px);
    transition:
      opacity 1.25s cubic-bezier(0.22, 1, 0.36, 1),
      transform 1.25s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .light-story-line.arrive {
    color: rgba(255, 255, 255, 0.96);
  }

  .light-story .is-on {
    opacity: 1;
    transform: translateY(0);
  }

  /* Show me — solid rise-in (same as sat-bridge / Our solar system CTAs) */
  .ctrl-btn.light-story-show-btn {
    margin-top: 6px;
    pointer-events: none;
    opacity: 0;
    transform: translateY(16px);
    background: linear-gradient(145deg, #1e2a3a, #151d28);
    border: 1px solid rgba(160, 190, 255, 0.15);
    box-shadow:
      4px 4px 10px rgba(0, 0, 0, 0.45),
      -2px -2px 6px rgba(80, 120, 180, 0.08),
      inset 0 1px 1px rgba(255, 255, 255, 0.05),
      0 0 14px rgba(120, 170, 255, 0.12);
    color: #e8f0ff;
    cursor: default;
    transition:
      opacity 1.05s cubic-bezier(0.22, 1, 0.36, 1),
      transform 1.05s cubic-bezier(0.22, 1, 0.36, 1),
      box-shadow 0.15s ease;
  }

  .ctrl-btn.light-story-show-btn.is-on {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
    cursor: pointer;
  }

  .ctrl-btn.light-story-show-btn:disabled {
    opacity: 0;
    background: linear-gradient(145deg, #1e2a3a, #151d28);
    border: 1px solid rgba(160, 190, 255, 0.15);
    box-shadow:
      4px 4px 10px rgba(0, 0, 0, 0.45),
      -2px -2px 6px rgba(80, 120, 180, 0.08),
      inset 0 1px 1px rgba(255, 255, 255, 0.05),
      0 0 14px rgba(120, 170, 255, 0.12);
    color: #e8f0ff;
    cursor: default;
    transform: translateY(16px);
  }

  .ctrl-btn.light-story-show-btn.is-on:disabled {
    opacity: 1;
    transform: translateY(0);
  }

  /*
   * Live timer — sits just under Earth (globe is optically lower third
   * via view-offset bias). Stays up after the solar CTA appears.
   */
  .light-timer {
    position: absolute;
    left: 50%;
    top: 78%;
    transform: translate(-50%, 0);
    z-index: 22;
    pointer-events: none;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.06em;
    /* Bigger than body/title defaults so the count reads as the hero */
    font-size: clamp(1.85rem, 7.5vw, 2.6rem) !important;
    font-weight: 500;
    line-height: 1.1;
    opacity: 0;
    transition: opacity 0.5s ease;
  }

  .light-timer.is-on {
    opacity: 1;
  }

  .light-solar-cta {
    position: absolute;
    left: 50%;
    bottom: max(28px, env(safe-area-inset-bottom, 0px) + 20px);
    transform: translateX(-50%) translateY(10px);
    z-index: 23;
    width: min(100%, 300px);
    max-width: calc(100% - 2 * var(--universe-side-pad, 20px));
    pointer-events: none;
    opacity: 0;
    transition:
      opacity 1s cubic-bezier(0.22, 1, 0.36, 1),
      transform 1s cubic-bezier(0.22, 1, 0.36, 1);
    box-sizing: border-box;
  }

  .light-solar-cta.is-on {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
    pointer-events: auto;
  }

  .light-solar-cta .ctrl-btn {
    width: 100%;
  }

  /* Post-sun shared reveal + path branch (same top push as light story) */
  .sun-reveal {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    transform: none;
    width: 100%;
    max-width: 100%;
    z-index: 22;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    /* Clear the Sun disc — same offset as light beam copy */
    padding:
      calc(var(--universe-top-pad, calc(10dvh + env(safe-area-inset-top, 0px))) + 12vh)
      var(--universe-side-pad, 20px) 0;
    pointer-events: none;
    box-sizing: border-box;
    text-align: center;
    opacity: 0;
    transition: opacity 0.9s ease;
  }

  .sun-reveal.visible {
    opacity: 1;
  }

  .sun-reveal-line {
    max-width: 32em;
    opacity: 0;
    transform: translateY(12px);
    transition:
      opacity 1.25s cubic-bezier(0.22, 1, 0.36, 1),
      transform 1.25s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .sun-reveal-line.is-on {
    opacity: 1;
    transform: translateY(0);
  }

  /* Same solid rise-in as sat-bridge CTAs / Distance in light */
  .ctrl-btn.sun-reveal-cta {
    margin-top: 8px;
    width: min(100%, 280px);
    pointer-events: none;
    opacity: 0;
    transform: translateY(16px);
    background: linear-gradient(145deg, #1e2a3a, #151d28);
    border: 1px solid rgba(160, 190, 255, 0.15);
    box-shadow:
      4px 4px 10px rgba(0, 0, 0, 0.45),
      -2px -2px 6px rgba(80, 120, 180, 0.08),
      inset 0 1px 1px rgba(255, 255, 255, 0.05),
      0 0 14px rgba(120, 170, 255, 0.12);
    color: #e8f0ff;
    cursor: default;
    transition:
      opacity 1.05s cubic-bezier(0.22, 1, 0.36, 1),
      transform 1.05s cubic-bezier(0.22, 1, 0.36, 1),
      box-shadow 0.15s ease;
  }

  .ctrl-btn.sun-reveal-cta.is-on {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
    cursor: pointer;
  }

  .ctrl-btn.sun-reveal-cta:disabled {
    opacity: 0;
    background: linear-gradient(145deg, #1e2a3a, #151d28);
    border: 1px solid rgba(160, 190, 255, 0.15);
    box-shadow:
      4px 4px 10px rgba(0, 0, 0, 0.45),
      -2px -2px 6px rgba(80, 120, 180, 0.08),
      inset 0 1px 1px rgba(255, 255, 255, 0.05),
      0 0 14px rgba(120, 170, 255, 0.12);
    color: #e8f0ff;
    cursor: default;
    transform: translateY(16px);
  }

  .ctrl-btn.sun-reveal-cta.is-on:disabled {
    opacity: 1;
    transform: translateY(0);
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
    font-family: var(--font-u-btn), "Inter", system-ui, sans-serif;
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

  /*
   * Earth + sat stage copy band:
   * fills top → just above satellite/Earth, content vertically centered
   * so GPS / lie / try-yourself steps share the same layout.
   */
  .sat-bridge {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    /* Lower ~42% reserved for globe + sat orbit */
    bottom: 42%;
    z-index: 20;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding:
      var(--universe-top-pad, calc(10dvh + env(safe-area-inset-top, 0px)))
      var(--universe-side-pad, 20px)
      12px;
    pointer-events: none;
    box-sizing: border-box;
  }

  /* One active step stack — only this participates in centering */
  .sat-bridge-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    padding: 0;
  }

  .sat-bridge-copy {
    width: 100%;
    white-space: pre-line;
    opacity: 0;
    transform: translateY(14px);
    transition:
      opacity 1.15s cubic-bezier(0.22, 1, 0.36, 1),
      transform 1.15s cubic-bezier(0.22, 1, 0.36, 1);
    box-sizing: border-box;
  }

  .sat-bridge-copy.visible {
    opacity: 1;
    transform: translateY(0);
  }

  /*
   * Stage CTAs — solid look the whole time; only opacity + rise.
   * (Don’t use :disabled gray during entrance or they flash transparent.)
   */
  .ctrl-btn.sat-bridge-cta {
    pointer-events: none;
    opacity: 0;
    transform: translateY(16px);
    max-width: min(100%, 300px);
    width: auto;
    padding-left: 18px;
    padding-right: 18px;
    white-space: normal;
    text-align: center;
    line-height: 1.3;
    height: auto;
    min-height: 52px;
    /* Keep full solid chrome even while hidden / :disabled */
    background: linear-gradient(145deg, #1e2a3a, #151d28);
    border: 1px solid rgba(160, 190, 255, 0.15);
    box-shadow:
      4px 4px 10px rgba(0, 0, 0, 0.45),
      -2px -2px 6px rgba(80, 120, 180, 0.08),
      inset 0 1px 1px rgba(255, 255, 255, 0.05),
      0 0 14px rgba(120, 170, 255, 0.12);
    color: #e8f0ff;
    cursor: default;
    transition:
      opacity 1.05s cubic-bezier(0.22, 1, 0.36, 1),
      transform 1.05s cubic-bezier(0.22, 1, 0.36, 1),
      box-shadow 0.15s ease;
  }

  .ctrl-btn.sat-bridge-cta.visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
    cursor: pointer;
  }

  /* Beat the global .ctrl-btn:disabled { opacity: 0.35 } while waiting to appear */
  .ctrl-btn.sat-bridge-cta:disabled {
    opacity: 0;
    background: linear-gradient(145deg, #1e2a3a, #151d28);
    border: 1px solid rgba(160, 190, 255, 0.15);
    box-shadow:
      4px 4px 10px rgba(0, 0, 0, 0.45),
      -2px -2px 6px rgba(80, 120, 180, 0.08),
      inset 0 1px 1px rgba(255, 255, 255, 0.05),
      0 0 14px rgba(120, 170, 255, 0.12);
    color: #e8f0ff;
    cursor: default;
    transform: translateY(16px);
  }

  .ctrl-btn.sat-bridge-cta.visible:disabled {
    opacity: 1;
    transform: translateY(0);
  }

  /* “Wonder…?” — type via .u-p1; same rise as copy */
  .sat-bridge-prompt {
    width: 100%;
    opacity: 0;
    transform: translateY(14px);
    transition:
      opacity 1.1s cubic-bezier(0.22, 1, 0.36, 1),
      transform 1.1s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .sat-bridge-prompt.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .sat-bridge-choice-row {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    max-width: 320px;
  }

  .sat-bridge-choice-row .sat-bridge-cta {
    flex: 1 1 auto;
    min-width: 120px;
    max-width: 150px;
  }
`;

const HOME_TEXT = "Here's our home.";
const PROMPT_TEXT =
  "GPS satellites keep your maps working.\nDrag the satellite to where you think they actually orbit.";
const GPS_FACT_TEXT =
  "Most people put it much higher.\nGPS satellites actually orbit only about 20,200 km above Earth.";
const FARTHER_TEXT = "Now let's try something much farther.";
const MOON_LIE_TITLE = "Most pictures lie.";
const MOON_LIE_BODY =
  "The usual images of Earth and the Moon\nsqueeze them close so they fit on a page.\nThat quiet compression slowly shrinks\nwhat we believe is possible.";
const MOON_TRY_TEXT =
  "Now try it yourself,\nplace the Moon where you actually think it belongs.";
const SUN_LIE_TITLE = "Most pictures still lie.";
const SUN_LIE_BODY =
  "Even the best photographs of the Sun\nare only a flat circle of fire.\nThey cannot show you how far it really sits\nfrom the small blue world we call home.";
const SUN_WONDER_PROMPT = "Want to see what the Sun looks like?";
const NASA_MOON_PHOTO = "/universe/photos/nasamoonandearth.webp";
const NASA_MOON_LINK =
  "https://www.nasa.gov/image-detail/amf-art002e009285/";
const NASA_SUN_PHOTO = "/universe/photos/sun.webp";
const NASA_SUN_LINK =
  "https://science.nasa.gov/image-detail/amf-gsfc_20171208_archive_e001435/";
const FAR_ENOUGH_TEXT =
  "Okay, that's far enough.\nThe Moon isn't in another galaxy.";
const MOON_PLACE_TEXT = "Drag the Moon where you think it belongs.";
const ZOOM_FIRST_TEXT = "You might want to zoom out for this one first.";
const ZOOM_FIRST_FINEPRINT =
  "Once you hit Confirm, you can drag the Moon into place.";
const MOON_NEXT_TEXT =
  "Now that you've felt the real distance\nbetween Earth and the Moon…\nLight travels 299,792 km every second.\nEven that number becomes strange\nonce you start looking closely.";
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
  tone = "p1",
}: {
  visible: boolean;
  text: string;
  far?: boolean;
  placement?: "top" | "bottom";
  /** Type scale: h1 (Roboto) or p1 (Open Sans) */
  tone?: "h1" | "p1";
}) {
  return (
    <div className={`universe-ui${placement === "bottom" ? " bottom" : ""}`}>
      <p
        className={`universe-message u-${tone}${far ? " far-text" : ""}${
          visible ? " visible" : ""
        }`}
        aria-live="polite"
      >
        {text}
      </p>
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
  /**
   * Moon intro on the Earth stage (not a big form):
   * lie copy → NASA photo overlay → try-yourself + Place moon
   */
  const [moonLieVisible, setMoonLieVisible] = useState(false);
  const [moonWonderBtnVisible, setMoonWonderBtnVisible] = useState(false);
  const [moonPhotoOverlayVisible, setMoonPhotoOverlayVisible] =
    useState(false);
  const [moonTryVisible, setMoonTryVisible] = useState(false);
  const [moonPlaceBtnVisible, setMoonPlaceBtnVisible] = useState(false);

  /** After light → before Sun zoom: “pictures still lie” + optional NASA sun photo */
  const [sunLieVisible, setSunLieVisible] = useState(false);
  const [sunWonderVisible, setSunWonderVisible] = useState(false);
  const [sunPhotoOverlayVisible, setSunPhotoOverlayVisible] = useState(false);

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
  /** Post-sun reveal cascade (linear: Moon → Light → Sun) */
  const [sunRevealL1, setSunRevealL1] = useState(false);
  const [sunRevealL2, setSunRevealL2] = useState(false);
  const [sunRevealBranch, setSunRevealBranch] = useState(false);
  const [sunRevealBtn, setSunRevealBtn] = useState(false);

  /** Light lesson — copy steps + Moon→Earth beam */
  const [lightPhase, setLightPhase] = useState(false);
  const [lightTitleOn, setLightTitleOn] = useState(false);
  const [lightL1On, setLightL1On] = useState(false);
  const [lightL2On, setLightL2On] = useState(false);
  const [lightL3On, setLightL3On] = useState(false);
  const [lightShowBtnOn, setLightShowBtnOn] = useState(false);
  const [lightIntroHidden, setLightIntroHidden] = useState(false);
  const [lightBeamActive, setLightBeamActive] = useState(false);
  const [lightTimerOn, setLightTimerOn] = useState(false);
  const [lightTimerSec, setLightTimerSec] = useState(0);
  const [lightArriveOn, setLightArriveOn] = useState(false);
  const [lightSolarBtnOn, setLightSolarBtnOn] = useState(false);

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

  /** “The Moon ?” — show “Most pictures lie” on the Earth stage */
  const handleTheMoon = useCallback(() => {
    setGpsFactVisible(false);
    setFartherVisible(false);
    setPlaceMoonBtnVisible(false);
    setMoonLieVisible(true);
    window.setTimeout(() => setMoonWonderBtnVisible(true), 700);
  }, []);

  /** “Absolutely” — full opaque NASA photo sheet */
  const handleWonderAbsolutely = useCallback(() => {
    setMoonWonderBtnVisible(false);
    setMoonPhotoOverlayVisible(true);
  }, []);

  /** “Not really” — skip photo, go straight to try-yourself + Place moon */
  const handleWonderNotReally = useCallback(() => {
    setMoonWonderBtnVisible(false);
    setMoonLieVisible(false);
    setMoonTryVisible(true);
    window.setTimeout(() => setMoonPlaceBtnVisible(true), 500);
  }, []);

  /** Leave photo sheet → try-yourself + Place moon on Earth stage */
  const handleMoonPhotoNext = useCallback(() => {
    setMoonPhotoOverlayVisible(false);
    setMoonLieVisible(false);
    setMoonTryVisible(true);
    window.setTimeout(() => setMoonPlaceBtnVisible(true), 500);
  }, []);

  /** “Place moon” — start grayed Moon + zoom beat */
  const handlePlaceMoon = useCallback(() => {
    setSatBridgeVisible(false);
    setMoonTryVisible(false);
    setMoonPlaceBtnVisible(false);
    setMoonLieVisible(false);
    setMoonWonderBtnVisible(false);
    setMoonPhase(true);
    setMoonVisible(true);
    window.setTimeout(() => {
      setZoomControlsVisible(true);
      setZoomFirstVisible(true);
    }, 180);
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
    setSunRevealL1(false);
    setSunRevealL2(false);
    setSunRevealBranch(false);
    setSunRevealBtn(false);
    window.setTimeout(() => setSunLabelVisible(true), 280);
  }, []);

  /** Shared sun reveal → branch copy → CTA */
  useEffect(() => {
    if (!sunLabelVisible) return;
    const t1 = window.setTimeout(() => setSunRevealL1(true), 200);
    const t2 = window.setTimeout(() => setSunRevealL2(true), 1400);
    const t3 = window.setTimeout(() => setSunRevealBranch(true), 2800);
    const t4 = window.setTimeout(() => setSunRevealBtn(true), 4000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, [sunLabelVisible]);

  /** After the moon distance label lands, wait then offer next branch */
  useEffect(() => {
    if (!moonLabelVisible || sunPhase || lightPhase) return;
    const t = window.setTimeout(() => setMoonNextVisible(true), 1700);
    return () => window.clearTimeout(t);
  }, [moonLabelVisible, sunPhase, lightPhase]);

  /**
   * “Let’s go to our solar system” — not straight into zoom.
   * First: still-lie copy + Absolutely / Not really (same pattern as Moon).
   */
  const handleSolarSystemInvite = useCallback(() => {
    setLightSolarBtnOn(false);
    setLightArriveOn(false);
    setLightTimerOn(false);
    setLightBeamActive(false);
    setLightIntroHidden(true);
    setLightTitleOn(false);
    setLightL1On(false);
    setLightL2On(false);
    setLightL3On(false);
    setLightShowBtnOn(false);
    setLightPhase(false);
    setSunLieVisible(true);
    window.setTimeout(() => setSunWonderVisible(true), 700);
  }, []);

  /** “Absolutely” — NASA Sun photo sheet */
  const handleSunWonderAbsolutely = useCallback(() => {
    setSunWonderVisible(false);
    setSunPhotoOverlayVisible(true);
  }, []);

  /** “Not really” or photo Next → Now for the Sun (zoom beat) */
  const handleExploreSolarSystem = useCallback(() => {
    setSunLieVisible(false);
    setSunWonderVisible(false);
    setSunPhotoOverlayVisible(false);
    setMoonNextVisible(false);
    setMoonLabelVisible(false);
    setLightPhase(false);
    setLightBeamActive(false);
    setLightTimerOn(false);
    setLightSolarBtnOn(false);
    setLightArriveOn(false);
    setLightIntroHidden(false);
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
    setSunRevealL1(false);
    setSunRevealL2(false);
    setSunRevealBranch(false);
    setSunRevealBtn(false);
    setSunHomeDocked(false);
    setFarEnoughVisible(false);
    setZoomFirstVisible(true);
    setZoomControlsVisible(true);
    setConfirmHintNudgeKey(0);
    setCameraZ(ZOOM_Z_SUN_MIN);
  }, []);

  const handleSunPhotoNext = useCallback(() => {
    setSunPhotoOverlayVisible(false);
    setSunLieVisible(false);
    // Brief beat, then sun zoom UI
    window.setTimeout(() => handleExploreSolarSystem(), 200);
  }, [handleExploreSolarSystem]);

  const handleSunWonderNotReally = useCallback(() => {
    setSunWonderVisible(false);
    setSunLieVisible(false);
    handleExploreSolarSystem();
  }, [handleExploreSolarSystem]);

  /** Linear step: Moon → Distance in light (Earth–Moon frame + copy) */
  const handleDistanceInLight = useCallback(() => {
    setMoonNextVisible(false);
    setMoonLabelVisible(false);
    setLightTitleOn(false);
    setLightL1On(false);
    setLightL2On(false);
    setLightL3On(false);
    setLightShowBtnOn(false);
    setLightIntroHidden(false);
    setLightBeamActive(false);
    setLightTimerOn(false);
    setLightTimerSec(0);
    setLightArriveOn(false);
    setLightSolarBtnOn(false);
    setCameraZ(ZOOM_Z_MOON_FRAME);
    setLightPhase(true);
  }, []);

  /** Cascade intro lines, then “Show me” — beam waits for the click */
  useEffect(() => {
    if (!lightPhase) return;
    const t0 = window.setTimeout(() => setLightTitleOn(true), 280);
    const t1 = window.setTimeout(() => setLightL1On(true), 900);
    const t2 = window.setTimeout(() => setLightL2On(true), 2000);
    const t3 = window.setTimeout(() => setLightL3On(true), 3200);
    const tBtn = window.setTimeout(() => setLightShowBtnOn(true), 4300);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(tBtn);
    };
  }, [lightPhase]);

  /** Live timer while the photon flies (anim is 2.8s; label maps to 1.3s light-time) */
  const LIGHT_BEAM_DURATION = 2.8;
  const LIGHT_TIME_SEC = 1.3;
  useEffect(() => {
    if (!lightBeamActive) return;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const e = (performance.now() - start) / 1000;
      const u = Math.min(e / LIGHT_BEAM_DURATION, 1);
      setLightTimerSec(LIGHT_TIME_SEC * u);
      if (u < 1) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [lightBeamActive]);

  const handleLightShowMe = useCallback(() => {
    setLightShowBtnOn(false);
    setLightIntroHidden(true);
    setLightTimerSec(0);
    setLightTimerOn(true);
    // Let intro fade a beat, then fire the beam
    window.setTimeout(() => setLightBeamActive(true), 400);
  }, []);

  const handleLightBeamComplete = useCallback(() => {
    setLightTimerSec(1.3);
    // Keep timer under Earth; only advance the story copy + solar CTA
    window.setTimeout(() => {
      setLightArriveOn(true);
      window.setTimeout(() => setLightSolarBtnOn(true), 900);
    }, 400);
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
                lightBeamActive={lightBeamActive}
                onLightBeamComplete={handleLightBeamComplete}
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
          <PromptMessage visible={promptVisible} text={PROMPT_TEXT} tone="p1" />
          <PromptMessage
            visible={promptVisible}
            text={HOME_TEXT}
            placement="bottom"
            tone="h1"
          />
          {satBridgeVisible && (
            <div className="sat-bridge">
              {/*
                Each step mounts its FULL stack at once; lines/buttons only
                toggle .visible so layout doesn’t reflow (no jump).
              */}
              {/* Step 1: GPS + farther + The Moon ? */}
              {!moonLieVisible && !moonTryVisible && (
                <div className="sat-bridge-stack">
                  <p
                    className={`sat-bridge-copy u-p1${
                      gpsFactVisible ? " visible" : ""
                    }`}
                  >
                    {GPS_FACT_TEXT}
                  </p>
                  <p
                    className={`sat-bridge-copy u-h1${
                      fartherVisible ? " visible" : ""
                    }`}
                  >
                    {FARTHER_TEXT}
                  </p>
                  <button
                    type="button"
                    className={`ctrl-btn rect sat-bridge-cta${
                      placeMoonBtnVisible ? " visible" : ""
                    }`}
                    disabled={!placeMoonBtnVisible}
                    onClick={handleTheMoon}
                  >
                    The Moon ?
                  </button>
                </div>
              )}
              {/* Step 2: lie + wonder prompt + Absolutely / Not really */}
              {moonLieVisible && !moonPhotoOverlayVisible && (
                <div className="sat-bridge-stack">
                  <h2 className="sat-bridge-copy u-h1 visible">
                    {MOON_LIE_TITLE}
                  </h2>
                  <p className="sat-bridge-copy u-p1 visible">{MOON_LIE_BODY}</p>
                  <p
                    className={`sat-bridge-prompt u-p1${
                      moonWonderBtnVisible ? " visible" : ""
                    }`}
                  >
                    Wonder what Earth looks like from the Moon?
                  </p>
                  <div className="sat-bridge-choice-row">
                    <button
                      type="button"
                      className={`ctrl-btn rect sat-bridge-cta${
                        moonWonderBtnVisible ? " visible" : ""
                      }`}
                      disabled={!moonWonderBtnVisible}
                      onClick={handleWonderAbsolutely}
                    >
                      Absolutely
                    </button>
                    <button
                      type="button"
                      className={`ctrl-btn rect sat-bridge-cta${
                        moonWonderBtnVisible ? " visible" : ""
                      }`}
                      disabled={!moonWonderBtnVisible}
                      onClick={handleWonderNotReally}
                    >
                      Not really
                    </button>
                  </div>
                </div>
              )}
              {/* Step 3: try yourself + Place moon */}
              {moonTryVisible && (
                <div className="sat-bridge-stack">
                  <p className="sat-bridge-copy u-p1 visible">{MOON_TRY_TEXT}</p>
                  <button
                    type="button"
                    className={`ctrl-btn rect sat-bridge-cta${
                      moonPlaceBtnVisible ? " visible" : ""
                    }`}
                    disabled={!moonPlaceBtnVisible}
                    onClick={handlePlaceMoon}
                  >
                    Place moon
                  </button>
                </div>
              )}
            </div>
          )}
          {/* Sun lie — full stack mounted; prompt/buttons only fade in */}
          {sunLieVisible && !sunPhotoOverlayVisible && (
            <div className="sat-bridge">
              <div className="sat-bridge-stack">
                <h2 className="sat-bridge-copy u-h1 visible">{SUN_LIE_TITLE}</h2>
                <p className="sat-bridge-copy u-p1 visible">{SUN_LIE_BODY}</p>
                <p
                  className={`sat-bridge-prompt u-p1${
                    sunWonderVisible ? " visible" : ""
                  }`}
                >
                  {SUN_WONDER_PROMPT}
                </p>
                <div className="sat-bridge-choice-row">
                  <button
                    type="button"
                    className={`ctrl-btn rect sat-bridge-cta${
                      sunWonderVisible ? " visible" : ""
                    }`}
                    disabled={!sunWonderVisible}
                    onClick={handleSunWonderAbsolutely}
                  >
                    Absolutely
                  </button>
                  <button
                    type="button"
                    className={`ctrl-btn rect sat-bridge-cta${
                      sunWonderVisible ? " visible" : ""
                    }`}
                    disabled={!sunWonderVisible}
                    onClick={handleSunWonderNotReally}
                  >
                    Not really
                  </button>
                </div>
              </div>
            </div>
          )}
          <PhotoSheetOverlay
            visible={moonPhotoOverlayVisible}
            onNext={handleMoonPhotoNext}
            imageSrc={NASA_MOON_PHOTO}
            imageAlt="Earth and Moon — NASA"
            creditHref={NASA_MOON_LINK}
          />
          <PhotoSheetOverlay
            visible={sunPhotoOverlayVisible}
            onNext={handleSunPhotoNext}
            imageSrc={NASA_SUN_PHOTO}
            imageAlt="The Sun — NASA"
            creditHref={NASA_SUN_LINK}
          />
          <PromptMessage
            visible={showPhaseTopPrompt}
            text={phaseTopCopy}
            tone="p1"
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
            <span className="moon-label-lead u-h1">
              {moonSmartAss
                ? "Impressive. You've just placed the Moon somewhere near Mars."
                : "Farther than it looks."}
            </span>
            <span className="moon-label-sub u-p1">
              The Moon is actually about 384,000 km away, roughly 30 Earth
              diameters.
            </span>
            <span
              className={`moon-next-copy u-p1${
                moonNextVisible ? " visible" : ""
              }`}
            >
              {MOON_NEXT_TEXT}
            </span>
          </div>
          <div
            className={`sun-reveal${sunLabelVisible ? " visible" : ""}`}
            aria-live="polite"
            aria-hidden={!sunLabelVisible}
          >
            {sunSmartAss && (
              <p
                className={`sun-reveal-line u-h1${
                  sunRevealL1 ? " is-on" : ""
                }`}
              >
                That&apos;s past the Kuiper belt. Ambitious.
              </p>
            )}
            <p
              className={`sun-reveal-line u-p1${sunRevealL1 ? " is-on" : ""}`}
            >
              The Sun is about 150 million kilometres away. That&apos;s 1
              Astronomical Unit — the basic measuring stick of our solar
              system.
            </p>
            <p
              className={`sun-reveal-line u-p1${sunRevealL2 ? " is-on" : ""}`}
            >
              Light from the Sun takes roughly 8 minutes and 20 seconds to reach
              us.
            </p>
            <p
              className={`sun-reveal-line u-p1${
                sunRevealBranch ? " is-on" : ""
              }`}
            >
              You already watched light cross the gap from the Moon. Now you
              know it needs more than 8 minutes just to reach us from the Sun.
              The next step is even larger.
            </p>
            <button
              type="button"
              className={`ctrl-btn rect sun-reveal-cta${
                sunRevealBtn ? " is-on" : ""
              }`}
              disabled={!sunRevealBtn}
              onClick={() => {
                // Reserved for the next, larger solar step
              }}
            >
              Our solar system
            </button>
          </div>
          <div
            className={`moon-choice-bar${moonNextVisible ? " visible" : ""}`}
            aria-hidden={!moonNextVisible}
          >
            <button
              type="button"
              className="ctrl-btn rect"
              disabled={!moonNextVisible}
              onClick={handleDistanceInLight}
            >
              Distance in light
            </button>
          </div>
          {lightPhase && (
            <div className="light-story" aria-live="polite">
              <div
                className={`light-story-intro${
                  lightIntroHidden ? " is-hidden" : ""
                }`}
              >
                <h2
                  className={`light-story-title u-h1${
                    lightTitleOn ? " is-on" : ""
                  }`}
                >
                  Light
                </h2>
                <p
                  className={`light-story-line u-p1${
                    lightL1On ? " is-on" : ""
                  }`}
                >
                  The Moon is far, but light is impatient.
                </p>
                <p
                  className={`light-story-line u-p1${
                    lightL2On ? " is-on" : ""
                  }`}
                >
                  Even across all that empty distance, it does not take long.
                </p>
                <p
                  className={`light-story-line u-p1${
                    lightL3On ? " is-on" : ""
                  }`}
                >
                  It leaves the surface of the Moon and reaches your eyes in
                  only 1.3 seconds.
                </p>
                <button
                  type="button"
                  className={`ctrl-btn rect light-story-show-btn${
                    lightShowBtnOn ? " is-on" : ""
                  }`}
                  disabled={!lightShowBtnOn || lightIntroHidden}
                  onClick={handleLightShowMe}
                >
                  Show me
                </button>
              </div>
              <p
                className={`light-story-line arrive u-p1${
                  lightArriveOn ? " is-on" : ""
                }`}
              >
                In the time it takes to breathe in, the light has already
                arrived.
              </p>
            </div>
          )}
          {lightPhase && (
            <div
              className={`light-timer u-h1${lightTimerOn ? " is-on" : ""}`}
              aria-hidden={!lightTimerOn}
            >
              {lightTimerSec.toFixed(3)}s
            </div>
          )}
          {lightPhase && (
            <div
              className={`light-solar-cta${lightSolarBtnOn ? " is-on" : ""}`}
              aria-hidden={!lightSolarBtnOn}
            >
              <button
                type="button"
                className="ctrl-btn rect"
                disabled={!lightSolarBtnOn}
                onClick={handleSolarSystemInvite}
              >
                Let&apos;s go to our solar system
              </button>
            </div>
          )}
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
