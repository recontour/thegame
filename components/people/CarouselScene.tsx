"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import FloatingCard from "@/components/people/FloatingCard";
import FocusTextBand from "@/components/people/FocusTextBand";
import Starfield from "@/components/people/Starfield";
import Atmosphere from "@/components/people/Atmosphere";
import { springStep } from "@/components/people/math";
import type { SlotTexture } from "@/components/people/useCarouselTextures";
import type { StoryCapability } from "@/components/people/capability";
import type { StoryCard } from "@/data/people";

/** full = immersive cover; settled = framed card + copy */
export type StoryPhase = "full" | "settled";

type CarouselSceneProps = {
  cards: StoryCard[];
  /** Integer target index (0..n-1) */
  targetIndex: number;
  /**
   * Story phase — ref so full→settled morph does not re-render R3F
   * (re-renders were resetting material opacity → black flash on mobile).
   */
  phaseRef: React.MutableRefObject<StoryPhase>;
  /** Live drag bias in card units — ref only */
  dragBiasRef: React.MutableRefObject<number>;
  textures: SlotTexture[];
  cap: StoryCapability;
  /** Fires when spring is near integer and presentation is near target */
  onFocusSettled?: (index: number, settled: boolean) => void;
  /** 0..1 stage-top fraction where free space under the focused card begins */
  onTextBandTop?: (topFrac: number) => void;
};

/**
 * Camera + cards.
 *
 * One continuous hero plane morphs full ↔ framed via `present`.
 * During that morph the carousel position is locked to the integer index
 * so the photo never "loses focus" and goes transparent.
 */
export default function CarouselScene({
  cards,
  targetIndex,
  phaseRef,
  dragBiasRef,
  textures,
  cap,
  onFocusSettled,
  onTextBandTop,
}: CarouselSceneProps) {
  const n = cards.length;
  const positionRef = useRef(targetIndex);
  /** 0 = full-bleed immersive, 1 = settled framed pose */
  const presentRef = useRef(phaseRef.current === "settled" ? 1 : 0);
  const lastSettled = useRef(false);
  const targetRef = useRef(targetIndex);
  const settledCb = useRef(onFocusSettled);
  const prevIndexRef = useRef(targetIndex);
  const prevPhaseRef = useRef<StoryPhase>(phaseRef.current);

  useEffect(() => {
    targetRef.current = targetIndex;
  }, [targetIndex]);
  useEffect(() => {
    settledCb.current = onFocusSettled;
  }, [onFocusSettled]);

  // New image: snap presentation + park the carousel on the new index.
  useEffect(() => {
    if (targetIndex !== prevIndexRef.current) {
      if (phaseRef.current === "full") {
        presentRef.current = 0;
      } else {
        presentRef.current = 1;
      }
      // Hard park — no mid-index drift into the morph
      positionRef.current = targetIndex;
      prevIndexRef.current = targetIndex;
      prevPhaseRef.current = phaseRef.current;
      lastSettled.current = false;
    }
  }, [targetIndex, phaseRef]);

  const sharedGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  useEffect(() => {
    return () => {
      sharedGeo.dispose();
    };
  }, [sharedGeo]);

  const seeds = useMemo(
    () => cards.map((_, i) => (i * 0.6180339887) % 1),
    [cards],
  );

  useFrame((_, dt) => {
    const capped = Math.min(dt, 0.05);
    const targetIndexNow = targetRef.current;
    const phaseNow = phaseRef.current;
    const drag = dragBiasRef.current;

    // Same-index phase flip (full ↔ settled): lock the hero in place first
    if (phaseNow !== prevPhaseRef.current) {
      prevPhaseRef.current = phaseNow;
      lastSettled.current = false;
      // Kill residual drag offset so the same photo keeps continuous focus
      positionRef.current = targetIndexNow;
      dragBiasRef.current = 0;
    }

    const presentTarget = phaseNow === "settled" ? 1 : 0;
    const morphing =
      Math.abs(presentRef.current - presentTarget) > 0.004;

    // —— carousel index spring ——
    // While the hero is morphing full↔frame, do NOT let drag/position
    // pull it off the integer — that was dimming opacity via "neighbor" logic.
    if (morphing) {
      positionRef.current = targetIndexNow;
    } else {
      let tgt = targetIndexNow + drag;
      const cur = positionRef.current;
      let diff = tgt - cur;
      while (diff > n / 2) {
        tgt -= n;
        diff = tgt - cur;
      }
      while (diff < -n / 2) {
        tgt += n;
        diff = tgt - cur;
      }

      positionRef.current = springStep(cur, tgt, capped, drag !== 0 ? 12 : 5.2);

      if (positionRef.current >= n) positionRef.current -= n;
      if (positionRef.current < 0) positionRef.current += n;
    }

    // —— full ↔ settled presentation spring (the actual photo morph) ——
    presentRef.current = springStep(
      presentRef.current,
      presentTarget,
      capped,
      3.2,
    );

    const p = positionRef.current;
    const nearest = ((Math.round(p) % n) + n) % n;
    const frac = Math.abs(p - Math.round(p));
    const present = presentRef.current;
    const presentNear =
      phaseNow === "settled" ? present > 0.92 : present < 0.08;
    const settled =
      frac < 0.025 && Math.abs(dragBiasRef.current) < 0.001 && presentNear;

    if (settled !== lastSettled.current) {
      lastSettled.current = settled;
      settledCb.current?.(
        nearest,
        settled && phaseNow === "settled" && present > 0.92,
      );
    }
  });

  return (
    <>
      <Atmosphere haze={cap.haze} />
      <Starfield count={cap.starCount} />

      {cards.map((card, i) => (
        <FloatingCard
          key={card.id}
          index={i}
          count={n}
          positionRef={positionRef}
          presentRef={presentRef}
          targetIndexRef={targetRef}
          texture={textures[i]?.texture ?? null}
          geometry={sharedGeo}
          seed={seeds[i]}
          floatAmp={cap.floatAmp}
          focusX={card.focusX ?? 0.5}
          focusY={card.focusY ?? 0.5}
          immerseRotate={card.immerseRotate ?? 0}
          immerseZoom={card.immerseZoom ?? 1}
          immerseFit={card.immerseFit ?? "cover"}
        />
      ))}

      {onTextBandTop ? (
        <FocusTextBand
          positionRef={positionRef}
          presentRef={presentRef}
          textures={textures}
          cardCount={n}
          onBandTop={onTextBandTop}
        />
      ) : null}
    </>
  );
}
