"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  getMobileDpr,
  getMobileMaxTextureSize,
  isMobileDevice,
  loadMobileSafeTexture,
} from "@/components/gallery/loadMobileSafeTexture";
import WebGLErrorBoundary from "@/components/WebGLErrorBoundary";

/**
 * Controlled dual-plane zoom-blur swap for 9:16 landing slides.
 * Parent owns target slide index (0…n-1); this lerps for the blur.
 */

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

function makeFragmentShader(samples: number) {
  return /* glsl */ `
uniform sampler2D map;
uniform vec2 center;
uniform float strength;
uniform vec2 uvOffset;
uniform vec2 uvScale;
varying vec2 vUv;

float random(vec3 scale, float seed) {
  return fract(sin(dot(gl_FragCoord.xyz + seed, scale)) * 43758.5453 + seed);
}

void main() {
  vec2 tUv = vUv * uvScale + uvOffset;
  if (abs(strength) > 0.001) {
    vec4 color = vec4(0.0);
    float total = 0.0;
    vec2 toCenter = center * uvScale + uvOffset - tUv;
    float offset = random(vec3(12.9898, 78.233, 151.7182), 0.0);
    const float SAMPLES = ${samples.toFixed(1)};

    for (float t = 0.0; t <= SAMPLES; t++) {
      float percent = (t + offset) / SAMPLES;
      float weight = 2.0 * (percent - percent * percent);
      vec4 texel = texture2D(map, tUv + toCenter * percent * strength);
      texel.rgb *= texel.a;
      color += texel * weight;
      total += weight;
    }

    gl_FragColor = color / total;
    gl_FragColor.rgb /= gl_FragColor.a + 0.00001;
    gl_FragColor.a = 1.0 - abs(strength);
  } else {
    gl_FragColor = texture2D(map, tUv);
  }
}
`;
}

/** object-fit: cover for 9:16 photos on the portrait stage */
function setCoverUV(
  uvScale: THREE.Vector2,
  uvOffset: THREE.Vector2,
  imageAspect: number,
  viewAspect: number,
) {
  const ratio = viewAspect / imageAspect;
  if (ratio > 1) {
    uvScale.set(1, 1 / ratio);
    uvOffset.set(0, (1 - uvScale.y) / 2);
  } else {
    uvScale.set(ratio, 1);
    uvOffset.set((1 - uvScale.x) / 2, 0);
  }
}

type ZoomPlaneProps = {
  texture: THREE.Texture | null;
  getStrength: () => number;
  center: THREE.Vector2;
  samples: number;
};

function ZoomPlane({ texture, getStrength, center, samples }: ZoomPlaneProps) {
  const { viewport } = useThree();
  const uniforms = useMemo(
    () => ({
      map: { value: null as THREE.Texture | null },
      center: { value: new THREE.Vector2(0.5, 0.5) },
      strength: { value: 0 },
      uvOffset: { value: new THREE.Vector2(0, 0) },
      uvScale: { value: new THREE.Vector2(1, 1) },
    }),
    [],
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        uniforms,
        vertexShader,
        fragmentShader: makeFragmentShader(samples),
      }),
    [uniforms, samples],
  );

  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    uniforms.map.value = texture;
    material.needsUpdate = true;
    if (!texture?.image) return;
    const img = texture.image as { width?: number; height?: number };
    const iW = Number(img.width) || 9;
    const iH = Number(img.height) || 16;
    const viewAspect = viewport.width / Math.max(viewport.height, 0.01);
    setCoverUV(
      uniforms.uvScale.value,
      uniforms.uvOffset.value,
      iW / iH,
      viewAspect,
    );
  }, [texture, viewport.width, viewport.height, uniforms, material]);

  useFrame(() => {
    uniforms.strength.value = getStrength();
    uniforms.center.value.copy(center);
  });

  if (!texture) return null;

  return (
    <mesh scale={[viewport.width, viewport.height, 1]} material={material}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

function StoryScene({
  textures,
  getTargetSlide,
  samples,
}: {
  textures: THREE.Texture[];
  getTargetSlide: () => number;
  samples: number;
}) {
  const progress = useRef(0);
  const center = useRef(new THREE.Vector2(0.5, 0.5));
  const mouse = useRef(new THREE.Vector2(0.5, 0.5));
  const strength1 = useRef(0);
  const strength2 = useRef(-1);
  const [pair, setPair] = useState({ a: 0, b: Math.min(1, textures.length - 1) });
  const pairRef = useRef(pair);
  const n = textures.length;

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      mouse.current.set(
        e.clientX / Math.max(window.innerWidth, 1),
        1 - e.clientY / Math.max(window.innerHeight, 1),
      );
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => window.removeEventListener("pointermove", onPointer);
  }, []);

  useFrame((_, dt) => {
    const target = THREE.MathUtils.clamp(
      getTargetSlide(),
      0,
      Math.max(0, n - 1),
    );
    const next = THREE.MathUtils.damp(progress.current, target, 5.5, dt);
    progress.current = next;

    const i = Math.min(n - 1, Math.max(0, Math.floor(next + 1e-4)));
    const j = Math.min(n - 1, i + 1);
    if (pairRef.current.a !== i || pairRef.current.b !== j) {
      pairRef.current = { a: i, b: j };
      setPair({ a: i, b: j });
    }

    const frac = THREE.MathUtils.clamp(next - i, 0, 1);
    strength1.current = frac;
    strength2.current = -1 + frac;
    center.current.lerp(mouse.current, 1 - Math.exp(-5 * dt));
  });

  return (
    <>
      <ZoomPlane
        texture={textures[pair.a] ?? null}
        getStrength={() => strength1.current}
        center={center.current}
        samples={samples}
      />
      <ZoomPlane
        texture={textures[pair.b] ?? null}
        getStrength={() => strength2.current}
        center={center.current}
        samples={samples}
      />
    </>
  );
}

export type StorySwapCanvasProps = {
  srcs: readonly string[];
  /** Live target slide index (0…n-1). */
  getTargetSlide: () => number;
  onReady?: () => void;
  onError?: (message: string) => void;
};

export default function StorySwapCanvas({
  srcs,
  getTargetSlide,
  onReady,
  onError,
}: StorySwapCanvasProps) {
  const mobile = useMemo(() => isMobileDevice(), []);
  const dpr = useMemo(() => getMobileDpr(), []);
  const samples = mobile ? 10 : 16;
  const [textures, setTextures] = useState<THREE.Texture[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const maxSize = getMobileMaxTextureSize();

    Promise.all(
      srcs.map((src) =>
        loadMobileSafeTexture(src, { maxSize }).catch((e) => {
          console.warn("[StorySwapCanvas]", src, e);
          return null;
        }),
      ),
    ).then((list) => {
      if (cancelled) {
        list.forEach((t) => t?.dispose());
        return;
      }
      const ok = list.filter(Boolean) as THREE.Texture[];
      ok.forEach((t) => {
        t.colorSpace = THREE.NoColorSpace;
      });
      if (ok.length < 1) {
        onError?.("Failed to load landing images.");
        return;
      }
      setTextures(ok);
      setReady(true);
      onReady?.();
    });

    return () => {
      cancelled = true;
    };
  }, [srcs, onReady, onError]);

  useEffect(() => {
    return () => {
      textures.forEach((t) => t.dispose());
    };
  }, [textures]);

  if (!ready || textures.length < 1) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#000",
        }}
      />
    );
  }

  return (
    <WebGLErrorBoundary onError={onError}>
      <Canvas
        style={{ position: "absolute", inset: 0 }}
        dpr={dpr}
        gl={{
          antialias: !mobile,
          alpha: false,
          powerPreference: "default",
          stencil: false,
          depth: false,
        }}
        camera={{ position: [0, 0, 5], fov: 50, near: 0.1, far: 50 }}
        onCreated={({ gl }) => gl.setClearColor("#000000", 1)}
      >
        <color attach="background" args={["#000000"]} />
        <StoryScene
          textures={textures}
          getTargetSlide={getTargetSlide}
          samples={samples}
        />
      </Canvas>
    </WebGLErrorBoundary>
  );
}
