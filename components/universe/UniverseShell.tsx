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
import NorthPoleQuiz from "@/components/universe/NorthPoleQuiz";

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
  "Plot twist! Most people launch it into deep space.\nGPS satellites actually sit in a neat middle orbit about 20,200 km above Earth.";
const LUNA_TITLE_TEXT = "This is Low Earth Orbit.";
const LUNA_SUB_TEXT =
  "GPS is just around the corner. Next, let's see where our natural satellite, Luna, is.";
const MOON_LIE_TITLE = "Textbooks have been lying to you. 📚";
const MOON_LIE_BODY =
  "Every standard diagram squeezes Earth and the Moon together\nso they fit neatly on a printed page.\nThat quiet compression ruins our sense of true cosmic scale.";
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
  "Whoa there, Captain Cosmos!\nThe Moon isn't in another galaxy.";
const MOON_PLACE_TEXT = "Drag the Moon where you think it belongs.";
const ZOOM_FIRST_TEXT = "You might want to zoom out for this one first.";
const ZOOM_FIRST_FINEPRINT =
  "Once you hit Confirm, you can drag the Moon into place.";
const MOON_NEXT_TEXT =
  "Now that you've felt the real distance\nbetween Earth and the Moon…\nLight travels 299,792 km every single second.\nYet even that mind-melting speed takes time out here.";
const SUN_ZOOM_FIRST_TEXT =
  "Now for the Sun.\nZoom out a bit, then Confirm.";
const SUN_ZOOM_FIRST_FINEPRINT =
  "Once you hit Confirm, you can drag the Sun into place.";
const SUN_FAR_ENOUGH_TEXT =
  "Okay, that's far enough.\nHome is just that tiny blue pin.";
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
  const [phoneHasExited, setPhoneHasExited] = useState(false);
  const [earthRevealed, setEarthRevealed] = useState(false);
  /** Hide 3D phone while answer-reveal card is up */
  const [openingReveal, setOpeningReveal] = useState(false);
  /** NDC y for centering the phone under the quiz options */
  const [phoneSlotNdcY, setPhoneSlotNdcY] = useState(-0.28);

  const [satelliteActive, setSatelliteActive] = useState(false);
  const [promptVisible, setPromptVisible] = useState(false);
  const [homePromptVisible, setHomePromptVisible] = useState(false);
  const [satHeroVisible, setSatHeroVisible] = useState(false);
  const [topH1Visible, setTopH1Visible] = useState(false);
  const [topP1Visible, setTopP1Visible] = useState(false);

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

  /** Solar light photon release (Sun → Earth / Home) */
  const [sunLightBeamActive, setSunLightBeamActive] = useState(false);
  const [sunLightTimerOn, setSunLightTimerOn] = useState(false);
  const [sunLightTimerDisplay, setSunLightTimerDisplay] = useState("0m 00.0s");
  const [sunLightArriveOn, setSunLightArriveOn] = useState(false);

  const [northPoleActive, setNorthPoleActive] = useState(false);
  const [cameraZ, setCameraZ] = useState(CAMERA_Z);

  const handleAudioUnlocked = useCallback(() => {
    setAudioReady(true);
  }, []);

  /** After “Let's see what distance really is →” */
  const handleOpeningContinue = useCallback(() => {
    setOpeningReveal(false);
    setPhoneExiting(true);
    setEarthRevealed(true);
    setNorthPoleActive(true);
    setCameraZ(CAMERA_Z * 0.3); // Zoomed-in close-up view of Earth
  }, []);

  const handlePhoneExitDone = useCallback(() => {
    setPhoneHasExited(true);
  }, []);

  const handleNorthPoleNext = useCallback(() => {
    setNorthPoleActive(false);
    setCameraZ(CAMERA_Z);
    setOpeningActive(false);
    setSatelliteActive(true);

    setHomePromptVisible(false);
    setSatHeroVisible(false);
    setTopH1Visible(false);
    setTopP1Visible(false);

    // 1. "Here's our home." bottom prompt slowly fades in over Earth (400ms)
    window.setTimeout(() => setHomePromptVisible(true), 400);

    // 2. Satellite PNG populates on top and slowly drops into place from above (-40px -> 0) over 1.6s
    window.setTimeout(() => setSatHeroVisible(true), 1200);

    // 3. Once satellite has dropped into place, H1 reveals underneath (2800ms)
    window.setTimeout(() => setTopH1Visible(true), 2800);

    // 4. Once H1 is revealed, P1 subtext reveals below H1 (4200ms)
    window.setTimeout(() => setTopP1Visible(true), 4200);
  }, []);

  useEffect(() => {
    if (phoneHasExited && phoneExiting && !northPoleActive) {
      setOpeningActive(false);
      setSatelliteActive(true);

      setHomePromptVisible(false);
      setSatHeroVisible(false);
      setTopH1Visible(false);
      setTopP1Visible(false);

      window.setTimeout(() => setHomePromptVisible(true), 400);
      window.setTimeout(() => setSatHeroVisible(true), 1200);
      window.setTimeout(() => setTopH1Visible(true), 2800);
      window.setTimeout(() => setTopP1Visible(true), 4200);
    }
  }, [phoneHasExited, phoneExiting, northPoleActive]);

  const handleSatelliteSettled = useCallback(() => {
    setHomePromptVisible(false);
    setSatHeroVisible(false);
    setTopH1Visible(false);
    setTopP1Visible(false);
    setPromptVisible(false);

    // Beat 1: Plot twist text (400ms)
    window.setTimeout(() => {
      setSatBridgeVisible(true);
      setGpsFactVisible(true);
    }, 400);

    // Beat 2: Luna context subtext (2800ms)
    window.setTimeout(() => {
      setFartherVisible(true);
    }, 2800);

    // Beat 3: Bottom CTA button glides into place after text has settled (5200ms)
    window.setTimeout(() => {
      setPlaceMoonBtnVisible(true);
    }, 5200);
  }, []);

  /** “The Moon ?” — show “Most pictures lie” on the Earth stage */
  const handleTheMoon = useCallback(() => {
    setGpsFactVisible(false);
    setFartherVisible(false);
    setPlaceMoonBtnVisible(false);
    setMoonLieVisible(true);
  }, []);

  /** Click on NASA Moon photo → go to try-yourself + Place moon stage */
  const handleMoonPhotoClick = useCallback(() => {
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
  }, []);

  /** Click on NASA Sun photo → Now for the Sun (zoom beat) */
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

  /** Click "Release the Solar Photon! ☀️" — launch 3D photon from Sun to Earth with 7s timer */
  const handleReleaseSolarPhoton = useCallback(() => {
    setSunLabelVisible(false);
    setSunLightBeamActive(true);
    setSunLightTimerOn(true);
    setSunLightTimerDisplay("0m 00.0s");
    setSunLightArriveOn(false);

    const startTime = performance.now();
    const DURATION_MS = 7000; // 7 seconds wall-clock time
    const TOTAL_SUN_LIGHT_SECONDS = 500; // 8 minutes 20 seconds = 500 seconds

    const interval = window.setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / DURATION_MS, 1);
      const simulatedSecs = progress * TOTAL_SUN_LIGHT_SECONDS;

      const mins = Math.floor(simulatedSecs / 60);
      const secs = Math.floor(simulatedSecs % 60);
      const tenths = Math.floor((simulatedSecs % 1) * 10);

      setSunLightTimerDisplay(
        `${mins}m ${secs.toString().padStart(2, "0")}.${tenths}s`
      );

      if (progress >= 1) {
        window.clearInterval(interval);
      }
    }, 30);
  }, []);

  const handleSunLightBeamComplete = useCallback(() => {
    setSunLightBeamActive(false);
    setSunLightTimerDisplay("8m 20.0s");
    window.setTimeout(() => {
      setSunLightArriveOn(true);
    }, 300);
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
              {audioReady && openingActive && (
                <Suspense fallback={null}>
                  <OpeningPhone
                    exiting={phoneExiting || openingReveal}
                    slotNdcY={phoneSlotNdcY}
                    onExitDone={handlePhoneExitDone}
                  />
                </Suspense>
              )}
              <PlanetStage
                earthRevealed={earthRevealed}
                northPoleFocus={northPoleActive}
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
                sunLightBeamActive={sunLightBeamActive}
                onSunLightBeamComplete={handleSunLightBeamComplete}
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
          <NorthPoleQuiz active={northPoleActive} onNext={handleNorthPoleNext} />
          {(topH1Visible || topP1Visible) && (
            <div className="universe-ui">
              <div style={{ textAlign: "center", maxWidth: "34em" }}>
                <h1 className={`universe-message u-h1${topH1Visible ? " visible" : ""}`}>
                  GPS satellites keep your maps working.
                </h1>
                <p
                  className={`universe-message u-p1${topP1Visible ? " visible" : ""}`}
                  style={{ marginTop: "8px" }}
                >
                  Drag the satellite to where you think they actually orbit.
                </p>
              </div>
            </div>
          )}
          <PromptMessage
            visible={homePromptVisible}
            text={HOME_TEXT}
            placement="bottom"
            tone="h1"
          />
          {satBridgeVisible && (
            <div className={`sat-bridge${satBridgeVisible ? " visible" : ""}`}>
              {/*
                Each step mounts its FULL stack at once; lines/buttons only
                toggle .visible so layout doesn’t reflow (no jump).
              */}
              {/* Step 1: GPS + farther + The Moon ? */}
              {!moonLieVisible && !moonTryVisible && (
                <div
                  className="sat-bridge-stack"
                  style={{ maxWidth: "340px", textAlign: "center" }}
                >
                  <p
                    className={`sat-bridge-copy u-p1${
                      gpsFactVisible ? " visible" : ""
                    }`}
                    style={{
                      fontSize: "clamp(0.95rem, 3.4vw, 1.08rem)",
                      lineHeight: 1.5,
                      color: "rgba(230, 240, 255, 0.95)",
                    }}
                  >
                    {GPS_FACT_TEXT}
                  </p>
                  {fartherVisible && (
                    <div
                      style={{
                        marginTop: "16px",
                        opacity: fartherVisible ? 1 : 0,
                        transform: fartherVisible ? "translateY(0)" : "translateY(14px)",
                        transition:
                          "opacity 1.4s cubic-bezier(0.16, 1, 0.3, 1), transform 1.4s cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                    >
                      <h2
                        className="u-h1"
                        style={{
                          fontSize: "clamp(1.05rem, 3.8vw, 1.25rem)",
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          marginBottom: "6px",
                          color: "rgba(255, 255, 255, 0.98)",
                        }}
                      >
                        {LUNA_TITLE_TEXT}
                      </h2>
                      <p
                        className="u-p1"
                        style={{
                          fontSize: "clamp(0.9rem, 3.2vw, 1.0rem)",
                          lineHeight: 1.45,
                          color: "rgba(200, 220, 255, 0.85)",
                        }}
                      >
                        {LUNA_SUB_TEXT}
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    className={`ctrl-btn rect sat-bridge-cta${
                      placeMoonBtnVisible ? " visible" : ""
                    }`}
                    style={{
                      position: "fixed",
                      bottom: "calc(6dvh + env(safe-area-inset-bottom, 0px))",
                      left: "50%",
                      transform: placeMoonBtnVisible
                        ? "translateX(-50%) translateY(0)"
                        : "translateX(-50%) translateY(16px)",
                      width: "min(100%, 300px)",
                      zIndex: 30,
                      opacity: placeMoonBtnVisible ? 1 : 0,
                      pointerEvents: placeMoonBtnVisible ? "auto" : "none",
                      transition:
                        "opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1), transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                    disabled={!placeMoonBtnVisible}
                    onClick={handleTheMoon}
                  >
                    Target: The moon 🌑
                  </button>
                </div>
              )}
              {/* Step 2: "Most pictures lie" + embedded interactive NASA Moon image */}
              {moonLieVisible && (
                <div className="sat-bridge-stack" style={{ alignItems: "center" }}>
                  <h1 className="sat-bridge-copy u-h1 visible">
                    {MOON_LIE_TITLE}
                  </h1>
                  <p className="sat-bridge-copy u-p1 visible" style={{ marginTop: "8px" }}>
                    {MOON_LIE_BODY}
                  </p>
                  <div
                    style={{
                      marginTop: "16px",
                      pointerEvents: "auto",
                      cursor: "pointer",
                    }}
                    onClick={handleMoonPhotoClick}
                  >
                    <img
                      src={NASA_MOON_PHOTO}
                      alt="Earth and Moon — NASA"
                      style={{
                        width: "calc(100vw - 6vw)",
                        maxWidth: "360px",
                        maxHeight: "min(36vh, 260px)",
                        objectFit: "contain",
                        borderRadius: "12px",
                        boxShadow: "0 12px 36px rgba(0, 0, 0, 0.65)",
                        border: "1px solid rgba(160, 190, 255, 0.2)",
                        transition: "transform 0.15s ease",
                      }}
                      draggable={false}
                    />
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
          {/* Sun lie — embedded interactive NASA Sun photo */}
          {sunLieVisible && (
            <div className={`sat-bridge${sunLieVisible ? " visible" : ""}`}>
              <div className="sat-bridge-stack" style={{ alignItems: "center" }}>
                <h1 className="sat-bridge-copy u-h1 visible">{SUN_LIE_TITLE}</h1>
                <p className="sat-bridge-copy u-p1 visible" style={{ marginTop: "8px" }}>
                  {SUN_LIE_BODY}
                </p>
                <div
                  style={{
                    marginTop: "16px",
                    pointerEvents: "auto",
                    cursor: "pointer",
                  }}
                  onClick={handleExploreSolarSystem}
                >
                  <img
                    src={NASA_SUN_PHOTO}
                    alt="The Sun — NASA"
                    style={{
                      width: "calc(100vw - 6vw)",
                      maxWidth: "360px",
                      maxHeight: "min(36vh, 260px)",
                      objectFit: "contain",
                      borderRadius: "12px",
                      boxShadow: "0 12px 36px rgba(0, 0, 0, 0.65)",
                      border: "1px solid rgba(255, 210, 120, 0.25)",
                      transition: "transform 0.15s ease",
                    }}
                    draggable={false}
                  />
                </div>
              </div>
            </div>
          )}
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
                ? "Whoa there, Captain Cosmos! You just parked the Moon somewhere past Mars."
                : "Farther than it looks."}
            </span>
            <span className="moon-label-sub u-p1">
              The Moon is actually about 384,000 km away — roughly 30 Earth
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
            style={{
              position: "fixed",
              top: "40%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "calc(100vw - 32px)",
              maxWidth: "360px",
              zIndex: 50,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              textAlign: "center",
              boxSizing: "border-box",
              pointerEvents: sunLabelVisible ? "auto" : "none",
              opacity: sunLabelVisible ? 1 : 0,
              transition: "opacity 0.6s ease",
            }}
            aria-live="polite"
            aria-hidden={!sunLabelVisible}
          >
            {sunSmartAss && (
              <h1 className="u-h1" style={{ display: sunRevealL1 ? "block" : "none" }}>
                You just evicted the Sun past Pluto! 🥶 It&apos;s freezing out there.
              </h1>
            )}

            {sunRevealL1 && (
              <p className="u-p1">
                The Sun sits 150 million kilometres away (1 Astronomical Unit). At this point, kilometres become completely useless for human brains.
              </p>
            )}

            {sunRevealL2 && (
              <p className="u-p1">
                So astronomers cheat: they measure distance in TIME.
              </p>
            )}

            {sunRevealBranch && (
              <p className="u-p1">
                Instead of writing 40,000,000,000,000 km to reach the next star, we just say it&apos;s 4.2 light-years away. Time becomes our tape measure!
              </p>
            )}

            {sunRevealBtn && (
              <button
                type="button"
                className="ctrl-btn rect"
                style={{ width: "min(100%, 300px)", marginTop: "8px" }}
                onClick={handleReleaseSolarPhoton}
              >
                Release the Solar Photon! ☀️
              </button>
            )}
          </div>

          {/* Solar Light Photon Timer & Arrival Message */}
          {sunLightTimerOn && (
            <div
              className={`light-timer u-h1${sunLightTimerOn ? " is-on" : ""}`}
              style={{
                position: "fixed",
                top: "42%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                fontSize: "clamp(2rem, 8vw, 3.2rem)",
                color: "#fbbf24",
                textShadow: "0 0 28px rgba(251, 191, 36, 0.7)",
                zIndex: 60,
              }}
              aria-live="polite"
            >
              {sunLightTimerDisplay}
            </div>
          )}

          {sunLightArriveOn && (
            <div
              style={{
                position: "fixed",
                top: "58%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "min(92vw, 360px)",
                textAlign: "center",
                zIndex: 60,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                pointerEvents: "auto",
              }}
            >
              <h2
                className="u-h1"
                style={{
                  color: "#fbbf24",
                  textShadow: "0 0 20px rgba(251, 191, 36, 0.5)",
                  margin: 0,
                  fontSize: "clamp(1.3rem, 4.5vw, 1.6rem)",
                }}
              >
                8 Minutes and 20 Seconds! 🤯
              </h2>
              <p
                className="u-p1"
                style={{
                  color: "rgba(254, 240, 138, 0.95)",
                  margin: 0,
                  lineHeight: 1.45,
                }}
              >
                If the Sun suddenly exploded right this second, you wouldn&apos;t know for 8 full minutes. You could finish your tea in warm, golden sunshine! You are literally looking 8 minutes into the past.
              </p>
              <p
                className="u-p1"
                style={{
                  color: "#94a3b8",
                  marginTop: "6px",
                  fontSize: "0.85rem",
                  lineHeight: 1.4,
                }}
              >
                Ready to ride deeper through the planets?
              </p>
              <button
                type="button"
                className="ctrl-btn rect"
                style={{ width: "min(100%, 280px)", marginTop: "4px" }}
                onClick={() => {
                  // Ready for Vertical Solar Elevator step
                }}
              >
                The Solar Elevator 🪐
              </button>
            </div>
          )}
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
              How Fast is Light, Really? ⚡
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
                  Light travels at 299,792 km EVERY SECOND — the ultimate cosmic speed demon.
                </p>
                <p
                  className={`light-story-line u-p1${
                    lightL3On ? " is-on" : ""
                  }`}
                >
                  Yet across this vast gap, it still takes 1.3 seconds to reach your eyes.
                </p>
                <button
                  type="button"
                  className={`ctrl-btn rect light-story-show-btn${
                    lightShowBtnOn ? " is-on" : ""
                  }`}
                  disabled={!lightShowBtnOn || lightIntroHidden}
                  onClick={handleLightShowMe}
                >
                  Release the Photon! 💫
                </button>
              </div>
              <p
                className={`light-story-line arrive u-p1${
                  lightArriveOn ? " is-on" : ""
                }`}
              >
                In less time than a single deep breath, the photon completes its journey.
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
                Next Stop: The Sun ☀️
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
