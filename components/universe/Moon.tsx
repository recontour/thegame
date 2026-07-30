"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useFrame,
  useLoader,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import * as THREE from "three";
import {
  EARTH_RADIUS,
  MOON_DISTANCE,
  MOON_MIN_RADIUS,
  MOON_START,
} from "@/components/universe/constants";

/**
 * Slightly larger than true scale (~0.27) for visibility.
 * Relative to Earth unit sphere = 1; our Earth mesh uses EARTH_RADIUS scale.
 */
const MOON_RADIUS = EARTH_RADIUS * 0.32;

/** Local 2K map — public/universe/2k_moon.webp */
const MOON_TEXTURE_URL = "/universe/2k_moon.webp";

useLoader.preload(THREE.TextureLoader, MOON_TEXTURE_URL);

type MoonProps = {
  /** In scene (grayed or active) */
  visible: boolean;
  /** After Confirm — draggable */
  interactive: boolean;
  /** Fires when the user drops and the fly-to-correct-position starts */
  onSnapStart?: () => void;
  /** smartAss = they dropped it absurdly far (past real Moon distance) */
  onSettled?: (info: { smartAss: boolean }) => void;
  /** Grayed moon tapped before Confirm — nudge the user to read the hint */
  onGrayedTap?: () => void;
};

const FADE_SPEED = 1.8;
const SNAP_DURATION = 2.0;
const GRAY_OPACITY = 0.95;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function projectOnPlane(point: THREE.Vector3): THREE.Vector3 {
  point.z = 0;
  const r = Math.hypot(point.x, point.y);
  if (r < MOON_MIN_RADIUS) {
    if (r < 1e-5) {
      point.set(0, MOON_MIN_RADIUS, 0);
    } else {
      const s = MOON_MIN_RADIUS / r;
      point.x *= s;
      point.y *= s;
    }
  }
  return point;
}

/**
 * Textured Moon sphere (three.js sample map).
 */
function MoonSphere({
  opacity,
  grayed,
  onPointerDown,
}: {
  opacity: number;
  grayed: boolean;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const map = useLoader(THREE.TextureLoader, MOON_TEXTURE_URL);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    map.needsUpdate = true;
  }, [map]);

  useFrame(() => {
    // Gentle spin so the sphere reads as 3D
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.002;
    }
    if (!matRef.current) return;
    matRef.current.opacity = opacity;
    matRef.current.transparent = opacity < 0.99;
    matRef.current.depthWrite = opacity > 0.95;
    // Grayed: keep muted. Confirmed: brighter map response + soft fill
    if (grayed) {
      matRef.current.color.set("#8a8a90");
      matRef.current.emissive.set("#000000");
      matRef.current.emissiveIntensity = 0;
      matRef.current.roughness = 0.95;
    } else {
      matRef.current.color.set("#e8e8ec");
      matRef.current.emissive.set("#3a3a42");
      matRef.current.emissiveIntensity = 0.22;
      matRef.current.roughness = 0.88;
    }
  });

  return (
    <mesh ref={meshRef} onPointerDown={onPointerDown}>
      <sphereGeometry args={[MOON_RADIUS, 32, 32]} />
      <meshStandardMaterial
        ref={matRef}
        map={map}
        color="#e8e8ec"
        roughness={0.88}
        metalness={0.02}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}

/**
 * Moon placement beat — grayed until Confirm, then free drag,
 * snap straight up to the lesson Moon distance (no orbit ring).
 */
export default function Moon({
  visible,
  interactive,
  onSnapStart,
  onSettled,
  onGrayedTap,
}: MoonProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();

  const opacityRef = useRef(0);
  const [opacity, setOpacity] = useState(0);

  const draggingRef = useRef(false);
  const settledRef = useRef(false);
  const snapStartedRef = useRef(false);
  const floatTRef = useRef(0);
  const smartAssRef = useRef(false);
  const snapRef = useRef<{
    from: THREE.Vector3;
    to: THREE.Vector3;
    t: number;
  } | null>(null);

  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const targetPos = useRef(
    new THREE.Vector3(MOON_START.x, MOON_START.y, MOON_START.z),
  );
  const displayPos = useRef(
    new THREE.Vector3(MOON_START.x, MOON_START.y, MOON_START.z),
  );

  const projectPointer = useCallback(
    (clientX: number, clientY: number) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(plane, hit)) return null;
      const local = hit.clone();
      const parent = groupRef.current?.parent;
      if (parent) parent.worldToLocal(local);
      return projectOnPlane(local);
    },
    [camera, gl.domElement, hit, ndc, plane, raycaster],
  );

  const endDrag = useCallback(() => {
    if (!draggingRef.current || settledRef.current) return;
    draggingRef.current = false;

    const from = displayPos.current.clone();
    const to = new THREE.Vector3(0, MOON_DISTANCE, 0);
    // Dropped farther out than the real teaching distance → Mars line
    smartAssRef.current = from.length() > MOON_DISTANCE * 1.05;
    snapRef.current = { from, to, t: 0 };
    if (!snapStartedRef.current) {
      snapStartedRef.current = true;
      onSnapStart?.();
    }
  }, [onSnapStart]);

  useEffect(() => {
    if (!interactive) return;
    const el = gl.domElement;

    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current || settledRef.current) return;
      const p = projectPointer(e.clientX, e.clientY);
      if (p) targetPos.current.copy(p);
    };

    const onUp = () => {
      if (draggingRef.current) endDrag();
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [endDrag, gl.domElement, interactive, projectPointer]);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    // Still grayed — soft nudge toward Confirm, don’t drag
    if (visible && !interactive) {
      e.stopPropagation();
      onGrayedTap?.();
      return;
    }
    if (
      !interactive ||
      settledRef.current ||
      snapRef.current ||
      opacityRef.current < 0.2
    ) {
      return;
    }
    e.stopPropagation();
    e.nativeEvent.preventDefault?.();
    draggingRef.current = true;
    (e.target as Element | undefined)?.setPointerCapture?.(e.pointerId);
    const p = projectPointer(e.nativeEvent.clientX, e.nativeEvent.clientY);
    if (p) targetPos.current.copy(p);
  };

  useFrame((_, dt) => {
    const want = visible
      ? settledRef.current || interactive
        ? 1
        : GRAY_OPACITY
      : 0;
    if (Math.abs(opacityRef.current - want) > 0.001) {
      opacityRef.current = THREE.MathUtils.damp(
        opacityRef.current,
        want,
        FADE_SPEED,
        dt,
      );
      setOpacity(opacityRef.current);
    }

    const snap = snapRef.current;
    if (snap) {
      snap.t = Math.min(1, snap.t + dt / SNAP_DURATION);
      const u = easeInOutCubic(snap.t);
      displayPos.current.lerpVectors(snap.from, snap.to, u);
      targetPos.current.copy(displayPos.current);

      if (snap.t >= 1 && !settledRef.current) {
        settledRef.current = true;
        snapRef.current = null;
        onSettled?.({ smartAss: smartAssRef.current });
      }
    } else if (draggingRef.current) {
      displayPos.current.lerp(targetPos.current, 1 - Math.exp(-18 * dt));
    } else {
      displayPos.current.lerp(targetPos.current, 1 - Math.exp(-12 * dt));
    }

    // Float only after Confirm — while waiting to be dragged
    const idleFloat =
      interactive &&
      !draggingRef.current &&
      !snapRef.current &&
      !settledRef.current;
    if (idleFloat) {
      floatTRef.current += dt;
    }
    const bob = idleFloat
      ? Math.sin(floatTRef.current * 1.15) * 0.032
      : 0;

    const g = groupRef.current;
    if (g) {
      g.position.set(
        displayPos.current.x,
        displayPos.current.y + bob,
        displayPos.current.z,
      );
    }
  });

  if (!visible && opacity < 0.01) return null;

  const canTap =
    (interactive && opacity > 0.2 && !settledRef.current) ||
    (visible && !interactive && !settledRef.current && opacity > 0.2);
  const grayed = visible && !interactive && !settledRef.current;

  return (
    <group>
      <group ref={groupRef} position={[MOON_START.x, MOON_START.y, MOON_START.z]}>
        <MoonSphere
          opacity={opacity}
          grayed={grayed}
          onPointerDown={canTap ? onPointerDown : undefined}
        />
      </group>
    </group>
  );
}
