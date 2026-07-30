"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import {
  GPS_ORBIT_RADIUS,
  SAT_MIN_RADIUS,
  SAT_START,
} from "@/components/universe/constants";

const SATELLITE_PNG = "/universe/satellite.png";
/** World size of the PNG billboard (width) */
const SAT_SPRITE_WIDTH = 0.16;

// Warm the cache on module load so the welcome→sat handoff never suspends Earth
useLoader.preload(THREE.TextureLoader, SATELLITE_PNG);

type SatelliteProps = {
  /** When true, satellite fades in and becomes interactive */
  active: boolean;
  /** Fired once after user releases and snap-to-GPS finishes */
  onSettled?: () => void;
};

const FADE_SPEED = 1.6;
/** Calm fly-to-orbit after drop */
const SNAP_DURATION = 1.9;

/** Smooth ease-in-out (cubic) */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Free placement on the camera-facing plane.
 * Only soft floor: stay outside Earth. No outer orbit rail.
 */
function projectOnPlane(point: THREE.Vector3): THREE.Vector3 {
  point.z = 0;
  const r = Math.hypot(point.x, point.y);
  if (r < SAT_MIN_RADIUS) {
    if (r < 1e-5) {
      point.set(SAT_MIN_RADIUS, 0, 0);
    } else {
      const s = SAT_MIN_RADIUS / r;
      point.x *= s;
      point.y *= s;
    }
  }
  return point;
}

/**
 * PNG satellite billboard (faces camera via parent quaternion).
 * Optional soft shimmer when the user hasn’t dragged yet.
 */
function SatelliteSprite({
  opacity,
  shimmer,
  onPointerDown,
}: {
  opacity: number;
  /** 0–1 how strong the “you can drag me” shimmer is */
  shimmer: number;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const map = useLoader(THREE.TextureLoader, SATELLITE_PNG);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const glowMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const tRef = useRef(0);

  useEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    map.needsUpdate = true;
  }, [map]);

  useFrame((_, dt) => {
    tRef.current += dt;
    const wave = 0.5 + 0.5 * Math.sin(tRef.current * 2.4);
    const wave2 = 0.5 + 0.5 * Math.sin(tRef.current * 3.1 + 1.2);

    if (matRef.current) {
      // Subtle brightness shimmer on the craft itself
      const boost = 1 + shimmer * 0.18 * wave;
      matRef.current.opacity = Math.min(1, opacity * boost);
      matRef.current.color.setRGB(boost, boost, boost * 1.02);
    }

    if (glowMatRef.current && glowRef.current) {
      const s = shimmer * (0.35 + 0.65 * wave2);
      glowMatRef.current.opacity = s * 0.45;
      const sc = 1.15 + 0.2 * wave;
      glowRef.current.scale.setScalar(sc);
    }
  });

  const img = map.image as { width?: number; height?: number } | undefined;
  const aspect =
    img?.width && img?.height ? img.width / img.height : 1.35;
  const w = SAT_SPRITE_WIDTH;
  const h = w / aspect;

  return (
    <group>
      {/* Soft halo — reads as “movable” without being loud */}
      <mesh ref={glowRef} position={[0, 0, -0.002]}>
        <circleGeometry args={[Math.max(w, h) * 0.72, 32]} />
        <meshBasicMaterial
          ref={glowMatRef}
          color="#cfe0ff"
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
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
        />
      </mesh>
    </group>
  );
}

/**
 * Thin dashed GPS orbit ring in the camera-facing plane (xy).
 */
function OrbitRing({ opacity }: { opacity: number }) {
  const line = useMemo(() => {
    const curve = new THREE.EllipseCurve(
      0,
      0,
      GPS_ORBIT_RADIUS,
      GPS_ORBIT_RADIUS,
      0,
      Math.PI * 2,
      false,
      0,
    );
    const pts = curve.getPoints(96);
    const positions = new Float32Array((pts.length + 1) * 3);
    for (let i = 0; i < pts.length; i++) {
      positions[i * 3] = pts[i].x;
      positions[i * 3 + 1] = pts[i].y;
      positions[i * 3 + 2] = 0;
    }
    positions[pts.length * 3] = pts[0].x;
    positions[pts.length * 3 + 1] = pts[0].y;
    positions[pts.length * 3 + 2] = 0;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineDashedMaterial({
      color: 0xffffff,
      dashSize: 0.04,
      gapSize: 0.03,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    return line;
  }, []);

  useEffect(() => {
    return () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    };
  }, [line]);

  useFrame(() => {
    const mat = line.material as THREE.LineDashedMaterial;
    mat.opacity = opacity * 0.75;
  });

  return <primitive object={line} />;
}

/**
 * Free-drag satellite → on release, ease to the real GPS orbit.
 * Earth and camera stay fixed the whole time.
 */
export default function Satellite({ active, onSettled }: SatelliteProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();

  const opacityRef = useRef(0);
  const [opacity, setOpacity] = useState(0);
  const [orbitOpacity, setOrbitOpacity] = useState(0);
  const orbitOpacityRef = useRef(0);

  const draggingRef = useRef(false);
  const hasDraggedRef = useRef(false);
  const settledRef = useRef(false);
  const floatTRef = useRef(0);
  const idleSinceRef = useRef(0);
  const shimmerRef = useRef(0);
  const [shimmer, setShimmer] = useState(0);
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
    new THREE.Vector3(SAT_START.x, SAT_START.y, SAT_START.z),
  );
  const displayPos = useRef(
    new THREE.Vector3(SAT_START.x, SAT_START.y, SAT_START.z),
  );

  const projectPointer = useCallback(
    (clientX: number, clientY: number) => {
      const rect = gl.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(plane, hit)) return null;
      // Hit is world-space; sat lives under PlanetStage (may be shifted down)
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
    // Keep the angle the user chose; set radius to the GPS orbit
    const angle = Math.atan2(from.y, from.x);
    const to = new THREE.Vector3(
      Math.cos(angle) * GPS_ORBIT_RADIUS,
      Math.sin(angle) * GPS_ORBIT_RADIUS,
      0,
    );
    snapRef.current = { from, to, t: 0 };
  }, []);

  // Pointer move/up on the canvas so drag continues off the mesh
  useEffect(() => {
    if (!active) return;
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
  }, [active, endDrag, gl.domElement, projectPointer]);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (
      !active ||
      settledRef.current ||
      snapRef.current ||
      opacityRef.current < 0.15
    ) {
      return;
    }
    e.stopPropagation();
    e.nativeEvent.preventDefault?.();
    draggingRef.current = true;
    hasDraggedRef.current = true;
    shimmerRef.current = 0;
    // Capture so move/up keep firing even if pointer leaves the mesh
    (e.target as Element | undefined)?.setPointerCapture?.(e.pointerId);
    const p = projectPointer(e.nativeEvent.clientX, e.nativeEvent.clientY);
    if (p) targetPos.current.copy(p);
  };

  useFrame((_, dt) => {
    const want = active ? 1 : 0;
    if (Math.abs(opacityRef.current - want) > 0.001) {
      opacityRef.current = THREE.MathUtils.damp(
        opacityRef.current,
        want,
        FADE_SPEED,
        dt,
      );
      setOpacity(opacityRef.current);
    }

    // After 2.5s idle, soft shimmer invites a drag
    if (active && !hasDraggedRef.current && !settledRef.current) {
      idleSinceRef.current += dt;
      const wantShimmer = idleSinceRef.current > 2.5 ? 1 : 0;
      shimmerRef.current = THREE.MathUtils.damp(
        shimmerRef.current,
        wantShimmer,
        2.2,
        dt,
      );
    } else {
      shimmerRef.current = THREE.MathUtils.damp(shimmerRef.current, 0, 4, dt);
      if (!active) idleSinceRef.current = 0;
    }
    if (Math.abs(shimmer - shimmerRef.current) > 0.02) {
      setShimmer(shimmerRef.current);
    }

    const snap = snapRef.current;
    if (snap) {
      snap.t = Math.min(1, snap.t + dt / SNAP_DURATION);
      const u = easeInOutCubic(snap.t);
      displayPos.current.lerpVectors(snap.from, snap.to, u);
      targetPos.current.copy(displayPos.current);

      orbitOpacityRef.current = THREE.MathUtils.damp(
        orbitOpacityRef.current,
        Math.min(1, snap.t * 1.2),
        3.0,
        dt,
      );
      setOrbitOpacity(orbitOpacityRef.current);

      if (snap.t >= 1 && !settledRef.current) {
        settledRef.current = true;
        snapRef.current = null;
        onSettled?.();
      }
    } else if (draggingRef.current) {
      // Snappy follow while dragging — full free placement
      displayPos.current.lerp(targetPos.current, 1 - Math.exp(-18 * dt));
    } else {
      displayPos.current.lerp(targetPos.current, 1 - Math.exp(-12 * dt));
    }

    // Soft float while waiting to be dragged (parked between copy + Earth)
    const idleFloat =
      active &&
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
      g.quaternion.copy(camera.quaternion);
    }

    if (settledRef.current && orbitOpacityRef.current < 0.99) {
      orbitOpacityRef.current = THREE.MathUtils.damp(
        orbitOpacityRef.current,
        1,
        3,
        dt,
      );
      setOrbitOpacity(orbitOpacityRef.current);
    }
  });

  // Always stay mounted (opacity 0 while waiting) so texture load never
  // remounts / suspends siblings like Earth.
  const canGrab = active && opacity > 0.15 && !settledRef.current;

  return (
    <group visible={opacity > 0.01 || active}>
      <OrbitRing opacity={orbitOpacity} />
      <group ref={groupRef} position={[SAT_START.x, SAT_START.y, SAT_START.z]}>
        <SatelliteSprite
          opacity={opacity}
          shimmer={shimmer}
          onPointerDown={canGrab ? onPointerDown : undefined}
        />
        {/*
          Fat grab disc — MUST stay visible={true} or R3F skips pointer hits.
          Opacity 0 so you only see the PNG.
        */}
        <mesh onPointerDown={canGrab ? onPointerDown : undefined}>
          <circleGeometry args={[0.16, 24]} />
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
