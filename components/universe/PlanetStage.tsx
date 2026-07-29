"use client";

import { Suspense } from "react";
import Earth from "@/components/universe/Earth";
import Moon from "@/components/universe/Moon";
import Satellite from "@/components/universe/Satellite";

type PlanetStageProps = {
  earthRevealed: boolean;
  satelliteActive: boolean;
  onSatelliteSettled?: () => void;
  moonVisible: boolean;
  moonInteractive: boolean;
  onMoonSnapStart?: () => void;
  onMoonSettled?: (info: { smartAss: boolean }) => void;
};

/**
 * Earth / sat / moon fixed at the origin.
 * Screen placement (Earth lower) is done by CameraRig view-offset — not by moving the world.
 */
export default function PlanetStage({
  earthRevealed,
  satelliteActive,
  onSatelliteSettled,
  moonVisible,
  moonInteractive,
  onMoonSnapStart,
  onMoonSettled,
}: PlanetStageProps) {
  return (
    <group>
      <Suspense fallback={null}>
        <Earth revealed={earthRevealed} />
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
