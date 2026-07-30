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
  SUN_DISTANCE,
  SUN_MIN_RADIUS,
  SUN_RADIUS,
  SUN_START,
  ZOOM_Z_SUN_MIN,
} from "@/components/universe/constants";

/** Local asset — solar system style 2K map */
const SUN_TEXTURE_URL = "/universe/2k_sun.jpg";

useLoader.preload(THREE.TextureLoader, SUN_TEXTURE_URL);

type SunProps = {
  /** In scene (grayed or active) */
  visible: boolean;
  /** After Confirm — draggable */
  interactive: boolean;
  /**
   * Camera Z during grayed park/zoom. Sun world-Y scales with this so the
   * disc holds screen position while shrinking (Home→Sun gap grows).
   */
  parkCameraZ?: number;
  /** Fires when the user drops and the fly-to-true-AU starts */
  onSnapStart?: () => void;
  /** smartAss = they dropped it absurdly far past 1 AU */
  onSettled?: (info: { smartAss: boolean }) => void;
  /** Grayed sun tapped before Confirm — nudge toward Confirm */
  onGrayedTap?: () => void;
};

const FADE_SPEED = 1.8;
const SNAP_DURATION = 2.2;
const GRAY_OPACITY = 0.92;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function projectOnPlane(point: THREE.Vector3): THREE.Vector3 {
  point.z = 0;
  const r = Math.hypot(point.x, point.y);
  if (r < SUN_MIN_RADIUS) {
    if (r < 1e-5) {
      point.set(0, SUN_MIN_RADIUS, 0);
    } else {
      const s = SUN_MIN_RADIUS / r;
      point.x *= s;
      point.y *= s;
    }
  }
  return point;
}

/**
 * Textured emissive Sun sphere — map from public/universe/2k_sun.jpg.
 * Pointer hits go through a separate scaled hit shell (easier when zoomed out).
 */
function SunSphere({
  opacity,
  grayed,
}: {
  opacity: number;
  grayed: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const map = useLoader(THREE.TextureLoader, SUN_TEXTURE_URL);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  useEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    map.needsUpdate = true;
  }, [map]);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.0015;
    }
    if (!matRef.current) return;
    matRef.current.opacity = opacity;
    matRef.current.transparent = opacity < 0.99;
    matRef.current.depthWrite = opacity > 0.95;

    if (grayed) {
      matRef.current.color.set("#9a8a70");
      matRef.current.emissive.set("#4a3a20");
      matRef.current.emissiveIntensity = 0.35;
      matRef.current.roughness = 1;
      if (lightRef.current) lightRef.current.intensity = 0.35;
    } else {
      matRef.current.color.set("#ffffff");
      matRef.current.emissive.set("#ffaa33");
      matRef.current.emissiveIntensity = 1.4;
      matRef.current.roughness = 1;
      if (lightRef.current) lightRef.current.intensity = 1.8;
    }
  });

  return (
    <mesh ref={meshRef} renderOrder={1}>
      <sphereGeometry args={[SUN_RADIUS, 48, 48]} />
      <meshStandardMaterial
        ref={matRef}
        map={map}
        emissiveMap={map}
        emissive="#ffaa33"
        emissiveIntensity={1.4}
        roughness={1}
        metalness={0}
        transparent
        opacity={opacity}
        depthTest
        depthWrite
      />
      {/* Soft local glow around the display Sun */}
      <pointLight
        ref={lightRef}
        color="#ffcc66"
        intensity={1.6}
        distance={SUN_RADIUS * 10}
        decay={2}
      />
    </mesh>
  );
}

/**
 * Invisible grab shell — grows a little as the camera pulls back so the
 * visual disc can be tiny without becoming un-tappable.
 * (Capped — only a modest pad, not a huge magnet.)
 */
function sunHitRadius(cameraZ: number): number {
  const zoomRatio = Math.max(1, cameraZ / ZOOM_Z_SUN_MIN);
  // 1.12× at start → ~1.75× when fully zoomed (gentle, not wild)
  const scale = THREE.MathUtils.clamp(1.12 + (zoomRatio - 1) * 0.12, 1.12, 1.75);
  return SUN_RADIUS * scale;
}

/**
 * Sun placement beat — grayed until Confirm, then free drag,
 * snap straight up to true 1 AU (no orbit ring).
 */
export default function Sun({
  visible,
  interactive,
  parkCameraZ = ZOOM_Z_SUN_MIN,
  onSnapStart,
  onSettled,
  onGrayedTap,
}: SunProps) {
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
  /** Last grayed park Y — hand off to drag from here after Confirm */
  const parkYRef = useRef<number>(SUN_START.y);
  /** Invisible grab shell — scales up modestly with zoom */
  const hitMeshRef = useRef<THREE.Mesh>(null);

  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const targetPos = useRef(
    new THREE.Vector3(SUN_START.x, SUN_START.y, SUN_START.z),
  );
  const displayPos = useRef(
    new THREE.Vector3(SUN_START.x, SUN_START.y, SUN_START.z),
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
    const to = new THREE.Vector3(0, SUN_DISTANCE, 0);
    // Dropped way past true 1 AU → roast line
    smartAssRef.current = from.length() > SUN_DISTANCE * 1.05;
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

    /*
     * Grayed zoom phase: keep the Sun fixed on screen while the camera
     * pulls back. y ∝ cameraZ ⇒ same elevation angle, bigger Home gap,
     * smaller disc. After Confirm we stop updating park and let them drag.
     */
    if (
      visible &&
      !interactive &&
      !settledRef.current &&
      !snapRef.current &&
      !draggingRef.current
    ) {
      const z = Math.max(parkCameraZ, ZOOM_Z_SUN_MIN * 0.5);
      const parkY = SUN_START.y * (z / ZOOM_Z_SUN_MIN);
      parkYRef.current = parkY;
      targetPos.current.set(0, parkY, 0);
      // Track zoom tightly so it doesn’t lag behind each click
      displayPos.current.lerp(targetPos.current, 1 - Math.exp(-22 * dt));
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
    } else if (interactive && !settledRef.current) {
      displayPos.current.lerp(targetPos.current, 1 - Math.exp(-12 * dt));
    }

    const idleFloat =
      interactive &&
      !draggingRef.current &&
      !snapRef.current &&
      !settledRef.current;
    if (idleFloat) {
      floatTRef.current += dt;
    }
    const bob = idleFloat
      ? Math.sin(floatTRef.current * 1.05) * 0.028
      : 0;

    const g = groupRef.current;
    if (g) {
      g.position.set(
        displayPos.current.x,
        displayPos.current.y + bob,
        displayPos.current.z,
      );
    }

    // Grow hit shell with zoom so a shrunken disc stays grabable
    const hit = hitMeshRef.current;
    if (hit) {
      const r = sunHitRadius(parkCameraZ);
      hit.scale.setScalar(r);
    }
  });

  if (!visible && opacity < 0.01) return null;

  const canTap =
    (interactive && opacity > 0.2 && !settledRef.current) ||
    (visible && !interactive && opacity > 0.2);
  const grayed = visible && !interactive;

  return (
    <group>
      <group ref={groupRef} position={[SUN_START.x, SUN_START.y, SUN_START.z]}>
        <SunSphere opacity={opacity} grayed={grayed} />
        {/* Unit sphere scaled in useFrame — invisible grab target */}
        <mesh
          ref={hitMeshRef}
          onPointerDown={canTap ? onPointerDown : undefined}
          renderOrder={2}
        >
          <sphereGeometry args={[1, 16, 16]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            depthTest
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
