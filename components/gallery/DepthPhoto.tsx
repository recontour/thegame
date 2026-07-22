"use client";

import {
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type RefObject,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type DepthPhotoLayout = {
  position: [number, number, number];
  rotation: [number, number, number];
};

type ScrollRef =
  | RefObject<{ progress: number; velocity: number } | null>
  | MutableRefObject<{ progress: number; velocity: number }>;
type PointerRef =
  | RefObject<THREE.Vector2 | null>
  | MutableRefObject<THREE.Vector2>;

type DepthPhotoProps = {
  texture: THREE.Texture;
  layout: DepthPhotoLayout;
  velocityRef: ScrollRef;
  pointerRef: PointerRef;
  /** How quickly distant frames fade (world units) */
  focusFalloff?: number;
  /**
   * Fraction of the view frustum at the photo’s distance (contain).
   * 0.88 = full photo visible with a little black margin — never cropped.
   */
  fit?: number;
};

function getTextureAspect(texture: THREE.Texture): number {
  const ud = texture.userData as { width?: number; height?: number };
  const img = texture.image as
    | HTMLCanvasElement
    | HTMLImageElement
    | ImageBitmap
    | undefined;
  const tw = ud?.width || (img && "width" in img ? Number(img.width) : 0) || 0;
  const th =
    ud?.height || (img && "height" in img ? Number(img.height) : 0) || 0;
  if (tw > 0 && th > 0) return tw / th;
  return 3 / 4;
}

/**
 * Clean photograph in the void.
 * MeshBasicMaterial (mobile-stable) — no heavy CA / glitch shaders.
 * Sized with true contain math at the camera→plane distance so nothing crops.
 */
export default function DepthPhoto({
  texture,
  layout,
  velocityRef,
  pointerRef,
  focusFalloff = 6,
  fit = 0.88,
}: DepthPhotoProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const { gl, camera, size } = useThree();

  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      color: new THREE.Color("#ffffff"),
      transparent: true,
      opacity: 1,
      depthWrite: false,
      toneMapped: false,
      side: THREE.FrontSide,
    });
    return mat;
  }, [texture]);

  useEffect(() => {
    matRef.current = material;
    // Quality flags on the map
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 1;
    texture.needsUpdate = true;
    material.map = texture;
    material.needsUpdate = true;
    try {
      gl.initTexture(texture);
    } catch {
      /* ignore */
    }
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

    const cameraZ = camera.position.z;
    const photoZ = layout.position[2];
    const dist = Math.max(0.35, Math.abs(photoZ - cameraZ));

    // --- Contain framing at this photo’s distance (never crop) ---
    const persp = camera as THREE.PerspectiveCamera;
    const vFov = THREE.MathUtils.degToRad(persp.fov ?? 50);
    const viewH = 2 * Math.tan(vFov / 2) * dist;
    const viewW = viewH * Math.max(size.width / Math.max(size.height, 1), 0.01);
    const aspect = getTextureAspect(texture);

    let w: number;
    let h: number;
    if (viewW / viewH > aspect) {
      // view is wider than image → height-limited
      h = viewH * fit;
      w = h * aspect;
    } else {
      // view is taller / narrower → width-limited
      w = viewW * fit;
      h = w / aspect;
    }
    mesh.scale.set(w, h, 1);

    // Soft distance fade only (no image distortion)
    const dz = Math.abs(photoZ - cameraZ);
    const far = THREE.MathUtils.clamp(dz / focusFalloff, 0, 1);

    // Passed frames (camera looks down -Z): fade out behind
    const behind = photoZ - cameraZ;
    let opacity = THREE.MathUtils.lerp(1, 0.28, far * far);
    if (behind > 0.5) {
      opacity *= THREE.MathUtils.clamp(1 - (behind - 0.5) / 1.8, 0, 1);
    }

    // Barely-there velocity response (opacity only — image stays sharp)
    const vel = scroll.velocity;
    opacity *= 1 - Math.min(0.06, vel * 0.06);

    mat.opacity = opacity;
    mat.color.setRGB(1, 1, 1);

    // Very light parallax / breath — layout, not the pixels
    const focusKeep = 1 - far * 0.55;
    mesh.position.x =
      layout.position[0] + pointer.x * 0.06 * focusKeep;
    mesh.position.y =
      layout.position[1] +
      pointer.y * 0.04 * focusKeep +
      Math.sin(performance.now() * 0.00035 + photoZ) * 0.015;
    mesh.position.z = layout.position[2];
    // Minimal tilt — keep photos nearly square-on so framing reads clean
    mesh.rotation.x = layout.rotation[0] * 0.35 + pointer.y * 0.015;
    mesh.rotation.y = layout.rotation[1] * 0.35 + pointer.x * 0.02;
    mesh.rotation.z = 0;
    mesh.visible = opacity > 0.03;

    void delta;
  });

  return (
    <mesh
      ref={meshRef}
      position={layout.position}
      rotation={layout.rotation}
      frustumCulled
    >
      <planeGeometry args={[1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/**
 * Gentler scatter — still a void, but photos stay readable and centered enough.
 */
export function layoutForIndex(i: number, spacing = 4.6): DepthPhotoLayout {
  const x = Math.sin(i * 1.55 + 0.3) * 0.42;
  const y = Math.cos(i * 1.1 + 0.15) * 0.18;
  const z = -i * spacing;
  const rotY = Math.sin(i * 0.85) * 0.04;
  const rotX = Math.cos(i * 0.65) * 0.02;
  return {
    position: [x, y, z],
    rotation: [rotX, rotY, 0],
  };
}
