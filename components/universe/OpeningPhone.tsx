"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";

const PHONE_PNG = "/universe/mobile.png";

useLoader.preload(THREE.TextureLoader, PHONE_PNG);

type OpeningPhoneProps = {
  /** Soft exit: move up and fade out */
  exiting: boolean;
  /** NDC y of the free band center under the quiz options (−1…+1) */
  slotNdcY?: number;
  onExitDone?: () => void;
};

/**
 * Floating phone PNG — parked in the open space under the quiz UI.
 */
export default function OpeningPhone({
  exiting,
  slotNdcY = -0.25,
  onExitDone,
}: OpeningPhoneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const { camera } = useThree();
  const map = useLoader(THREE.TextureLoader, PHONE_PNG);

  const opacityRef = useRef(0);
  const scaleRef = useRef(0.85);
  const zRef = useRef(1.55);
  const yRef = useRef(0);
  const targetYRef = useRef(0);
  const exitDoneRef = useRef(false);
  const exitStartY = useRef<number | null>(null);
  const tRef = useRef(0);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const plane = useMemo(() => new THREE.Plane(), []);

  useEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    map.needsUpdate = true;
  }, [map]);

  useFrame((_, dt) => {
    tRef.current += dt;

    const wantOpacity = exiting ? 0 : 1;

    opacityRef.current = THREE.MathUtils.damp(
      opacityRef.current,
      wantOpacity,
      exiting ? 4.2 : 1.6, // Crisp smooth fade-out (~0.5s)
      dt,
    );
    // Keep scale and z-depth constant during animation
    scaleRef.current = THREE.MathUtils.damp(scaleRef.current, 1, 1.4, dt);
    zRef.current = 1.55;

    // Map quiz free-band center → world Y on the phone's depth plane
    ndc.set(0, slotNdcY);
    raycaster.setFromCamera(ndc, camera);
    plane.setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, zRef.current),
    );
    if (raycaster.ray.intersectPlane(plane, hit)) {
      targetYRef.current = hit.y;
    }

    let finalTargetY = targetYRef.current;
    if (exiting) {
      if (exitStartY.current === null) {
        // On first exit frame, capture start Y and set a target above it
        exitStartY.current = yRef.current;
      }
      finalTargetY = exitStartY.current + 0.45; // Upward glide momentum
    } else {
      exitStartY.current = null; // Reset when not exiting
    }

    yRef.current = THREE.MathUtils.damp(
      yRef.current,
      finalTargetY,
      exiting ? 4.8 : 6, // Smooth upward glide
      dt,
    );

    if (matRef.current) {
      matRef.current.opacity = opacityRef.current;
    }

    const g = groupRef.current;
    if (g) {
      const bob = Math.sin(tRef.current * 0.7) * 0.015;
      g.position.set(0, yRef.current + bob, zRef.current);
      g.scale.setScalar(scaleRef.current);
      g.quaternion.copy(camera.quaternion);
    }

    if (
      exiting &&
      !exitDoneRef.current &&
      opacityRef.current < 0.04
    ) {
      exitDoneRef.current = true;
      onExitDone?.();
    }
  });

  const img = map.image as { width?: number; height?: number } | undefined;
  const aspect =
    img?.width && img?.height ? img.width / img.height : 9 / 19.5;
  const h = 0.475;
  const w = h * aspect;

  return (
    <group ref={groupRef} position={[0, 0, 1.55]}>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial
          ref={matRef}
          map={map}
          transparent
          opacity={0}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
