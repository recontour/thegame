"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { LANDING_HERO_SRC } from "@/data/series";
import { useTextureLoader } from "@/components/gallery/useTextureLoader";

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;

  uniform sampler2D uTexture;
  uniform float uProgress;
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uHasTexture;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 uv = vUv;
    uv += uPointer * 0.028 * smoothstep(0.05, 0.4, uProgress);

    float mid = sin(uProgress * 3.14159265);
    float living = 0.35 + 0.65 * mid;
    float n1 = noise(uv * 3.2 + uTime * 0.12);
    float n2 = noise(uv * 6.5 - uTime * 0.08 + 12.0);
    vec2 warp = vec2(
      sin(uv.y * 9.0 + uTime * 0.35 + n1 * 2.0),
      cos(uv.x * 7.0 - uTime * 0.28 + n2 * 2.0)
    );
    uv += warp * 0.01 * living;
    uv += uPointer.yx * vec2(-1.0, 1.0) * 0.012 * living;

    vec3 tex;
    if (uHasTexture > 0.5) {
      vec2 leakShift = vec2(n1 - 0.5, n2 - 0.5) * 0.006 * mid;
      float r = texture2D(uTexture, uv + leakShift * 1.4).r;
      float g = texture2D(uTexture, uv).g;
      float b = texture2D(uTexture, uv - leakShift * 0.9).b;
      tex = vec3(r, g, b);
    } else {
      // Visible fallback so a failed texture still proves the canvas is alive
      tex = vec3(0.12, 0.12, 0.14) + vec3(0.08) * vUv.y;
    }

    float reveal = smoothstep(0.0, 1.0, uProgress);
    float exposure = pow(reveal, 1.55) * 1.08;
    float gate = smoothstep(0.0, 0.22, reveal);
    vec3 col = tex * exposure * gate;

    float edge = length(vUv - 0.5);
    float leakMask = smoothstep(0.15, 0.92, edge);
    float leakPulse = 0.65 + 0.35 * sin(uTime * 0.45 + edge * 5.0 + n1 * 3.0);
    float leak = leakMask * reveal * mid * leakPulse * 0.22;
    col += vec3(1.0, 0.52, 0.28) * leak;

    float vig = mix(0.35, 1.0, reveal);
    vig *= 1.0 - smoothstep(0.4, 1.15, edge) * (0.85 - reveal * 0.35);
    col *= vig;

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      col = vec3(0.0);
    }

    float grain = (hash(vUv * 800.0 + uTime * 0.5) - 0.5) * 0.035 * reveal;
    col += grain;

    gl_FragColor = vec4(col, 1.0);
  }
`;

type HeroProps = {
  onRevealed?: () => void;
  onStatus?: (status: string) => void;
};

function fitPlane(
  viewport: { width: number; height: number },
  imageAspect: number,
) {
  // Guard against 0-size canvas during first mobile layout pass
  const vw = Math.max(viewport.width, 0.01);
  const vh = Math.max(viewport.height, 0.01);
  const viewAspect = vw / vh;
  if (viewAspect > imageAspect) {
    return { w: vh * imageAspect, h: vh };
  }
  return { w: vw, h: vw / imageAspect };
}

export default function Hero({ onRevealed, onStatus }: HeroProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const progress = useRef({ value: 0 });
  const pointerTarget = useRef(new THREE.Vector2(0, 0));
  const pointerCurrent = useRef(new THREE.Vector2(0, 0));
  const scrollOffset = useRef(0);
  const revealed = useRef(false);

  const { texture, status, error } = useTextureLoader(LANDING_HERO_SRC);
  const { viewport, size } = useThree();

  useEffect(() => {
    onStatus?.(
      status === "error"
        ? `hero:error ${error ?? ""}`
        : `hero:${status}${texture ? " tex-ok" : ""}`,
    );
  }, [status, error, texture, onStatus]);

  const material = useMemo(() => {
    const map =
      texture ??
      (() => {
        // 1x1 dark placeholder so shader always has a sampler
        const data = new Uint8Array([8, 8, 10, 255]);
        const t = new THREE.DataTexture(data, 1, 1);
        t.needsUpdate = true;
        return t;
      })();

    return new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: map },
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uPointer: { value: new THREE.Vector2(0, 0) },
        uHasTexture: { value: texture ? 1 : 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: false,
      depthWrite: false,
    });
  }, [texture]);

  useEffect(() => {
    materialRef.current = material;
    return () => {
      material.dispose();
    };
  }, [material]);

  // Start cinematic emerge as soon as texture is ready (or after error fallback).
  // Does not depend on pointer/touch — must restart cleanly after Strict Mode remount.
  useEffect(() => {
    if (status !== "ready" && status !== "error") return;

    progress.current.value = 0;
    revealed.current = false;

    const tween = gsap.to(progress.current, {
      value: 1,
      duration: 5.5,
      delay: 0.2,
      ease: "power2.inOut",
      onUpdate: () => {
        if (materialRef.current) {
          materialRef.current.uniforms.uProgress.value = progress.current.value;
        }
      },
      onComplete: () => {
        if (!revealed.current) {
          revealed.current = true;
          onRevealed?.();
        }
      },
    });

    return () => {
      tween.kill();
    };
  }, [status, onRevealed]);

  // Pointer + touch parallax (pointer events work on modern mobile; touch as backup)
  useEffect(() => {
    const setFromClient = (clientX: number, clientY: number) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const x = (clientX / w) * 2 - 1;
      const y = (clientY / h) * 2 - 1;
      pointerTarget.current.set(x * 0.55, -y * 0.55);
    };

    const onPointerMove = (e: PointerEvent) => {
      setFromClient(e.clientX, e.clientY);
    };

    const onPointerDown = (e: PointerEvent) => {
      setFromClient(e.clientX, e.clientY);
    };

    const onPointerUp = () => {
      pointerTarget.current.set(0, 0);
    };

    const onWheel = (e: WheelEvent) => {
      scrollOffset.current += e.deltaY * 0.00035;
      scrollOffset.current = THREE.MathUtils.clamp(
        scrollOffset.current,
        -0.35,
        0.35,
      );
    };

    let touchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      touchY = t.clientY;
      setFromClient(t.clientX, t.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (touchY != null) {
        const dy = touchY - t.clientY;
        scrollOffset.current += dy * 0.0012;
        scrollOffset.current = THREE.MathUtils.clamp(
          scrollOffset.current,
          -0.35,
          0.35,
        );
        touchY = t.clientY;
      }
      setFromClient(t.clientX, t.clientY);
    };
    const onTouchEnd = () => {
      touchY = null;
      pointerTarget.current.set(0, 0);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  useFrame((_, delta) => {
    const mat = materialRef.current;
    if (!mat) return;

    mat.uniforms.uTime.value += delta;
    mat.uniforms.uHasTexture.value = texture ? 1 : 0;
    if (texture) {
      mat.uniforms.uTexture.value = texture;
    }
    // Keep progress in sync even if gsap onUpdate missed a frame
    mat.uniforms.uProgress.value = progress.current.value;

    pointerCurrent.current.lerp(
      pointerTarget.current,
      1 - Math.exp(-4 * delta),
    );
    scrollOffset.current = THREE.MathUtils.damp(
      scrollOffset.current,
      0,
      1.2,
      delta,
    );

    mat.uniforms.uPointer.value.set(
      pointerCurrent.current.x,
      pointerCurrent.current.y + scrollOffset.current,
    );

    if (meshRef.current) {
      meshRef.current.position.x = pointerCurrent.current.x * 0.08;
      meshRef.current.position.y =
        pointerCurrent.current.y * 0.05 + scrollOffset.current * 0.15;
    }
  });

  const img = texture?.image as HTMLImageElement | ImageBitmap | undefined;
  const imageAspect =
    img && "width" in img && img.width && img.height
      ? img.width / img.height
      : 3 / 4;

  // Prefer measured canvas size if R3F viewport is still 0 on first mobile layout
  const vp =
    viewport.width > 0.01 && viewport.height > 0.01
      ? viewport
      : {
          width: Math.max(size.width, 1) / 100,
          height: Math.max(size.height, 1) / 100,
        };

  const { w, h } = fitPlane(vp, imageAspect);

  // While texture loads, show a dim full-frame plane so mobile isn't pure black
  const loading = status === "loading" || status === "idle";

  return (
    <group>
      {loading && (
        <mesh scale={[Math.max(vp.width, 1), Math.max(vp.height * 0.5, 0.5), 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="#0a0a0a" />
        </mesh>
      )}

      {(status === "ready" || status === "error") && (
        <mesh ref={meshRef} scale={[w, h, 1]}>
          <planeGeometry args={[1, 1, 1, 1]} />
          <primitive object={material} attach="material" />
        </mesh>
      )}
    </group>
  );
}
