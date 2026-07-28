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
  /** Story phase — ref so morphs do not re-render R3F */
  phaseRef: React.MutableRefObject<StoryPhase>;
  /** Live drag bias in card units — ref only */
  dragBiasRef: React.MutableRefObject<number>;
  textures: SlotTexture[];
  cap: StoryCapability;
  onFocusSettled?: (index: number, settled: boolean) => void;
  onTextBandTop?: (topFrac: number) => void;
};

/** Shortest signed distance on a ring of length n. */
function wrapDelta(from: number, to: number, n: number): number {
  let d = to - from;
  d = ((d % n) + n) % n;
  if (d > n / 2) d -= n;
  return d;
}

/**
 * Camera + cards.
 *
 * - Same-card full ↔ framed: lock index, spring `present` (already feels right).
 * - Between photos: spring carousel position slowly so the next image
 *   eases in instead of popping.
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

  // Index change: keep current present/position — springs handle the handoff.
  // (No hard snap — that was the instant cut between photos.)
  useEffect(() => {
    if (targetIndex !== prevIndexRef.current) {
      prevIndexRef.current = targetIndex;
      prevPhaseRef.current = phaseRef.current;
      lastSettled.current = false;
      // Drop residual finger bias so the travel is clean
      dragBiasRef.current = 0;
    }
  }, [targetIndex, phaseRef, dragBiasRef]);

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

    // Same-card phase flip (full ↔ settled)
    if (phaseNow !== prevPhaseRef.current) {
      prevPhaseRef.current = phaseNow;
      lastSettled.current = false;
      // Only hard-park when we are already on this card (not mid-travel)
      const posErr = Math.abs(wrapDelta(positionRef.current, targetIndexNow, n));
      if (posErr < 0.08) {
        positionRef.current = targetIndexNow;
        dragBiasRef.current = 0;
      }
    }

    const presentTarget = phaseNow === "settled" ? 1 : 0;
    const posErr = Math.abs(wrapDelta(positionRef.current, targetIndexNow, n));
    const presentErr = Math.abs(presentRef.current - presentTarget);
    /** Traveling to another photo */
    const traveling = posErr > 0.04;
    /** Same card morphing full ↔ frame */
    const morphingPose = !traveling && presentErr > 0.008;

    // —— carousel position ——
    if (morphingPose) {
      // Keep the hero planted while it scales full ↔ framed
      positionRef.current = targetIndexNow;
    } else {
      // Shortest-path target on the ring (+ optional drag preview)
      let tgt = targetIndexNow + (traveling ? 0 : drag);
      const cur = positionRef.current;
      let diff = wrapDelta(cur, tgt, n);
      // Unwrap so spring can cross the ring without long-way travel
      tgt = cur + diff;

      // Between photos: slower, cinematic. Finger drag: snappier track.
      const lambda = traveling ? 3.1 : drag !== 0 ? 11 : 5.5;
      positionRef.current = springStep(cur, tgt, capped, lambda);

      // Wrap into [0, n)
      if (positionRef.current >= n) positionRef.current -= n;
      if (positionRef.current < 0) positionRef.current += n;
    }

    // —— presentation spring (full ↔ framed) ——
    // Slightly quicker when arriving as the next full image so the
    // expand/contract and the slide finish in the same breath.
    const presentLambda = traveling ? 4.2 : 3.2;
    presentRef.current = springStep(
      presentRef.current,
      presentTarget,
      capped,
      presentLambda,
    );

    const p = positionRef.current;
    const nearest = ((Math.round(p) % n) + n) % n;
    const frac = Math.abs(p - Math.round(p));
    const present = presentRef.current;
    const presentNear =
      phaseNow === "settled" ? present > 0.92 : present < 0.08;
    const settled =
      !traveling &&
      frac < 0.025 &&
      Math.abs(dragBiasRef.current) < 0.001 &&
      presentNear;

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
