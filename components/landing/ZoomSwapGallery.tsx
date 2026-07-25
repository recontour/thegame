"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  getMobileDpr,
  isMobileDevice,
  loadMobileSafeTexture,
  getMobileMaxTextureSize,
} from "@/components/gallery/loadMobileSafeTexture";
import { LANDING_SWAP_PHOTOS } from "@/data/landingPhotos";
import WebGLErrorBoundary from "@/components/WebGLErrorBoundary";

/**
 * Dual-plane zoom-blur image swap (from sample.tsx).
 * Only 2 meshes; textures swapped as progress crosses integers.
 * Mobile: fewer blur samples so transitions stay cheap.
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

type ZoomPlaneProps = {
  texture: THREE.Texture | null;
  getStrength: () => number;
  center: THREE.Vector2;
  samples: number;
};

function ZoomPlane({ texture, getStrength, center, samples }: ZoomPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();

  const uniforms = useMemo(
    () => ({
      map: { value: texture as THREE.Texture | null },
      center: { value: new THREE.Vector2(0.5, 0.5) },
      strength: { value: 0 },
      uvOffset: { value: new THREE.Vector2(0, 0) },
      uvScale: { value: new THREE.Vector2(1, 1) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      uniforms,
      vertexShader,
      fragmentShader: makeFragmentShader(samples),
    });
  }, [uniforms, samples]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  useEffect(() => {
    uniforms.map.value = texture;
    material.needsUpdate = true;
    if (!texture?.image) return;

    const img = texture.image as { width?: number; height?: number };
    const iW = img.width || 1;
    const iH = img.height || 1;
    const iRatio = iW / iH;
    const vRatio = viewport.width / Math.max(viewport.height, 0.01);
    const uvOffset = uniforms.uvOffset.value;
    const uvScale = uniforms.uvScale.value;
    uvOffset.set(0, 0);
    uvScale.set(1, 1);
    if (iRatio > vRatio) {
      uvScale.x = vRatio / iRatio;
      uvOffset.x = (1 - uvScale.x) / 2;
    } else {
      uvScale.y = iRatio / vRatio;
      uvOffset.y = (1 - uvScale.y) / 2;
    }
  }, [texture, viewport.width, viewport.height, uniforms, material]);

  useFrame(() => {
    uniforms.strength.value = getStrength();
    uniforms.center.value.copy(center);
  });

  if (!texture) return null;

  return (
    <mesh
      ref={meshRef}
      scale={[viewport.width, viewport.height, 1]}
      material={material}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function SwapScene({
  textures,
  samples,
}: {
  textures: THREE.Texture[];
  samples: number;
}) {
  const progress = useRef(0);
  const target = useRef(0);
  const center = useRef(new THREE.Vector2(0.5, 0.5));
  const mouse = useRef(new THREE.Vector2(0.5, 0.5));
  const strength1 = useRef(0);
  const strength2 = useRef(-1);
  const pairRef = useRef({ a: 0, b: 1 });
  const [pair, setPair] = useState({ a: 0, b: 1 });
  const n = textures.length;

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      target.current += e.deltaY > 0 ? 1 / 18 : -1 / 18;
    };
    const onPointer = (e: PointerEvent) => {
      mouse.current.set(
        e.clientX / window.innerWidth,
        1 - e.clientY / window.innerHeight,
      );
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        target.current = Math.ceil(target.current + 0.001);
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        target.current = Math.floor(target.current - 0.001);
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useFrame((_, dt) => {
    if (target.current < 0) {
      progress.current += n;
      target.current += n;
    }

    const next = lerp(progress.current, target.current, 1 - Math.exp(-6 * dt));
    const pdiff = next - progress.current;
    if (pdiff !== 0) {
      const p0 = ((progress.current % 1) + 1) % 1;
      const p1 = ((next % 1) + 1) % 1;
      if ((pdiff > 0 && p1 < p0) || (pdiff < 0 && p0 < p1)) {
        const i = ((Math.floor(next) % n) + n) % n;
        const j = (i + 1) % n;
        pairRef.current = { a: i, b: j };
        setPair({ a: i, b: j });
      }
      progress.current = next;
    }

    const frac = ((progress.current % 1) + 1) % 1;
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

type ZoomSwapGalleryProps = {
  srcs?: readonly string[];
};

/**
 * Full-screen zoom-blur swap gallery. Use after /resize has produced ready/*.webp.
 */
export default function ZoomSwapGallery({
  srcs = LANDING_SWAP_PHOTOS,
}: ZoomSwapGalleryProps) {
  const mobile = useMemo(() => isMobileDevice(), []);
  const dpr = useMemo(() => getMobileDpr(), []);
  const samples = mobile ? 10 : 16;
  const [textures, setTextures] = useState<THREE.Texture[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const maxSize = getMobileMaxTextureSize();

    Promise.all(
      srcs.map((src) =>
        loadMobileSafeTexture(src, { maxSize }).catch((e) => {
          console.warn("[ZoomSwapGallery] failed", src, e);
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
      if (ok.length < 2) {
        setError("Need at least 2 images in /landing/ready (run /resize).");
        return;
      }
      setTextures(ok);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [srcs]);

  useEffect(() => {
    return () => {
      textures.forEach((t) => t.dispose());
    };
  }, [textures]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
      }}
    >
      {error && (
        <p
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.5)",
            fontFamily:
              'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
            fontSize: "0.85rem",
            padding: "1.5rem",
            textAlign: "center",
            zIndex: 2,
          }}
        >
          {error}
        </p>
      )}
      {ready && textures.length >= 2 && (
        <WebGLErrorBoundary onError={(m) => setError(m)}>
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
            <SwapScene textures={textures} samples={samples} />
          </Canvas>
        </WebGLErrorBoundary>
      )}
    </div>
  );
}
