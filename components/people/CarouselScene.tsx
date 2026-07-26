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

type CarouselSceneProps = {
  cards: StoryCard[];
  /** Integer target index (0..n-1) */
  targetIndex: number;
  /** Live drag bias in “card units” (−0.35..0.35) while finger is down */
  dragBias: number;
  textures: SlotTexture[];
  cap: StoryCapability;
  /** Fires when spring is near integer (for text fade) */
  onFocusSettled?: (index: number, settled: boolean) => void;
  /** 0..1 stage-top fraction where free space under the focused card begins */
  onTextBandTop?: (topFrac: number) => void;
};

/**
 * Camera + cards. Continuous `position` springs toward targetIndex + dragBias.
 * 12 meshes share one PlaneGeometry (geometry reuse = less GC on mobile).
 */
export default function CarouselScene({
  cards,
  targetIndex,
  dragBias,
  textures,
  cap,
  onFocusSettled,
  onTextBandTop,
}: CarouselSceneProps) {
  const n = cards.length;
  const positionRef = useRef(targetIndex);
  // Start unsettled so first settle fires text reveal
  const lastSettled = useRef(false);
  const dragBiasRef = useRef(dragBias);
  const targetRef = useRef(targetIndex);
  const settledCb = useRef(onFocusSettled);

  useEffect(() => {
    dragBiasRef.current = dragBias;
  }, [dragBias]);
  useEffect(() => {
    targetRef.current = targetIndex;
  }, [targetIndex]);
  useEffect(() => {
    settledCb.current = onFocusSettled;
  }, [onFocusSettled]);

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
    const drag = dragBiasRef.current;
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

    positionRef.current = springStep(cur, tgt, capped, drag !== 0 ? 16 : 9);

    if (positionRef.current >= n) positionRef.current -= n;
    if (positionRef.current < 0) positionRef.current += n;

    const p = positionRef.current;
    const nearest = ((Math.round(p) % n) + n) % n;
    const frac = Math.abs(p - Math.round(p));
    const settled = frac < 0.02 && Math.abs(drag) < 0.001;
    if (settled !== lastSettled.current) {
      lastSettled.current = settled;
      settledCb.current?.(nearest, settled);
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
          texture={textures[i]?.texture ?? null}
          geometry={sharedGeo}
          seed={seeds[i]}
          floatAmp={cap.floatAmp}
        />
      ))}

      {onTextBandTop ? (
        <FocusTextBand
          positionRef={positionRef}
          textures={textures}
          cardCount={n}
          onBandTop={onTextBandTop}
        />
      ) : null}
    </>
  );
}
