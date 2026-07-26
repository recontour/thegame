"use client";

/**
 * Dreamy void: exponential fog + optional soft haze plane.
 * No EffectComposer / bloom — those thrash tile GPUs on mid Android.
 *
 * Fog/background attached via R3F declarative props (not scene.fog mutation).
 */
export default function Atmosphere({ haze }: { haze: boolean }) {
  return (
    <>
      <color attach="background" args={["#050508"]} />
      <fogExp2 attach="fog" args={["#07070c", 0.038]} />

      {haze ? (
        <mesh position={[0, 0, -6]} renderOrder={-1} frustumCulled={false}>
          <planeGeometry args={[30, 40]} />
          <meshBasicMaterial
            color="#0a1020"
            transparent
            opacity={0.22}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ) : null}
    </>
  );
}
