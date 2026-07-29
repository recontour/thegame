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
const SAT_SPRITE_WIDTH = 0.22;

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
 */
function SatelliteSprite({ opacity }: { opacity: number }) {
  const map = useLoader(THREE.TextureLoader, SATELLITE_PNG);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useEffect(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    map.needsUpdate = true;
  }, [map]);

  useFrame(() => {
    if (matRef.current) {
      matRef.current.opacity = opacity;
    }
  });

  // Keep aspect from the texture when we know it; fallback ~ square-ish craft
  const img = map.image as { width?: number; height?: number } | undefined;
  const aspect =
    img?.width && img?.height ? img.width / img.height : 1.35;
  const w = SAT_SPRITE_WIDTH;
  const h = w / aspect;

  return (
    <mesh>
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
  const settledRef = useRef(false);
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
      return projectOnPlane(hit.clone());
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
      opacityRef.current < 0.5
    ) {
      return;
    }
    e.stopPropagation();
    draggingRef.current = true;
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

    const g = groupRef.current;
    if (g) {
      g.position.copy(displayPos.current);
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
  return (
    <group visible={opacity > 0.01 || active}>
      <OrbitRing opacity={orbitOpacity} />
      <group ref={groupRef} position={[SAT_START.x, SAT_START.y, SAT_START.z]}>
        <SatelliteSprite opacity={opacity} />
        {/* Large invisible grab target — only while interactive */}
        <mesh
          onPointerDown={onPointerDown}
          visible={false}
          raycast={active && opacity > 0.5 ? undefined : () => {}}
        >
          <sphereGeometry args={[0.14, 16, 16]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}
