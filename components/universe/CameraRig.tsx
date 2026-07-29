"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CAMERA_Z } from "@/components/universe/constants";

type CameraRigProps = {
  /** Target camera Z (larger = zoomed out) */
  targetZ: number;
  /**
   * Target camera Y — must match the planet stage Y so we always look
   * straight at Earth (perpendicular face-on), never “down” at it.
   */
  targetY?: number;
};

/**
 * Smooth camera: zoom on Z, and ride Y with the planet stack so the
 * viewpoint stays face-on to Earth like the first frame.
 */
export default function CameraRig({ targetZ, targetY = 0 }: CameraRigProps) {
  const { camera } = useThree();
  const zRef = useRef(CAMERA_Z);
  const yRef = useRef(0);

  useFrame((_, dt) => {
    zRef.current = THREE.MathUtils.damp(zRef.current, targetZ, 5, dt);
    yRef.current = THREE.MathUtils.damp(yRef.current, targetY, 2.2, dt);

    // Same Y as Earth → look along −Z through Earth's center (face-on)
    camera.position.set(0, yRef.current, zRef.current);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, yRef.current, 0);
  });

  return null;
}
