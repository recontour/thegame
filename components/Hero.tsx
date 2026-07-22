"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import { LANDING_HERO_SRC } from "@/data/series";
import { useTextureLoader } from "@/components/gallery/useTextureLoader";

type HeroProps = {
  onRevealed?: () => void;
  /** Fired when the first image is on-screen (texture ready + reveal started). */
  onHeroVisible?: () => void;
  onStatus?: (status: string) => void;
};

function fitPlane(
  viewport: { width: number; height: number },
  imageAspect: number,
) {
  const vw = Math.max(viewport.width, 0.01);
  const vh = Math.max(viewport.height, 0.01);
  const viewAspect = vw / vh;
  if (viewAspect > imageAspect) {
    return { w: vh * imageAspect, h: vh };
  }
  return { w: vw, h: vw / imageAspect };
}

/**
 * Landing hero — prioritizes real-device visibility.
 * Uses MeshBasicMaterial (most reliable on mobile GPUs) + opacity/exposure ramp.
 * Dark-red fallback plane sits behind so a missing texture is still obvious.
 */
export default function Hero({
  onRevealed,
  onHeroVisible,
  onStatus,
}: HeroProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const progress = useRef({ value: 0 });
  const pointerTarget = useRef(new THREE.Vector2(0, 0));
  const pointerCurrent = useRef(new THREE.Vector2(0, 0));
  const scrollOffset = useRef(0);
  const revealed = useRef(false);
  const visibleFired = useRef(false);

  const { texture, status, error, log } = useTextureLoader(LANDING_HERO_SRC);
  const { viewport, size, gl } = useThree();

  useEffect(() => {
    const msg =
      status === "error"
        ? `hero:error ${error ?? ""}`
        : `hero:${status} | ${log}`;
    onStatus?.(msg);
    console.log("[Hero]", msg);
  }, [status, error, log, onStatus]);

  // Upload texture to GPU as soon as we have it (avoids black first frames on iOS)
  useEffect(() => {
    if (!texture) return;
    try {
      gl.initTexture(texture);
      console.log("[Hero] initTexture ok");
    } catch (e) {
      console.warn("[Hero] initTexture failed", e);
    }
  }, [texture, gl]);

  const material = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      color: new THREE.Color("#ffffff"),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false,
    });
    return mat;
  }, [texture]);

  useEffect(() => {
    matRef.current = material;
    return () => {
      material.dispose();
    };
  }, [material]);

  useEffect(() => {
    if (material && texture) {
      material.map = texture;
      material.needsUpdate = true;
    }
  }, [material, texture]);

  // Cinematic emerge: opacity + slight brightness. Starts when texture is ready OR on error (fallback only).
  useEffect(() => {
    if (status !== "ready" && status !== "error") return;

    progress.current.value = 0;
    revealed.current = false;

    if (!visibleFired.current && status === "ready") {
      visibleFired.current = true;
      onHeroVisible?.();
      console.log("[Hero] first image ready — starting reveal");
    }

    const tween = gsap.to(progress.current, {
      value: 1,
      duration: status === "error" ? 1.2 : 5.5,
      delay: 0.15,
      ease: "power2.inOut",
      onUpdate: () => {
        const p = progress.current.value;
        const mat = matRef.current;
        if (!mat) return;
        // Soft gate so early frames stay near black, then open up
        const gate = THREE.MathUtils.smoothstep(p, 0, 0.22);
        const body = Math.pow(p, 1.35);
        mat.opacity = Math.min(1, gate * 0.35 + body * 0.95);
        const lift = 0.55 + body * 0.55;
        mat.color.setRGB(lift, lift, lift);
      },
      onComplete: () => {
        if (!revealed.current) {
          revealed.current = true;
          console.log("[Hero] reveal complete");
          onRevealed?.();
        }
      },
    });

    return () => {
      tween.kill();
    };
  }, [status, onRevealed, onHeroVisible]);

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
        scrollOffset.current += (touchY - t.clientY) * 0.0012;
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
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  useFrame((_, delta) => {
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

    if (meshRef.current) {
      meshRef.current.position.x = pointerCurrent.current.x * 0.08;
      meshRef.current.position.y =
        pointerCurrent.current.y * 0.05 + scrollOffset.current * 0.15;
    }
  });

  const ud = texture?.userData as { width?: number; height?: number } | undefined;
  const img = texture?.image as
    | HTMLCanvasElement
    | HTMLImageElement
    | ImageBitmap
    | undefined;
  const tw =
    ud?.width ||
    (img && "width" in img ? Number(img.width) : 0) ||
    0;
  const th =
    ud?.height ||
    (img && "height" in img ? Number(img.height) : 0) ||
    0;
  const imageAspect = tw && th ? tw / th : 3 / 4;

  const vp =
    viewport.width > 0.01 && viewport.height > 0.01
      ? viewport
      : {
          width: Math.max(size.width, 1) / 100,
          height: Math.max(size.height, 1) / 100,
        };

  const { w, h } = fitPlane(vp, imageAspect);
  // Fallback plane slightly larger so it’s always visible around the photo
  const fb = fitPlane(vp, imageAspect);
  const fw = fb.w * 1.02;
  const fh = fb.h * 1.02;

  return (
    <group>
      {/* Bright-enough fallback: proves the mesh/camera work even if texture fails */}
      <mesh position={[0, 0, -0.02]} scale={[fw, fh, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color={status === "error" ? "#6a1515" : "#2a1010"}
          transparent
          opacity={status === "loading" ? 0.85 : 0.55}
          depthWrite={false}
        />
      </mesh>

      {(status === "ready" || status === "error") && (
        <mesh ref={meshRef} scale={[w, h, 1]}>
          <planeGeometry args={[1, 1]} />
          <primitive object={material} attach="material" />
        </mesh>
      )}
    </group>
  );
}
