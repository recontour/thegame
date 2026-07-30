"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Decorative backdrop only — not true-scale.
 * Stars live behind the scene (negative Z) so they never paint over
 * Earth / Moon / Sun.
 */
const STAR_COUNT = 2200;

/** Slow drift vs Earth — sky should lag, not race */
const STAR_SPIN = 0.00012;

/**
 * Starfield — gimmicky sky, kept behind the action.
 */
export default function Stars() {
  const groupRef = useRef<THREE.Group>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);

    for (let i = 0; i < STAR_COUNT; i++) {
      // Shell behind the camera look direction (we look from +Z → origin)
      const r = 50 + Math.random() * 90;
      const u = Math.random();
      const v = Math.random();
      // Always negative Z so stars sit behind Earth / Sun, never on top
      const z = -(0.35 + 0.65 * u) * r;
      const rho = Math.sqrt(Math.max(0, r * r - z * z));
      const a = v * 2 * Math.PI;

      positions[i * 3] = rho * Math.cos(a);
      positions[i * 3 + 1] = rho * Math.sin(a);
      positions[i * 3 + 2] = z;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.14,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        depthTest: true,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += STAR_SPIN;
    }
  });

  return (
    <group ref={groupRef} renderOrder={-10}>
      <points
        geometry={geometry}
        material={material}
        frustumCulled={false}
        renderOrder={-10}
      />
    </group>
  );
}
