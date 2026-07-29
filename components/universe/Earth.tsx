"use client";

import { useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";

const EARTH_TEXTURE_URL =
  "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";

/**
 * Gentle spinning Earth — first beat of the universe story.
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
    // Portrait column is narrow — keep the globe inside the frame with padding
    <mesh ref={meshRef} scale={0.45}>
      <sphereGeometry args={[1, 64, 64]} />
      <meshStandardMaterial map={map} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}
