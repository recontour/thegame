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
  MOON_DISTANCE,
  MOON_MIN_RADIUS,
  MOON_SPRITE_WIDTH,
  MOON_START,
} from "@/components/universe/constants";

const MOON_PNG = "/universe/moon.png";

useLoader.preload(THREE.TextureLoader, MOON_PNG);

type MoonProps = {
  /** In scene (grayed or active) */
  visible: boolean;
  /** After Confirm — draggable */
  interactive: boolean;
  /** Fires when the user drops and the fly-to-correct-position starts */
  onSnapStart?: () => void;
  onSettled?: () => void;
};

const FADE_SPEED = 1.8;
const SNAP_DURATION = 2.0;
const GRAY_OPACITY = 0.38;

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

function MoonSprite({
  opacity,
  grayed,
  onPointerDown,
}: {
  opacity: number;
  grayed: boolean;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const map = useLoader(THREE.TextureLoader, MOON_PNG);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    map.needsUpdate = true;
  }, [map]);

  useFrame(() => {
    if (!matRef.current) return;
    matRef.current.opacity = opacity;
    // Grayed = dim + desaturated look until Confirm
    matRef.current.color.set(grayed ? "#7a7a88" : "#ffffff");
  });

  const img = map.image as { width?: number; height?: number } | undefined;
  const aspect =
    img?.width && img?.height ? img.width / img.height : 1;
  const w = MOON_SPRITE_WIDTH;
  const h = w / aspect;

  return (
    <mesh onPointerDown={onPointerDown}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial
        ref={matRef}
        map={map}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
        color={grayed ? "#7a7a88" : "#ffffff"}
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
}: MoonProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();

  const opacityRef = useRef(0);
  const [opacity, setOpacity] = useState(0);

  const draggingRef = useRef(false);
  const settledRef = useRef(false);
  const snapStartedRef = useRef(false);
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
    // Straight up — correct Moon distance (no orbit ring)
    const to = new THREE.Vector3(0, MOON_DISTANCE, 0);
    snapRef.current = { from, to, t: 0 };
    // Kick camera zoom in the same beat as the moon flight (not after)
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
    const want = visible ? (interactive ? 1 : GRAY_OPACITY) : 0;
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
        onSettled?.();
      }
    } else if (draggingRef.current) {
      displayPos.current.lerp(targetPos.current, 1 - Math.exp(-18 * dt));
    } else {
      displayPos.current.lerp(targetPos.current, 1 - Math.exp(-12 * dt));
    }

    const g = groupRef.current;
    if (g) {
      g.position.copy(displayPos.current);
      g.quaternion.copy(camera.quaternion);
    }
  });

  if (!visible && opacity < 0.01) return null;

  const canGrab = interactive && opacity > 0.2 && !settledRef.current;
  const grayed = visible && !interactive;

  return (
    <group>
      <group ref={groupRef} position={[MOON_START.x, MOON_START.y, MOON_START.z]}>
        <MoonSprite
          opacity={opacity}
          grayed={grayed}
          onPointerDown={canGrab ? onPointerDown : undefined}
        />
        <mesh onPointerDown={canGrab ? onPointerDown : undefined}>
          <circleGeometry args={[0.15, 24]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
