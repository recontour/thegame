"use client";

import { Suspense } from "react";
import Earth from "@/components/universe/Earth";
import HomeMarker from "@/components/universe/HomeMarker";
import Moon from "@/components/universe/Moon";
import Satellite from "@/components/universe/Satellite";
import Sun from "@/components/universe/Sun";

type PlanetStageProps = {
  earthRevealed: boolean;
  satelliteActive: boolean;
  onSatelliteSettled?: () => void;
  moonVisible: boolean;
  moonInteractive: boolean;
  onMoonSnapStart?: () => void;
  onMoonSettled?: (info: { smartAss: boolean }) => void;
  onMoonGrayedTap?: () => void;
  /** Solar beat — Home pin + Sun only (no sat / moon / full Earth) */
  sunMode?: boolean;
  /** After snap Home docks to bottom UI — hide the 3D pin */
  sunHomeDocked?: boolean;
  sunVisible?: boolean;
  sunInteractive?: boolean;
  /** Camera Z while grayed — Sun holds screen slot as you zoom out */
  sunParkCameraZ?: number;
  onSunSnapStart?: () => void;
  onSunSettled?: (info: { smartAss: boolean }) => void;
  onSunGrayedTap?: () => void;
};

/**
 * Earth / sat / moon / sun at the origin.
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
  onMoonGrayedTap,
  sunMode = false,
  sunHomeDocked = false,
  sunVisible = false,
  sunInteractive = false,
  sunParkCameraZ,
  onSunSnapStart,
  onSunSettled,
  onSunGrayedTap,
}: PlanetStageProps) {
  return (
    <group>
      {/* Full Earth globe for early lessons; solar beat swaps to Home pin */}
      {!sunMode && (
        <Suspense fallback={null}>
          <Earth revealed={earthRevealed} />
        </Suspense>
      )}
      <HomeMarker visible={sunMode && !sunHomeDocked} />
      {!sunMode && (
        <>
          <Suspense fallback={null}>
            <Satellite
              active={satelliteActive}
              onSettled={onSatelliteSettled}
            />
          </Suspense>
          <Suspense fallback={null}>
            <Moon
              visible={moonVisible}
              interactive={moonInteractive}
              onSnapStart={onMoonSnapStart}
              onSettled={onMoonSettled}
              onGrayedTap={onMoonGrayedTap}
            />
          </Suspense>
        </>
      )}
      <Suspense fallback={null}>
        <Sun
          visible={sunVisible}
          interactive={sunInteractive}
          parkCameraZ={sunParkCameraZ}
          onSnapStart={onSunSnapStart}
          onSettled={onSunSettled}
          onGrayedTap={onSunGrayedTap}
        />
      </Suspense>
    </group>
  );
}
