"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * One draw call of point sprites — thousands is still cheap on phones.
 * (Not a particle sim; just a static buffer + a group rotation.)
 */
const STAR_COUNT = 3200;

/** Slow drift vs Earth — sky should lag, not race */
const STAR_SPIN = 0.00035;

/**
 * Starfield — denser points in a big sphere, gentle spin with Earth.
 */
export default function Stars() {
  const groupRef = useRef<THREE.Group>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);

    for (let i = 0; i < STAR_COUNT; i++) {
      // Spread stars in a large sphere around the Earth
      const r = 40 + Math.random() * 60;
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
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
        opacity: 0.88,
        depthWrite: false,
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
    <group ref={groupRef}>
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}
