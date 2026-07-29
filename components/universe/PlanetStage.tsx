"use client";

import { Suspense, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  EARTH_MOON_OFFSET_Y,
  EARTH_PROMPT_OFFSET_Y,
} from "@/components/universe/constants";
import Earth from "@/components/universe/Earth";
import Moon from "@/components/universe/Moon";
import Satellite from "@/components/universe/Satellite";

export type StagePose = "center" | "prompt" | "moon";

/** Shared with CameraRig so POV stays face-on to Earth */
export function stagePoseOffset(pose: StagePose): number {
  if (pose === "prompt") return EARTH_PROMPT_OFFSET_Y;
  if (pose === "moon") return EARTH_MOON_OFFSET_Y;
  return 0;
}

type PlanetStageProps = {
  /** Vertical stack pose — prompt sits lower; moon pose pins Earth pre-zoom style */
  pose: StagePose;
  satelliteActive: boolean;
  onSatelliteSettled?: () => void;
  moonVisible: boolean;
  moonInteractive: boolean;
  onMoonSnapStart?: () => void;
  onMoonSettled?: () => void;
};

/**
 * Earth + satellite + moon as one column stack.
 */
export default function PlanetStage({
  pose,
  satelliteActive,
  onSatelliteSettled,
  moonVisible,
  moonInteractive,
  onMoonSnapStart,
  onMoonSettled,
}: PlanetStageProps) {
  const groupRef = useRef<THREE.Group>(null);
  const yRef = useRef(0);

  useFrame((_, dt) => {
    const target = stagePoseOffset(pose);
    yRef.current = THREE.MathUtils.damp(yRef.current, target, 2.2, dt);
    if (groupRef.current) {
      groupRef.current.position.y = yRef.current;
    }
  });

  return (
    <group ref={groupRef}>
      <Suspense fallback={null}>
        <Earth />
      </Suspense>
      <Suspense fallback={null}>
        <Satellite active={satelliteActive} onSettled={onSatelliteSettled} />
      </Suspense>
      <Suspense fallback={null}>
        <Moon
          visible={moonVisible}
          interactive={moonInteractive}
          onSnapStart={onMoonSnapStart}
          onSettled={onMoonSettled}
        />
      </Suspense>
    </group>
  );
}
