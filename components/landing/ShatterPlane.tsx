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
  /** Intro reveal 0..1 — pieces fade/rise in after welcome text (DOM-driven). */
  getIntroReveal?: () => number;
  /**
   * How far down the stage the copy ends (0 = top, 1 = bottom).
   * Measured once / on resize — not every frame. Keeps the pile under the text.
   */
  getTextClearFromTop?: () => number;
};

const MAX_MOBILE = 160;
const MAX_DESKTOP = 280;

/**
 * One texture → grid of tiles that assemble / shatter with progress.
 *
 * Uses MeshBasicMaterial (same color path as Hero) + vertex-only
 * onBeforeCompile so sRGB decode/encode stays correct — no dark photo.
 */
export default function ShatterPlane({
  texture,
  getProgress,
  getIntroReveal,
  getTextClearFromTop,
}: ShatterPlaneProps) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const uProgress = useRef({ value: 1.2 });
  const uvScale = useRef(new THREE.Vector2(1, 1));
  const matRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const { viewport, size, gl } = useThree();

  const mobile = useMemo(() => isMobileDevice(), []);
  const colsTarget = mobile ? 10 : 14;
  const maxInstances = mobile ? MAX_MOBILE : MAX_DESKTOP;

  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      color: new THREE.Color("#ffffff"),
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uProgress = uProgress.current;
      shader.uniforms.uUvScale = { value: uvScale.current };

      shader.vertexShader =
        /* glsl */ `
        uniform float uProgress;
        uniform vec2 uUvScale;
        attribute vec3 aOffset;
        attribute vec3 aRotation;
        attribute vec2 aUvOffset;

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
      ` + shader.vertexShader;

      // Modern Three samples the map with vMapUv (not vUv)
      shader.vertexShader = shader.vertexShader.replace(
        "#include <uv_vertex>",
        /* glsl */ `
        #include <uv_vertex>
        #ifdef USE_MAP
          vMapUv = uv * uUvScale + aUvOffset;
        #endif
        `,
      );

      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        /* glsl */ `
        mat3 rotMat = rotationMatrixXYZ(uProgress * aRotation);
        transformed = rotMat * transformed;

        vec4 mvPosition = vec4( transformed, 1.0 );

        #ifdef USE_BATCHING
          mvPosition = batchingMatrix * mvPosition;
        #endif

        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif

        mvPosition.xyz += uProgress * aOffset;

        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
        `,
      );
    };

    // Unique program so our patches aren't shared with other MeshBasicMaterials
    mat.customProgramCacheKey = () => "landing-shatter-v3";
    matRef.current = mat;
    return mat;
  }, [texture]);

  useEffect(() => {
    // Same color path as Hero — MeshBasicMaterial handles linear ↔ sRGB
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    material.map = texture;
    material.needsUpdate = true;
    try {
      gl.initTexture(texture);
    } catch {
      /* ignore */
    }
  }, [texture, material, gl]);

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

    /**
     * Full rectangular grid only — never clamp instance count mid-column.
     */
    let useSize = wWidth / colsTarget;
    let useNx = Math.max(1, Math.ceil(wWidth / useSize));
    let useNy = Math.max(1, Math.ceil(wHeight / useSize));

    let guard = 0;
    while (useNx * useNy > maxInstances && guard < 48) {
      useSize *= 1.07;
      useNx = Math.max(1, Math.ceil(wWidth / useSize));
      useNy = Math.max(1, Math.ceil(wHeight / useSize));
      guard++;
    }

    while (useNx * useNy > maxInstances && useNy > 1) useNy -= 1;
    while (useNx * useNy > maxInstances && useNx > 1) useNx -= 1;

    useSize = Math.max(wWidth / useNx, wHeight / useNy);

    const icount = useNx * useNy;

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

    const nW = uvScale.current.x * useNx;
    const nH = uvScale.current.y * useNy;

    const originX = -((useNx - 1) * useSize) / 2;
    const originY = -((useNy - 1) * useSize) / 2;

    let index = 0;
    for (let i = 0; i < useNx; i++) {
      for (let j = 0; j < useNy; j++) {
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
    mesh.count = icount;
    if (prev && prev !== geo && prev !== placeholderGeo) prev.dispose();

    const dummy = new THREE.Object3D();
    index = 0;
    for (let i = 0; i < useNx; i++) {
      for (let j = 0; j < useNy; j++) {
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
  ]);

  useFrame(() => {
    const p = getProgress();
    // 0 → bottom-of-frame start · 1 → final rest pose
    // Use intro linearly so GSAP's duration = wall-clock travel (no double-ease squash)
    const intro = getIntroReveal ? getIntroReveal() : 1;
    const travel = intro;
    // Glass visible almost immediately; position still uses full 10s
    const appear = smoothstep(0, 0.04, intro);

    // 0–0.50 assemble (ONLY place pieces rise into full frame / under text area)
    // 0.50–0.64 hold · 0.64–1 exit
    const assemble = smoothstep(0.0, 0.5, p);
    const exit = smoothstep(0.64, 1.0, p);

    const restShatter = (1 - assemble) * 1.25 + exit * 1.55;
    uProgress.current.value = restShatter + (1 - travel) * 0.35;

    const mat = matRef.current;
    if (mat) {
      const shatteredLook = THREE.MathUtils.lerp(0.48, 1, assemble);
      mat.opacity = shatteredLook * (1 - exit * 0.92) * appear;
    }

    if (groupRef.current) {
      /**
       * Intro travel (0→1 over ~15s):
       *   start — bottom of frame (in-view)
       *   end   — final rest parked just BELOW measured copy bottom
       * Scroll assemble → full hero. Exit → CTAs.
       */
      const vh = Math.max(viewport.height, 0.01);

      // 0 top → 1 bottom of stage; default ~mid if measure not ready
      const clearFromTop = getTextClearFromTop
        ? getTextClearFromTop()
        : 0.48;
      // World Y of the clear line (Three: +Y up, 0 = center)
      const clearWorldY = vh * (0.5 - clearFromTop);

      const finalRestScale = 0.62;
      // Visible pile is tighter than full viewport height — don't use 0.5*vh
      // or the rest pose sinks way too low under the copy.
      const pileHalf = finalRestScale * vh * 0.28;
      const pad = vh * 0.004;
      let finalRestY = clearWorldY - pad - pileHalf;
      // Bias upward; allow sitting close under the text band
      finalRestY += vh * 0.06;
      finalRestY = THREE.MathUtils.clamp(finalRestY, -vh * 0.42, -vh * 0.02);

      const startScale = 0.48;
      // First appear (after 3s lock): just barely in the bottom of the frame
      const startY = Math.min(finalRestY - vh * 0.16, -vh * 0.58);

      const introY = THREE.MathUtils.lerp(startY, finalRestY, travel);
      const introScale = THREE.MathUtils.lerp(startScale, finalRestScale, travel);

      const y =
        THREE.MathUtils.lerp(introY, 0.0, assemble) +
        exit * (mobile ? vh * 0.55 : vh * 0.62);
      const z = exit * -0.35;
      const s =
        THREE.MathUtils.lerp(introScale, 1, assemble) *
        (0.98 + assemble * 0.02 - exit * 0.06);

      /**
       * Idle float — only when the travel has settled and user isn't scrolling.
       * Cheap: a few sin()s on the group transform (no extra draws / materials).
       * Amplitude → 0 as soon as assemble/exit starts, so scroll “breaks” it free.
       */
      const settled = smoothstep(0.92, 1, intro);
      const idle =
        settled * appear * (1 - assemble) * (1 - exit);
      const t = performance.now() * 0.001;
      // Slow, small — reads as breath, not bobbing
      const floatY = Math.sin(t * 0.48) * vh * 0.012 * idle;
      const floatX = Math.sin(t * 0.31 + 1.1) * vh * 0.005 * idle;
      const floatRotZ = Math.sin(t * 0.39 + 0.4) * 0.014 * idle;

      groupRef.current.position.set(floatX, y + floatY, z);
      groupRef.current.scale.setScalar(s);
      const hold = assemble * (1 - exit) * appear;
      groupRef.current.rotation.z =
        floatRotZ + Math.sin(t * 0.4) * 0.008 * hold;
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
