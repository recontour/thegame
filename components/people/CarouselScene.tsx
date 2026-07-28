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
  dragBiasRef: React.MutableRefObject<number>;
  /**
   * Shared with HTML copy overlay — 0 full-bleed → 1 framed.
   * Owned by parent so DOM can rAF-sample without React lag.
   */
  presentRef: React.MutableRefObject<number>;
  /** Shared parallax energy bus (+ = advancing) */
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
 * Camera + cards + parallax motion bus.
 * presentRef / motionRef are shared with the HTML text overlay.
 */
export default function CarouselScene({
  cards,
  targetIndex,
  phaseRef,
  dragBiasRef,
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

    if (phaseNow !== prevPhaseRef.current) {
      prevPhaseRef.current = phaseNow;
      dragBiasRef.current = 0;
    }

    const posErr = Math.abs(wrapDelta(positionRef.current, targetIndexNow, n));
    const traveling = posErr > 0.03;
    const dragging = Math.abs(drag) > 0.001;

    /**
     * Reverse fix (full N → settled N-1 was choppy):
     * Don't settle while still traveling between cards.
     * Stay full-bleed until we're home, then morph to framed.
     * Forward (settled → next full) still targets present 0 immediately.
     */
    let presentTarget = 0;
    if (phaseNow === "settled") {
      presentTarget = traveling && posErr > 0.2 ? 0 : 1;
    }

    // —— carousel position ——
    // Allow light scrub while traveling so reverse doesn't feel locked
    let tgt = targetIndexNow + (dragging ? drag * (traveling ? 0.35 : 1) : 0);
    const cur = positionRef.current;
    const diff = wrapDelta(cur, tgt, n);
    tgt = cur + diff;

    // Slow, cinematic travel — higher smoothTime = gentler arrive
    let smoothTime = 0.7;
    if (traveling) smoothTime = 0.95;
    if (dragging && !traveling) smoothTime = 0.22;
    if (dragging && traveling) smoothTime = 0.65;

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

    // Soft park near home — same both directions, no hard snap
    if (!dragging && posErr < 0.1) {
      positionVelRef.current *= 0.92;
    }

    if (positionRef.current >= n) positionRef.current -= n;
    if (positionRef.current < 0) positionRef.current += n;

    // —— presentation (full ↔ framed) ——
    // Lower lambda = slower exp ease. Text shares this clock.
    // ~1.2–1.6s to settle / expand feels unhurried on mobile.
    const presentLambda =
      traveling ? 2.8 : presentTarget === 1 ? 2.4 : 2.6;
    presentRef.current = springStep(
      presentRef.current,
      presentTarget,
      capped,
      presentLambda,
    );
    presentVelRef.current = 0;

    // —— parallax motion bus (also a bit softer) ——
    let posDelta = positionRef.current - prevPosRef.current;
    if (posDelta > n / 2) posDelta -= n;
    if (posDelta < -n / 2) posDelta += n;
    prevPosRef.current = positionRef.current;

    const scrollVel = posDelta / Math.max(capped, 1 / 120);
    const finger = drag;
    const rawMotion =
      finger * 1.15 + THREE.MathUtils.clamp(scrollVel * 0.22, -1.4, 1.4);
    motionRef.current = springStep(motionRef.current, rawMotion, capped, 5.5);
    if (!dragging && !traveling) {
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
          dragBiasRef={dragBiasRef}
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
