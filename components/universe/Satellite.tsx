"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import {
  GPS_ORBIT_RADIUS,
  SAT_MAX_RADIUS,
  SAT_MIN_RADIUS,
  SAT_START,
} from "@/components/universe/constants";

type SatelliteProps = {
  /** When true, satellite fades in and becomes interactive */
  active: boolean;
  /** Fired once after user releases and snap-to-GPS finishes */
  onSettled?: () => void;
};

const FADE_SPEED = 1.6;
const SNAP_DURATION = 1.15;

function clampOnPlane(point: THREE.Vector3): THREE.Vector3 {
  // Keep on the camera-facing plane (z ≈ 0) so it never slips behind Earth
  point.z = 0;
  const r = Math.hypot(point.x, point.y);
  if (r < 1e-5) {
    point.set(SAT_MIN_RADIUS, 0, 0);
    return point;
  }
  const clamped = THREE.MathUtils.clamp(r, SAT_MIN_RADIUS, SAT_MAX_RADIUS);
  const s = clamped / r;
  point.x *= s;
  point.y *= s;
  return point;
}

/**
 * Tiny low-poly GPS satellite: body + solar panels + dish stick.
 */
function SatelliteMesh({ opacity }: { opacity: number }) {
  const materials = useMemo(() => {
    // Emissive so the sat pops even on the night side of Earth
    const metal = new THREE.MeshStandardMaterial({
      color: "#e8eef8",
      emissive: "#b8c8e8",
      emissiveIntensity: 0.45,
      metalness: 0.4,
      roughness: 0.4,
      transparent: true,
      opacity: 1,
      depthWrite: true,
    });
    const panel = new THREE.MeshStandardMaterial({
      color: "#4a7fc4",
      emissive: "#1a3a6a",
      emissiveIntensity: 0.35,
      metalness: 0.15,
      roughness: 0.45,
      transparent: true,
      opacity: 1,
      depthWrite: true,
    });
    const accent = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      emissive: "#d0e4ff",
      emissiveIntensity: 0.55,
      metalness: 0.1,
      roughness: 0.35,
      transparent: true,
      opacity: 1,
      depthWrite: true,
    });
    return { metal, panel, accent };
  }, []);

  useEffect(() => {
    return () => {
      materials.metal.dispose();
      materials.panel.dispose();
      materials.accent.dispose();
    };
  }, [materials]);

  useFrame(() => {
    const { metal, panel, accent } = materials;
    metal.opacity = opacity;
    panel.opacity = opacity;
    accent.opacity = opacity;
    const dw = opacity > 0.95;
    metal.depthWrite = dw;
    panel.depthWrite = dw;
    accent.depthWrite = dw;
  });

  // Large enough to read on a phone; grab sphere is even bigger
  const s = 0.09;

  return (
    <group scale={s}>
      <mesh material={materials.metal}>
        <boxGeometry args={[1.2, 0.7, 0.7]} />
      </mesh>
      <mesh position={[-1.15, 0, 0]} material={materials.panel}>
        <boxGeometry args={[1.0, 0.08, 1.6]} />
      </mesh>
      <mesh position={[1.15, 0, 0]} material={materials.panel}>
        <boxGeometry args={[1.0, 0.08, 1.6]} />
      </mesh>
      <mesh position={[0, 0.55, 0]} material={materials.accent}>
        <cylinderGeometry args={[0.06, 0.06, 0.55, 6]} />
      </mesh>
      <mesh
        position={[0, 0.9, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        material={materials.accent}
      >
        <cylinderGeometry args={[0.28, 0.28, 0.06, 12]} />
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
      dashSize: 0.045,
      gapSize: 0.035,
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
 * Draggable satellite → snap to real GPS orbit on release.
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
      return clampOnPlane(hit.clone());
    },
    [camera, gl.domElement, hit, ndc, plane, raycaster],
  );

  const endDrag = useCallback(() => {
    if (!draggingRef.current || settledRef.current) return;
    draggingRef.current = false;

    const from = displayPos.current.clone();
    // Keep angle; snap radius to real GPS height
    const angle = Math.atan2(from.y, from.x);
    const to = new THREE.Vector3(
      Math.cos(angle) * GPS_ORBIT_RADIUS,
      Math.sin(angle) * GPS_ORBIT_RADIUS,
      0,
    );
    snapRef.current = { from, to, t: 0 };
  }, []);

  // Pointer listeners on the canvas while dragging (smooth + leaves mesh)
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
      const u = 1 - Math.pow(1 - snap.t, 3);
      displayPos.current.lerpVectors(snap.from, snap.to, u);
      targetPos.current.copy(displayPos.current);

      orbitOpacityRef.current = THREE.MathUtils.damp(
        orbitOpacityRef.current,
        Math.min(1, snap.t * 1.4),
        4,
        dt,
      );
      setOrbitOpacity(orbitOpacityRef.current);

      if (snap.t >= 1 && !settledRef.current) {
        settledRef.current = true;
        snapRef.current = null;
        onSettled?.();
      }
    } else if (draggingRef.current) {
      displayPos.current.lerp(targetPos.current, 1 - Math.exp(-14 * dt));
    } else {
      displayPos.current.lerp(targetPos.current, 1 - Math.exp(-10 * dt));
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

  if (!active && opacity < 0.01) return null;

  return (
    <group>
      <OrbitRing opacity={orbitOpacity} />
      <group ref={groupRef} position={[SAT_START.x, SAT_START.y, SAT_START.z]}>
        <SatelliteMesh opacity={opacity} />
        {/* Invisible grab sphere — easy touch target on mobile */}
        <mesh onPointerDown={onPointerDown}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Soft glow halo so it reads as interactive */}
        <mesh>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshBasicMaterial
            color="#cfe0ff"
            transparent
            opacity={opacity * 0.28}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}
