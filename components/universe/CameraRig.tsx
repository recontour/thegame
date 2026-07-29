"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import {
  CAMERA_FOV,
  CAMERA_Z,
  EARTH_SCREEN_BIAS,
} from "@/components/universe/constants";

type CameraRigProps = {
  /** Target camera Z (larger = zoomed out) */
  targetZ: number;
};

/**
 * Face-on forever (perpendicular to the equator):
 *   camera on +Z → lookAt origin → Earth front, never “from above”.
 *
 * Earth sits in the *lower third of the screen* via setViewOffset —
 * we do NOT move Earth or tilt the camera. Full-bleed canvas keeps stars.
 */
export default function CameraRig({ targetZ }: CameraRigProps) {
  const { camera, size } = useThree();
  const zRef = useRef(CAMERA_Z);

  // Keep vertical FOV stable
  useLayoutEffect(() => {
    const cam = camera as PerspectiveCamera;
    if (cam.isPerspectiveCamera) {
      cam.fov = CAMERA_FOV;
      cam.updateProjectionMatrix();
    }
  }, [camera]);

  useFrame((_, dt) => {
    const cam = camera as PerspectiveCamera;
    const k = 1 - Math.exp(-4.5 * dt);
    zRef.current += (targetZ - zRef.current) * k;

    // Straight-on: same X/Y as Earth center, only Z changes
    cam.position.set(0, 0, zRef.current);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);

    /*
     * Bias: pretend the canvas is taller, show the TOP slice.
     * Optical center (Earth) drops into the lower part of the phone column.
     * More sky (+Y) stays visible above for the Moon — no blank bar.
     */
    const w = Math.max(1, size.width);
    const h = Math.max(1, size.height);
    const bias = EARTH_SCREEN_BIAS;
    const fullH = h * (1 + bias);

    if (cam.isPerspectiveCamera) {
      cam.setViewOffset(w, fullH, 0, 0, w, h);
      cam.updateProjectionMatrix();
    }
  });

  return null;
}
