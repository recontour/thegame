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
 * `position` springs toward targetIndex (carousel ring).
 * `present` springs 0 → 1 for full-bleed → framed morph on the focused card.
 * Slow on purpose — this is a story, not a picker.
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

  // New image: snap presentation to match the beat we arrived on.
  // Runs when React index changes (settled→next full, or reverse).
  useEffect(() => {
    if (targetIndex !== prevIndexRef.current) {
      if (phaseRef.current === "full") {
        presentRef.current = 0;
      } else {
        presentRef.current = 1;
      }
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

    // Detect same-index phase flips (full↔settled) without React
    if (phaseNow !== prevPhaseRef.current) {
      prevPhaseRef.current = phaseNow;
      lastSettled.current = false;
    }

    // —— carousel index spring ——
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

    // —— full ↔ settled presentation spring ——
    const presentTarget = phaseNow === "settled" ? 1 : 0;
    presentRef.current = springStep(
      presentRef.current,
      presentTarget,
      capped,
      3.4,
    );

    const p = positionRef.current;
    const nearest = ((Math.round(p) % n) + n) % n;
    const frac = Math.abs(p - Math.round(p));
    const present = presentRef.current;
    const presentNear =
      phaseNow === "settled" ? present > 0.92 : present < 0.08;
    const settled =
      frac < 0.025 && Math.abs(drag) < 0.001 && presentNear;

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
