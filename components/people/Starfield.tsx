"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type StarfieldProps = {
  count: number;
  /** Optional scroll energy — background drifts slower than the photos */
  motionRef?: React.MutableRefObject<number>;
};

/** Deterministic 0..1 hash — keeps star layout stable across re-renders. */
function hash01(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Do NOT redeclare `position` / `color` / matrices — ShaderMaterial already
 * injects those (vertexColors + built-in attributes). Redeclaring `color`
 * fails VALIDATE_STATUS on modern Three (r185+).
 */
const starVert = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    #ifdef USE_COLOR
      vColor = color;
    #else
      vColor = vec3(0.95);
    #endif

    float tw = 0.45 + 0.55 * sin(uTime * (0.4 + aPhase * 0.35) + aPhase * 6.2831);
    vAlpha = tw;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    // Size attenuation (clamp z so we never divide by ~0)
    float depth = max(0.5, -mvPosition.z);
    gl_PointSize = aSize * (180.0 / depth) * (0.75 + 0.35 * tw);
  }
`;

const starFrag = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d = length(c);
    if (d > 0.5) discard;
    float soft = 1.0 - smoothstep(0.15, 0.5, d);
    gl_FragColor = vec4(vColor, soft * vAlpha * 0.85);
  }
`;

/**
 * One-draw-call starfield with a tiny custom shader (twinkle + soft disc).
 * Mid-range Android: keep count ≤ ~160–200.
 * Slow parallax lag vs the photo stack (farthest plane).
 */
export default function Starfield({ count, motionRef }: StarfieldProps) {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  const groupRef = useRef<THREE.Group>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (hash01(i, 1) - 0.5) * 14;
      positions[i * 3 + 1] = (hash01(i, 2) - 0.5) * 22;
      positions[i * 3 + 2] = -2 - hash01(i, 3) * 18;

      sizes[i] = 1.2 + hash01(i, 4) * 2.4;
      phases[i] = hash01(i, 5);

      const cool = 0.9 + hash01(i, 6) * 0.1;
      colors[i * 3] = cool * 0.9;
      colors[i * 3 + 1] = cool * 0.94;
      colors[i * 3 + 2] = cool;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    return geo;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: starVert,
        fragmentShader: starFrag,
        uniforms: { uTime: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        // Enables Three's injected `attribute vec3 color` + USE_COLOR
        vertexColors: true,
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => {
    matRef.current = material;
    return () => {
      geometry.dispose();
      material.dispose();
      matRef.current = null;
    };
  }, [geometry, material]);

  useFrame(({ clock }) => {
    const mat = matRef.current;
    if (mat) mat.uniforms.uTime.value = clock.elapsedTime;

    const g = groupRef.current;
    if (g && motionRef) {
      // Stars lag hard — deep background plane
      const m = motionRef.current;
      g.position.y = -m * 0.22;
      g.position.x = m * 0.04;
      g.rotation.z = m * 0.012;
    }
  });

  return (
    <group ref={groupRef}>
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}
