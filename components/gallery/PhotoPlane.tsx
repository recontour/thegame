"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type PhotoPlaneProps = {
  texture: THREE.Texture;
  /** 0–1 presence */
  progress?: number;
  opacity?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  pointer: THREE.Vector2;
  parallax?: number;
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
  if (viewAspect > imageAspect) {
    const h = vh * fit;
    return { w: h * imageAspect, h };
  }
  const w = vw * fit;
  return { w, h: w / imageAspect };
}

/**
 * Gallery photo plane — MeshBasicMaterial only (same path that works for hero on phones).
 * Only mount this component when `texture` is already loaded.
 */
export default function PhotoPlane({
  texture,
  progress = 1,
  opacity = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  pointer,
  parallax = 0.09,
  fit = 0.9,
}: PhotoPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport, gl } = useThree();

  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      map: texture,
      color: new THREE.Color("#ffffff"),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
  }, [texture]);

  useEffect(() => {
    try {
      gl.initTexture(texture);
    } catch (e) {
      console.warn("[PhotoPlane] initTexture", e);
    }
    material.map = texture;
    material.needsUpdate = true;
    return () => {
      material.dispose();
    };
  }, [material, texture, gl]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const p = THREE.MathUtils.clamp(progress, 0, 1);
    material.opacity = Math.min(1, opacity * (0.15 + 0.85 * p));
    const lift = 0.7 + 0.3 * p;
    material.color.setRGB(lift, lift, lift);

    mesh.position.x = position[0] + pointer.x * parallax;
    mesh.position.y = position[1] + pointer.y * parallax * 0.65;
    mesh.position.z = position[2];
    mesh.rotation.x = rotation[0] + pointer.y * 0.04;
    mesh.rotation.y = rotation[1] + pointer.x * 0.06;
    mesh.rotation.z = rotation[2];

    // damp unused
    void delta;
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
  const imageAspect = tw && th ? tw / th : 3 / 4;
  const { w, h } = fitPlaneSize(viewport, imageAspect, fit);

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      scale={[w, h, 1]}
      visible={opacity > 0.001}
    >
      <planeGeometry args={[1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/** Almost-black placeholder while the current slide's texture is loading. */
export function GalleryPlaceholder({
  pointer,
  opacity = 0.35,
}: {
  pointer: THREE.Vector2;
  opacity?: number;
}) {
  const { viewport } = useThree();
  const vw = Math.max(viewport.width, 0.01) * 0.9;
  const vh = Math.max(viewport.height, 0.01) * 0.9;

  return (
    <mesh
      position={[pointer.x * 0.04, pointer.y * 0.03, 0]}
      scale={[vw, vh, 1]}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        color="#0c0c0c"
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </mesh>
  );
}
