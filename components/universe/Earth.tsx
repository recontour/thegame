"use client";

import { useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { EARTH_RADIUS } from "@/components/universe/constants";

const EARTH_TEXTURE_URL =
  "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";

/**
 * Gentle spinning Earth — first beat of the universe story.
 * Size is fixed for the whole lesson (no reveal scale-down).
 */
export default function Earth() {
  const meshRef = useRef<THREE.Mesh>(null);
  const map = useLoader(THREE.TextureLoader, EARTH_TEXTURE_URL);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.0012;
    }
  });

  return (
    <mesh ref={meshRef} scale={EARTH_RADIUS}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial map={map} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}
