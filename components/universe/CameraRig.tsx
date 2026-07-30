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
  /**
   * Vertical view-offset bias. Higher = optical center lower on screen.
   */
  screenBias?: number;
  /**
   * World Y the camera tracks (face-on). 0 = origin.
   * After Sun snap we lift this to mid-gap so the Sun sits high in frame.
   */
  targetY?: number;
};

/**
 * Face-on forever:
 *   camera on +Z of the focus point → lookAt focus → never “from above”.
 *
 * Screen bias via setViewOffset drops the optical center for Earth/Moon.
 * Solar AU frame uses targetY so the gap + Sun fill the column.
 */
export default function CameraRig({
  targetZ,
  screenBias = EARTH_SCREEN_BIAS,
  targetY = 0,
}: CameraRigProps) {
  const { camera, size } = useThree();
  const zRef = useRef(CAMERA_Z);
  const yRef = useRef(0);
  const biasRef = useRef(screenBias);

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
    yRef.current += (targetY - yRef.current) * k;
    biasRef.current += (screenBias - biasRef.current) * k;

    const y = yRef.current;
    // Face-on: same X/Y as focus, only Z changes
    cam.position.set(0, y, zRef.current);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, y, 0);

    if (cam.isPerspectiveCamera) {
      const z = zRef.current;
      cam.near = Math.max(0.05, z * 0.00025);
      cam.far = Math.max(5000, z * 6);
    }

    const w = Math.max(1, size.width);
    const h = Math.max(1, size.height);
    const bias = biasRef.current;
    const fullH = h * (1 + bias);

    if (cam.isPerspectiveCamera) {
      cam.setViewOffset(w, fullH, 0, 0, w, h);
      cam.updateProjectionMatrix();
    }
  });

  return null;
}
