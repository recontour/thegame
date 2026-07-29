"use client";

import { Suspense, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EARTH_PROMPT_OFFSET_Y } from "@/components/universe/constants";
import Earth from "@/components/universe/Earth";
import Satellite from "@/components/universe/Satellite";

type PlanetStageProps = {
  /** When true, ease the whole planet stack down above the prompt */
  lowered: boolean;
  satelliteActive: boolean;
  onSettled?: () => void;
};

/**
 * Earth + satellite as one column stack.
 * On the drag prompt beat, the group eases down so Earth sits above the copy.
 */
export default function PlanetStage({
  lowered,
  satelliteActive,
  onSettled,
}: PlanetStageProps) {
  const groupRef = useRef<THREE.Group>(null);
  const yRef = useRef(0);

  useFrame((_, dt) => {
    const target = lowered ? EARTH_PROMPT_OFFSET_Y : 0;
    yRef.current = THREE.MathUtils.damp(yRef.current, target, 2.2, dt);
    if (groupRef.current) {
      groupRef.current.position.y = yRef.current;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Separate Suspense so satellite PNG load never blanks Earth */}
      <Suspense fallback={null}>
        <Earth />
      </Suspense>
      <Suspense fallback={null}>
        <Satellite active={satelliteActive} onSettled={onSettled} />
      </Suspense>
    </group>
  );
}
