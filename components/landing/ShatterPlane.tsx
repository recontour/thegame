"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { isMobileDevice } from "@/components/gallery/loadMobileSafeTexture";
import { smoothstep } from "@/components/landing/useLandingProgress";

type ShatterPlaneProps = {
  texture: THREE.Texture;
  /** Live progress reader (0..1), updated every frame. */
  getProgress: () => number;
};

const MAX_MOBILE = 160;
const MAX_DESKTOP = 280;

const vertexShader = /* glsl */ `
uniform float uProgress;
uniform vec2 uUvScale;

attribute vec3 aOffset;
attribute vec3 aRotation;
attribute vec2 aUvOffset;

varying vec2 vMapUv;

mat3 rotationMatrixXYZ(vec3 r) {
  float cx = cos(r.x);
  float sx = sin(r.x);
  float cy = cos(r.y);
  float sy = sin(r.y);
  float cz = cos(r.z);
  float sz = sin(r.z);
  return mat3(
     cy * cz, cx * sz + sx * sy * cz, sx * sz - cx * sy * cz,
    -cy * sz, cx * cz - sx * sy * sz, sx * cz + cx * sy * sz,
          sy,               -sx * cy,                cx * cy
  );
}

void main() {
  // Tile local UV (0..1) → patch of the hero texture
  vMapUv = uv * uUvScale + aUvOffset;

  mat3 rotMat = rotationMatrixXYZ(uProgress * aRotation);
  vec3 transformed = rotMat * position;

  vec4 mvPosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    mvPosition = instanceMatrix * mvPosition;
  #endif

  // Fly-apart in instance / world-ish space before view
  mvPosition.xyz += uProgress * aOffset;

  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;
}
`;

// No Three color-space includes: they collide with the WebGLProgram prefix
// and fail to compile on ShaderMaterial. Photo path = raw sample + display.
const fragmentShader = /* glsl */ `
uniform sampler2D map;
uniform float uOpacity;

varying vec2 vMapUv;

void main() {
  vec4 texel = texture2D(map, vMapUv);
  if (texel.a < 0.01) discard;
  gl_FragColor = vec4(texel.rgb, texel.a * uOpacity);
}
`;

/**
 * One texture → grid of tiles that assemble / shatter with progress.
 * Custom ShaderMaterial (not onBeforeCompile) — stable on Three r18x / mobile.
 */
export default function ShatterPlane({
  texture,
  getProgress,
}: ShatterPlaneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const uProgress = useRef({ value: 1.2 });
  const uOpacity = useRef({ value: 1 });
  const uvScale = useRef(new THREE.Vector2(1, 1));
  const { viewport, size, gl } = useThree();

  const mobile = useMemo(() => isMobileDevice(), []);
  const colsTarget = mobile ? 10 : 14;
  const maxInstances = mobile ? MAX_MOBILE : MAX_DESKTOP;

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        map: { value: texture },
        uProgress: uProgress.current,
        uUvScale: { value: uvScale.current },
        uOpacity: uOpacity.current,
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      // Unlit photo — skip ACES so midtones stay honest
      toneMapped: false,
    });
  }, [texture]);

  useEffect(() => {
    // NoColorSpace: sample file bytes as-is (no linearize). Correct for a
    // display-only ShaderMaterial without Three's color-management chunks.
    texture.colorSpace = THREE.NoColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    material.uniforms.map.value = texture;
    material.needsUpdate = true;
    try {
      gl.initTexture(texture);
    } catch {
      /* ignore */
    }
  }, [texture, material, gl]);

  // Placeholder until layout builds the real grid
  const placeholderGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  useEffect(() => {
    return () => {
      material.dispose();
      placeholderGeo.dispose();
    };
  }, [material, placeholderGeo]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const wWidth = Math.max(viewport.width, 0.01);
    const wHeight = Math.max(viewport.height, 0.01);

    let useSize = wWidth / colsTarget;
    let useNx = Math.ceil(wWidth / useSize) + 1;
    let useNy = Math.ceil(wHeight / useSize) + 1;
    let icount = useNx * useNy;

    if (icount > maxInstances) {
      const scale = Math.sqrt(icount / maxInstances);
      useSize *= scale;
      useNx = Math.ceil(wWidth / useSize) + 1;
      useNy = Math.ceil(wHeight / useSize) + 1;
      icount = useNx * useNy;
    }

    // Hard clamp count to buffer size
    icount = Math.min(icount, maxInstances);

    const geo = new THREE.PlaneGeometry(useSize, useSize);
    const { randFloat: rnd, randFloatSpread: rndFS } = THREE.MathUtils;

    const offsets = new Float32Array(icount * 3);
    const rotations = new Float32Array(icount * 3);
    const uvOffsets = new Float32Array(icount * 2);
    const angle = Math.PI * 3.2;

    const img = texture.image as { width?: number; height?: number } | undefined;
    const tw = (img && "width" in img ? Number(img.width) : 0) || 1;
    const th = (img && "height" in img ? Number(img.height) : 0) || 1;
    const tRatio = tw / th;
    const ratio = useNx / Math.max(useNy, 1);

    if (ratio > tRatio) {
      uvScale.current.set(1 / useNx, tRatio / ratio / useNy);
    } else {
      uvScale.current.set(ratio / tRatio / useNx, 1 / useNy);
    }
    // Keep material uniform pointing at same Vector2
    material.uniforms.uUvScale.value = uvScale.current;

    const nW = uvScale.current.x * useNx;
    const nH = uvScale.current.y * useNy;

    const originX =
      -(wWidth - (wWidth - useNx * useSize)) / 2 + useSize / 2;
    const originY =
      -(wHeight - (wHeight - useNy * useSize)) / 2 + useSize / 2;

    let index = 0;
    for (let i = 0; i < useNx && index < icount; i++) {
      for (let j = 0; j < useNy && index < icount; j++) {
        const fallBias = 1 - j / Math.max(useNy - 1, 1);
        offsets[index * 3] = rndFS(mobile ? 1.4 : 2.2);
        offsets[index * 3 + 1] = -rnd(0.8, 2.4) * (0.55 + fallBias * 1.1);
        offsets[index * 3 + 2] = rnd(0.4, mobile ? 1.6 : 2.8);

        rotations[index * 3] = rndFS(angle);
        rotations[index * 3 + 1] = rndFS(angle);
        rotations[index * 3 + 2] = rndFS(angle);

        uvOffsets[index * 2] = uvScale.current.x * i + (1 - nW) / 2;
        uvOffsets[index * 2 + 1] = uvScale.current.y * j + (1 - nH) / 2;

        index++;
      }
    }
    // If loops exited early, icount may be higher — use written count
    const written = index;

    geo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 3));
    geo.setAttribute(
      "aRotation",
      new THREE.InstancedBufferAttribute(rotations, 3),
    );
    geo.setAttribute(
      "aUvOffset",
      new THREE.InstancedBufferAttribute(uvOffsets, 2),
    );

    const prev = mesh.geometry;
    mesh.geometry = geo;
    mesh.count = written;
    if (prev && prev !== geo && prev !== placeholderGeo) prev.dispose();

    const dummy = new THREE.Object3D();
    index = 0;
    for (let i = 0; i < useNx && index < written; i++) {
      for (let j = 0; j < useNy && index < written; j++) {
        dummy.position.set(
          originX + i * useSize,
          originY + j * useSize,
          0,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(index++, dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [
    viewport.width,
    viewport.height,
    size.width,
    size.height,
    colsTarget,
    mobile,
    maxInstances,
    texture,
    placeholderGeo,
    material,
  ]);

  useFrame(() => {
    const p = getProgress();

    // 0–0.50 assemble · 0.50–0.64 hold · 0.64–1 re-shatter + lift
    const assemble = smoothstep(0.0, 0.5, p);
    const exit = smoothstep(0.64, 1.0, p);

    const shatter = (1 - assemble) * 1.25 + exit * 1.55;
    uProgress.current.value = shatter;

    const opacity = 1 - exit * 0.92;
    uOpacity.current.value = opacity;

    if (groupRef.current) {
      const y =
        THREE.MathUtils.lerp(-0.42, 0.02, assemble) +
        exit * (mobile ? 1.55 : 1.85);
      const z = exit * -0.35;
      const s = 0.94 + assemble * 0.06 - exit * 0.08;
      groupRef.current.position.set(0, y, z);
      groupRef.current.scale.setScalar(s);
      const hold = assemble * (1 - exit);
      groupRef.current.rotation.z =
        Math.sin(performance.now() * 0.0004) * 0.008 * hold;
    }
  });

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={meshRef}
        args={[placeholderGeo, material, maxInstances]}
        frustumCulled={false}
      />
    </group>
  );
}
