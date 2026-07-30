"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MOON_DISTANCE } from "@/components/universe/constants";

type LightBeamProps = {
  /** When true, plays Moon → Earth once */
  active: boolean;
  /** Seconds for the hop (real Moon light-time ≈ 1.3) */
  duration?: number;
  onComplete?: () => void;
};

const MAX_TRAIL_POINTS = 40;

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Glowing photon + fading comet-tail points from settled Moon → Earth.
 */
export default function LightBeam({
  active,
  duration = 2.8,
  onComplete,
}: LightBeamProps) {
  const groupRef = useRef<THREE.Group>(null);
  const photonRef = useRef<THREE.Mesh>(null);

  const from = useMemo(() => new THREE.Vector3(0, MOON_DISTANCE, 0), []);
  const to = useMemo(() => new THREE.Vector3(0, 0, 0), []);

  const trailPositions = useMemo(
    () => new Float32Array(MAX_TRAIL_POINTS * 3),
    [],
  );
  const trailColors = useMemo(
    () => new Float32Array(MAX_TRAIL_POINTS * 3),
    [],
  );

  const { points, pointsMat, pointsGeom } = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.BufferAttribute(trailPositions, 3),
    );
    geom.setAttribute("color", new THREE.BufferAttribute(trailColors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.028,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      toneMapped: false,
    });
    const pts = new THREE.Points(geom, mat);
    pts.frustumCulled = false;
    return { points: pts, pointsMat: mat, pointsGeom: geom };
  }, [trailPositions, trailColors]);

  useEffect(() => {
    return () => {
      pointsGeom.dispose();
      pointsMat.dispose();
    };
  }, [pointsGeom, pointsMat]);

  const historyRef = useRef<THREE.Vector3[]>([]);
  const playingRef = useRef(false);
  const doneRef = useRef(false);
  const startTimeRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!active) {
      playingRef.current = false;
      doneRef.current = false;
      historyRef.current = [];
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }

    historyRef.current = [];
    trailPositions.fill(0);
    trailColors.fill(0);
    pointsGeom.attributes.position.needsUpdate = true;
    pointsGeom.attributes.color.needsUpdate = true;

    if (photonRef.current) photonRef.current.position.copy(from);
    if (groupRef.current) groupRef.current.visible = true;

    playingRef.current = true;
    doneRef.current = false;
    startTimeRef.current = performance.now();
  }, [active, from, trailPositions, trailColors, pointsGeom]);

  useFrame(() => {
    if (!playingRef.current || doneRef.current) return;

    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    const t = Math.min(elapsed / duration, 1);
    const ease = smoothstep(t);

    if (photonRef.current) {
      photonRef.current.position.lerpVectors(from, to, ease);

      const history = historyRef.current;
      history.unshift(photonRef.current.position.clone());
      if (history.length > MAX_TRAIL_POINTS) history.pop();

      for (let i = 0; i < MAX_TRAIL_POINTS; i++) {
        const idx = i * 3;
        if (i < history.length) {
          const p = history[i];
          trailPositions[idx] = p.x;
          trailPositions[idx + 1] = p.y;
          trailPositions[idx + 2] = p.z;

          // Fade bright at head → dim at tail
          const fade = 1 - i / MAX_TRAIL_POINTS;
          trailColors[idx] = 1.0 * fade;
          trailColors[idx + 1] = 0.95 * fade;
          trailColors[idx + 2] = 0.8 * fade;
        } else {
          trailPositions[idx] = 0;
          trailPositions[idx + 1] = 0;
          trailPositions[idx + 2] = 0;
          trailColors[idx] = 0;
          trailColors[idx + 1] = 0;
          trailColors[idx + 2] = 0;
        }
      }

      pointsGeom.attributes.position.needsUpdate = true;
      pointsGeom.attributes.color.needsUpdate = true;
    }

    if (t >= 1) {
      playingRef.current = false;
      doneRef.current = true;
      onCompleteRef.current?.();
    }
  });

  return (
    <group ref={groupRef} visible={false} renderOrder={5}>
      {/* Glowing photon head */}
      <mesh ref={photonRef} position={[0, MOON_DISTANCE, 0]} renderOrder={6}>
        <sphereGeometry args={[0.018, 16, 16]} />
        <meshBasicMaterial
          color={0xffffff}
          transparent
          opacity={1}
          depthWrite={false}
          toneMapped={false}
        />
        {/* Soft outer glow */}
        <mesh renderOrder={5}>
          <sphereGeometry args={[0.045, 16, 16]} />
          <meshBasicMaterial
            color={0xfff2cc}
            transparent
            opacity={0.45}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </mesh>
      <primitive object={points} />
    </group>
  );
}
