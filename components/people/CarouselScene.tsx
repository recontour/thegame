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
  textures: SlotTexture[];
  cap: StoryCapability;
  onFocusSettled?: (index: number, settled: boolean) => void;
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
 *
 * `motionRef` is a smoothed scroll energy (finger + travel) that cards and
 * stars sample at different depths — classic mobile multiplane feel.
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
  const positionVelRef = useRef(0);
  const presentRef = useRef(phaseRef.current === "settled" ? 1 : 0);
  const presentVelRef = useRef(0);
  /**
   * Smoothed parallax driver:
   *   + = story advancing (swipe up / next)
   *   − = going back
   * Cards sample this with depth weights; stars sample slower.
   */
  const motionRef = useRef(0);
  const lastSettled = useRef(false);
  const targetRef = useRef(targetIndex);
  const settledCb = useRef(onFocusSettled);
  const prevIndexRef = useRef(targetIndex);
  const prevPhaseRef = useRef<StoryPhase>(phaseRef.current);
  const prevPosRef = useRef(targetIndex);

  useEffect(() => {
    targetRef.current = targetIndex;
  }, [targetIndex]);
  useEffect(() => {
    settledCb.current = onFocusSettled;
  }, [onFocusSettled]);

  useEffect(() => {
    if (targetIndex !== prevIndexRef.current) {
      prevIndexRef.current = targetIndex;
      prevPhaseRef.current = phaseRef.current;
      lastSettled.current = false;
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
      lastSettled.current = false;
      const posErr = Math.abs(wrapDelta(positionRef.current, targetIndexNow, n));
      if (posErr < 0.08) {
        positionRef.current = targetIndexNow;
        positionVelRef.current = 0;
        dragBiasRef.current = 0;
      }
    }

    const presentTarget = phaseNow === "settled" ? 1 : 0;
    const posErr = Math.abs(wrapDelta(positionRef.current, targetIndexNow, n));
    const presentErr = Math.abs(presentRef.current - presentTarget);
    const traveling = posErr > 0.04;
    const morphingPose = !traveling && presentErr > 0.008;

    // —— carousel position (smoothDamp = less choppy than exp spring) ——
    if (morphingPose) {
      positionRef.current = targetIndexNow;
      positionVelRef.current = 0;
    } else {
      let tgt = targetIndexNow + (traveling ? 0 : drag);
      const cur = positionRef.current;
      const diff = wrapDelta(cur, tgt, n);
      tgt = cur + diff;

      // Travel: floaty. Scrubbing with finger: tighter follow.
      const smoothTime = traveling ? 0.55 : drag !== 0 ? 0.14 : 0.32;
      const stepped = smoothDamp(
        cur,
        tgt,
        positionVelRef.current,
        smoothTime,
        capped,
        traveling ? 2.8 : 6,
      );
      positionRef.current = stepped.value;
      positionVelRef.current = stepped.velocity;

      if (positionRef.current >= n) positionRef.current -= n;
      if (positionRef.current < 0) positionRef.current += n;
    }

    // —— presentation (full ↔ framed) ——
    const presentSmooth = traveling ? 0.42 : morphingPose ? 0.48 : 0.38;
    const presentStep = smoothDamp(
      presentRef.current,
      presentTarget,
      presentVelRef.current,
      presentSmooth,
      capped,
      3.5,
    );
    presentRef.current = presentStep.value;
    presentVelRef.current = presentStep.velocity;

    // —— parallax motion bus ——
    // Combine finger scrub + actual scroll velocity into one soft signal.
    let posDelta = positionRef.current - prevPosRef.current;
    // unwrap jump across ring
    if (posDelta > n / 2) posDelta -= n;
    if (posDelta < -n / 2) posDelta += n;
    prevPosRef.current = positionRef.current;

    const scrollVel = posDelta / Math.max(capped, 1 / 120);
    // Finger up (next) → positive dragBias in StoryCarousel is -deltaY/… so
    // drag > 0 means next. Align motion so + = advancing.
    const finger = drag;
    const rawMotion = finger * 1.15 + THREE.MathUtils.clamp(scrollVel * 0.22, -1.4, 1.4);
    motionRef.current = springStep(motionRef.current, rawMotion, capped, 7.5);
    // Soft settle to 0 when idle so planes rest
    if (Math.abs(drag) < 0.001 && !traveling && !morphingPose) {
      motionRef.current = springStep(motionRef.current, 0, capped, 4.5);
    }

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
