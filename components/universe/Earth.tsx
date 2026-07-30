"use client";

import { useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { EARTH_RADIUS } from "@/components/universe/constants";

const EARTH_TEXTURE_URL =
  "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";

type EarthProps = {
  /**
   * When true, Earth eases in (scale + fade).
   * When false, stays hidden / scaled down.
   */
  revealed?: boolean;
};

/**
 * Gentle spinning Earth — fades/scales in after the phone opening.
 * (Solar beat uses HomeMarker instead of this globe.)
 */
export default function Earth({ revealed = true }: EarthProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const map = useLoader(THREE.TextureLoader, EARTH_TEXTURE_URL);
  const revealRef = useRef(revealed ? 1 : 0);

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    mesh.rotation.y += 0.0012;

    revealRef.current = THREE.MathUtils.damp(
      revealRef.current,
      revealed ? 1 : 0,
      1.7,
      dt,
    );
    const r = revealRef.current;
    // Scale up into place from a smaller seed
    const s = EARTH_RADIUS * (0.2 + 0.8 * r);
    mesh.scale.set(s, s, s);

    if (matRef.current) {
      matRef.current.opacity = r;
      matRef.current.transparent = r < 0.99;
      matRef.current.depthWrite = r > 0.9;
    }
  });

  return (
    <mesh ref={meshRef} scale={EARTH_RADIUS * 0.2} visible={true} renderOrder={2}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial
        ref={matRef}
        map={map}
        roughness={0.85}
        metalness={0.05}
        transparent
        opacity={0}
        depthTest
        depthWrite
      />
    </mesh>
  );
}
