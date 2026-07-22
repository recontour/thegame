"use client";

import { useEffect, useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  depthPhotoFragment,
  depthPhotoVertex,
} from "@/components/gallery/depthPhotoShader";

export type DepthPhotoLayout = {
  position: [number, number, number];
  rotation: [number, number, number];
};

type ScrollRef = RefObject<{ progress: number; velocity: number } | null> | MutableRefObject<{ progress: number; velocity: number }>;
type PointerRef = RefObject<THREE.Vector2 | null> | MutableRefObject<THREE.Vector2>;

type DepthPhotoProps = {
  texture: THREE.Texture;
  layout: DepthPhotoLayout;
  /** Live scroll velocity + pointer (refs preferred for perf) */
  velocityRef: ScrollRef;
  pointerRef: PointerRef;
  /** Distance along Z over which a photo fades into the void */
  focusFalloff?: number;
  fit?: number;
};

function fitSize(
  viewport: { width: number; height: number },
  aspect: number,
  fit: number,
) {
  const vw = Math.max(viewport.width, 0.01);
  const vh = Math.max(viewport.height, 0.01);
  const viewAspect = vw / vh;
  if (viewAspect > aspect) {
    const h = vh * fit;
    return { w: h * aspect, h };
  }
  const w = vw * fit;
  return { w, h: w / aspect };
}

/**
 * Single photo floating in the void.
 * Only mount after texture is loaded.
 */
export default function DepthPhoto({
  texture,
  layout,
  velocityRef,
  pointerRef,
  focusFalloff = 5.5,
  fit = 0.78,
}: DepthPhotoProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  const { viewport, gl, camera } = useThree();

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: texture },
        uTime: { value: 0 },
        uFocus: { value: 0 },
        uVelocity: { value: 0 },
        uOpacity: { value: 1 },
        uPointer: { value: new THREE.Vector2(0, 0) },
      },
      vertexShader: depthPhotoVertex,
      fragmentShader: depthPhotoFragment,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
  }, [texture]);

  useEffect(() => {
    matRef.current = material;
    try {
      gl.initTexture(texture);
    } catch {
      /* ignore */
    }
    material.uniforms.uMap.value = texture;
    return () => {
      material.dispose();
    };
  }, [material, texture, gl]);

  useFrame((_, delta) => {
    const mat = matRef.current;
    const mesh = meshRef.current;
    if (!mat || !mesh) return;

    const scroll = velocityRef.current;
    const pointer = pointerRef.current;
    if (!scroll || !pointer) return;

    const velocity = scroll.velocity;
    const cameraZ = camera.position.z;

    mat.uniforms.uTime.value += delta;
    mat.uniforms.uVelocity.value = velocity;
    mat.uniforms.uPointer.value.copy(pointer);

    const photoZ = layout.position[2];
    // How far this plane is from the camera along the tunnel
    const dz = Math.abs(photoZ - cameraZ);
    // 0 = at the eye, 1 = lost in the void
    const focus = THREE.MathUtils.clamp(dz / focusFalloff, 0, 1);
    mat.uniforms.uFocus.value = focus;

    // Soft-hide photos the camera has already passed (camera looks down -Z)
    const behind = photoZ - cameraZ;
    let opacity = 1;
    if (behind > 0.55) {
      opacity = THREE.MathUtils.clamp(1 - (behind - 0.55) / 2.0, 0, 1);
    }
    mat.uniforms.uOpacity.value = opacity;

    // Idle breath + pointer parallax
    mesh.position.x = layout.position[0] + pointer.x * 0.12 * (1 - focus * 0.5);
    mesh.position.y =
      layout.position[1] +
      pointer.y * 0.08 * (1 - focus * 0.5) +
      Math.sin(mat.uniforms.uTime.value * 0.35 + photoZ) * 0.03;
    mesh.position.z = layout.position[2];
    mesh.rotation.x = layout.rotation[0] + pointer.y * 0.03;
    mesh.rotation.y = layout.rotation[1] + pointer.x * 0.05;
    mesh.rotation.z = layout.rotation[2];
    mesh.visible = opacity > 0.02;
  });

  const ud = texture.userData as { width?: number; height?: number };
  const img = texture.image as
    | HTMLCanvasElement
    | HTMLImageElement
    | ImageBitmap
    | undefined;
  const tw = ud?.width || (img && "width" in img ? Number(img.width) : 0) || 0;
  const th =
    ud?.height || (img && "height" in img ? Number(img.height) : 0) || 0;
  const aspect = tw && th ? tw / th : 3 / 4;
  const { w, h } = fitSize(viewport, aspect, fit);

  return (
    <mesh
      ref={meshRef}
      position={layout.position}
      rotation={layout.rotation}
      scale={[w, h, 1]}
      frustumCulled
    >
      <planeGeometry args={[1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/** Deterministic scatter layout for a series index. */
export function layoutForIndex(i: number, spacing = 4.2): DepthPhotoLayout {
  // Golden-ish offsets so the path feels intentional, not random noise
  const x = Math.sin(i * 1.7 + 0.4) * 0.95 + Math.sin(i * 0.5) * 0.15;
  const y = Math.cos(i * 1.15 + 0.2) * 0.45 + Math.sin(i * 0.8) * 0.12;
  const z = -i * spacing;
  const rotY = Math.sin(i * 0.9) * 0.12;
  const rotX = Math.cos(i * 0.7) * 0.05;
  return {
    position: [x, y, z],
    rotation: [rotX, rotY, 0],
  };
}
