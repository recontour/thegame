"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  photoFragmentShader,
  photoVertexShader,
} from "@/components/gallery/shaders";

export type PhotoPlaneProps = {
  texture: THREE.Texture | null;
  /** 0–1 presence / reveal amount */
  progress: number;
  /** 0–1 elegant glitch */
  glitch?: number;
  opacity?: number;
  /** 1 = landing emerge look; 0 = gallery still */
  modeReveal?: number;
  grain?: number;
  /** world-space base position (before parallax) */
  position?: [number, number, number];
  /** slight base rotation for depth */
  rotation?: [number, number, number];
  /** finger position in NDC-ish -1..1 */
  pointer: THREE.Vector2;
  /** max mesh parallax in world units */
  parallax?: number;
  visible?: boolean;
  /** scale factor vs full contain fit (1 = as large as possible without crop) */
  fit?: number;
};

function fitPlaneSize(
  viewport: { width: number; height: number },
  imageAspect: number,
  fit = 1,
) {
  const vw = Math.max(viewport.width, 0.01);
  const vh = Math.max(viewport.height, 0.01);
  const viewAspect = vw / vh;
  let w: number;
  let h: number;
  if (viewAspect > imageAspect) {
    h = vh * fit;
    w = h * imageAspect;
  } else {
    w = vw * fit;
    h = w / imageAspect;
  }
  return { w, h };
}

export default function PhotoPlane({
  texture,
  progress,
  glitch = 0,
  opacity = 1,
  modeReveal = 0,
  grain = 0.028,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  pointer,
  parallax = 0.1,
  visible = true,
  fit = 0.92,
}: PhotoPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const { viewport } = useThree();

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: texture },
        uProgress: { value: progress },
        uTime: { value: 0 },
        uGlitch: { value: glitch },
        uGrain: { value: grain },
        uModeReveal: { value: modeReveal },
        uOpacity: { value: opacity },
        uPointer: { value: new THREE.Vector2(0, 0) },
      },
      vertexShader: photoVertexShader,
      fragmentShader: photoFragmentShader,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
  }, [texture]);

  useEffect(() => {
    materialRef.current = material;
    return () => {
      material.dispose();
    };
  }, [material]);

  useEffect(() => {
    if (material.uniforms.uTexture) {
      material.uniforms.uTexture.value = texture;
    }
  }, [material, texture]);

  useFrame((_, delta) => {
    const mat = materialRef.current;
    const mesh = meshRef.current;
    if (!mat || !mesh) return;

    mat.uniforms.uTime.value += delta;
    mat.uniforms.uProgress.value = progress;
    mat.uniforms.uGlitch.value = glitch;
    mat.uniforms.uGrain.value = grain;
    mat.uniforms.uModeReveal.value = modeReveal;
    mat.uniforms.uOpacity.value = opacity;
    mat.uniforms.uPointer.value.copy(pointer);

    // soft depth parallax on the mesh itself
    mesh.position.x = position[0] + pointer.x * parallax;
    mesh.position.y = position[1] + pointer.y * parallax * 0.65;
    mesh.position.z = position[2];
    mesh.rotation.x = rotation[0] + pointer.y * 0.04;
    mesh.rotation.y = rotation[1] + pointer.x * 0.06;
    mesh.rotation.z = rotation[2];
  });

  if (!texture || !visible) return null;

  const img = texture.image as HTMLImageElement | ImageBitmap | undefined;
  const imageAspect =
    img && "width" in img && img.width && img.height
      ? img.width / img.height
      : 1;
  const { w, h } = fitPlaneSize(viewport, imageAspect, fit);

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      scale={[w, h, 1]}
      visible={opacity > 0.001}
    >
      <planeGeometry args={[1, 1, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
