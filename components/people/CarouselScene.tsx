"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import FloatingCard from "@/components/people/FloatingCard";
import FocusTextBand from "@/components/people/FocusTextBand";
import Starfield from "@/components/people/Starfield";
import Atmosphere from "@/components/people/Atmosphere";
import { smoothDamp, springStep } from "@/components/people/math";
import type { SlotTexture } from "@/components/people/useCarouselTextures";
import type { StoryCapability } from "@/components/people/capability";
import type { StoryCard } from "@/data/people";

/** full = immersive cover; settled = framed card + copy */
export type StoryPhase = "full" | "settled";

type CarouselSceneProps = {
  cards: StoryCard[];
  targetIndex: number;
  phaseRef: React.MutableRefObject<StoryPhase>;
  /**
   * Shared with HTML copy overlay — 0 full-bleed → 1 framed.
   * Owned by parent so DOM can rAF-sample without React lag.
   */
  presentRef: React.MutableRefObject<number>;
  /**
   * Parallax energy from *committed* travel only (index changes).
   * Never live finger scrub — swipe is a pure next/prev trigger.
   */
  motionRef: React.MutableRefObject<number>;
  textures: SlotTexture[];
  cap: StoryCapability;
  onTextBandTop?: (topFrac: number) => void;
};

function wrapDelta(from: number, to: number, n: number): number {
  let d = to - from;
  d = ((d % n) + n) % n;
  if (d > n / 2) d -= n;
  return d;
}

/**
 * Camera + cards.
 * Swipe never feeds live drag into the scene — only discrete index/phase targets.
 */
export default function CarouselScene({
  cards,
  targetIndex,
  phaseRef,
  presentRef,
  motionRef,
  textures,
  cap,
  onTextBandTop,
}: CarouselSceneProps) {
  const n = cards.length;
  const positionRef = useRef(targetIndex);
  const positionVelRef = useRef(0);
  const presentVelRef = useRef(0);
  const targetRef = useRef(targetIndex);
  const prevIndexRef = useRef(targetIndex);
  const prevPhaseRef = useRef<StoryPhase>(phaseRef.current);
  const prevPosRef = useRef(targetIndex);

  useEffect(() => {
    targetRef.current = targetIndex;
  }, [targetIndex]);

  useEffect(() => {
    if (targetIndex !== prevIndexRef.current) {
      prevIndexRef.current = targetIndex;
      prevPhaseRef.current = phaseRef.current;
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

    if (phaseNow !== prevPhaseRef.current) {
      prevPhaseRef.current = phaseNow;
    }

    const posErr = Math.abs(wrapDelta(positionRef.current, targetIndexNow, n));
    const traveling = posErr > 0.03;

    /**
     * Reverse: stay full while traveling between cards, then settle home.
     * Forward settle on same card: present → 1 immediately.
     */
    let presentTarget = 0;
    if (phaseNow === "settled") {
      presentTarget = traveling && posErr > 0.2 ? 0 : 1;
    }

    // —— carousel position: integer targets only (no finger bias) ——
    const cur = positionRef.current;
    const diff = wrapDelta(cur, targetIndexNow, n);
    const tgt = cur + diff;

    const smoothTime = traveling ? 0.95 : 0.7;
    const stepped = smoothDamp(
      cur,
      tgt,
      positionVelRef.current,
      smoothTime,
      capped,
      traveling ? 1.6 : 3.5,
    );
    positionRef.current = stepped.value;
    positionVelRef.current = stepped.velocity;

    if (posErr < 0.1) {
      positionVelRef.current *= 0.92;
    }

    if (positionRef.current >= n) positionRef.current -= n;
    if (positionRef.current < 0) positionRef.current += n;

    // —— presentation (full ↔ framed) — shared clock with text ——
    const presentLambda =
      traveling ? 2.8 : presentTarget === 1 ? 2.4 : 2.6;
    presentRef.current = springStep(
      presentRef.current,
      presentTarget,
      capped,
      presentLambda,
    );
    presentVelRef.current = 0;

    // —— parallax from committed travel only (not finger) ——
    let posDelta = positionRef.current - prevPosRef.current;
    if (posDelta > n / 2) posDelta -= n;
    if (posDelta < -n / 2) posDelta += n;
    prevPosRef.current = positionRef.current;

    const scrollVel = posDelta / Math.max(capped, 1 / 120);
    const rawMotion = THREE.MathUtils.clamp(scrollVel * 0.22, -1.4, 1.4);
    motionRef.current = springStep(motionRef.current, rawMotion, capped, 5.5);
    if (!traveling) {
      motionRef.current = springStep(motionRef.current, 0, capped, 2.8);
    }
  });

  return (
    <>
      <Atmosphere haze={cap.haze} />
      <Starfield count={cap.starCount} motionRef={motionRef} />

      {cards.map((card, i) => (
        <FloatingCard
          key={card.id}
          index={i}
          count={n}
          positionRef={positionRef}
          presentRef={presentRef}
          motionRef={motionRef}
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
