"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line, Html } from "@react-three/drei";
import { Color, Matrix4, Quaternion, Vector3, CatmullRomCurve3, type InstancedMesh } from "three";
import { useRagStore } from "../ragStore";
import { prefersReducedMotion } from "../motion/reducedMotion";
import { T } from "../theme";
import type { UniverseData, UniverseChunk } from "./useUniverseData";

/* The 3D half of the Embedding Universe (F4). One instanced mesh draws
   every chunk (≤2 draw calls for the cloud); the query ship flies a
   Catmull-Rom arc to each new question; retrieved chunks glow in rank
   order with trace lines. `attract` and `trace` grammar tokens live
   here — geometry IS the lesson: similar meaning, nearby points. */

const SCALE = 1.25;
const IDENTITY_Q = new Quaternion();

function chunkColor(d: UniverseChunk): string {
  if (d.retrieved) return "#34D399";
  if (d.cited) return "#FBBF24";
  const hue = 205 + d.pos[0] * 55 + d.pos[1] * 25;
  return `hsl(${Math.round(hue)}, 82%, 64%)`;
}

function InstancedChunks({
  chunks, onHover,
}: {
  chunks: UniverseChunk[];
  onHover: (index: number | null) => void;
}) {
  const ref = useRef<InstancedMesh>(null);
  const lastHoverAt = useRef(0);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    const col = new Color();
    const pos = new Vector3();
    const scl = new Vector3();
    chunks.forEach((d, i) => {
      const s = d.retrieved ? 1.6 : d.cited ? 1.3 : 1;
      pos.set(d.pos[0] * SCALE, d.pos[1] * SCALE, d.pos[2] * SCALE);
      scl.set(s, s, s);
      m.compose(pos, IDENTITY_Q, scl);
      mesh.setMatrixAt(i, m);
      col.set(chunkColor(d));
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [chunks]);

  return (
    <instancedMesh
      key={chunks.length}   // instance count is fixed at construction
      ref={ref}
      args={[undefined, undefined, Math.max(1, chunks.length)]}
      onPointerMove={e => {
        // hysteresis: ignore flickery sub-60ms hover churn
        const now = performance.now();
        if (now - lastHoverAt.current < 60) return;
        lastHoverAt.current = now;
        e.stopPropagation();
        onHover(e.instanceId ?? null);
      }}
      onPointerOut={() => onHover(null)}
    >
      <sphereGeometry args={[0.052, 12, 12]} />
      <meshStandardMaterial emissive={"#5B7BD5"} emissiveIntensity={0.35} />
    </instancedMesh>
  );
}

function ClusterHalos({ data }: { data: UniverseData }) {
  return (
    <>
      {data.clusters.map((c, i) => (
        <group key={i} position={[c.centroid[0] * SCALE, c.centroid[1] * SCALE, c.centroid[2] * SCALE]}>
          <mesh>
            <sphereGeometry args={[c.radius * SCALE, 20, 20]} />
            <meshBasicMaterial color="#4F6FD8" transparent opacity={0.07} depthWrite={false} />
          </mesh>
          <Html distanceFactor={5} style={{ pointerEvents: "none" }}>
            <div style={{
              fontFamily: T.mono, fontSize: 11, whiteSpace: "nowrap",
              color: "rgba(199,210,254,0.85)", background: "rgba(10,12,16,0.65)",
              padding: "2px 8px", borderRadius: 7, transform: "translate(-50%, -50%)",
            }}>
              {c.label} · {c.count}
            </div>
          </Html>
        </group>
      ))}
    </>
  );
}

function QueryShip({ data }: { data: UniverseData }) {
  const ref = useRef<import("three").Mesh>(null);
  const flight = useRef<{ curve: CatmullRomCurve3; start: number } | null>(null);
  const settled = useRef<Vector3 | null>(null);

  const target = useMemo(
    () => (data.queryPos ? new Vector3(...data.queryPos).multiplyScalar(SCALE) : null),
    [data.queryPos],
  );

  useEffect(() => {
    if (!target) { settled.current = null; flight.current = null; return; }
    if (prefersReducedMotion() || !settled.current) {
      settled.current = target.clone();     // cuts, not pans
      flight.current = null;
      return;
    }
    // `attract` grammar: fly a lifted arc from the old question to the new
    const from = settled.current.clone();
    const mid = from.clone().lerp(target, 0.5).add(new Vector3(0, 0.7, 0));
    flight.current = { curve: new CatmullRomCurve3([from, mid, target.clone()]), start: performance.now() };
    settled.current = target.clone();
  }, [target]);

  useFrame(() => {
    if (!ref.current) return;
    if (flight.current) {
      const t = Math.min(1, (performance.now() - flight.current.start) / 1200);
      const eased = 1 - Math.pow(1 - t, 3);
      ref.current.position.copy(flight.current.curve.getPoint(eased));
      if (t >= 1) flight.current = null;
    } else if (settled.current) {
      ref.current.position.copy(settled.current);
    }
  });

  if (!target) return null;
  return (
    <>
      <mesh ref={ref}>
        <octahedronGeometry args={[0.1]} />
        <meshStandardMaterial color={T.amber} emissive={T.amber} emissiveIntensity={1.1} />
      </mesh>
      {/* `trace` grammar: provenance lines to the retrieved chunks */}
      {data.chunks.filter(d => d.retrieved).map(d => (
        <Line
          key={`l-${d.id}`}
          points={[
            [target.x, target.y, target.z],
            [d.pos[0] * SCALE, d.pos[1] * SCALE, d.pos[2] * SCALE],
          ]}
          color="#34D399"
          lineWidth={1}
          transparent
          opacity={0.5}
        />
      ))}
    </>
  );
}

export default function Universe3D({
  data, height, halos,
}: {
  data: UniverseData;
  height: number;
  halos: boolean;
}) {
  const setHoverChunk = useRagStore(s => s.setHoverChunk);
  const [hover, setHover] = useState<number | null>(null);
  const hovered = hover !== null ? data.chunks[hover] : null;

  return (
    <div style={{
      height, borderRadius: 12, overflow: "hidden", border: `1px solid ${T.border}`,
      background: "radial-gradient(ellipse at center, #10141d 0%, #0A0C10 100%)",
      position: "relative",
    }}>
      <Canvas camera={{ position: [0, 0.6, 3.1], fov: 46 }} dpr={[1, 1.8]}>
        <ambientLight intensity={0.55} />
        <pointLight position={[4, 4, 4]} intensity={60} />
        <InstancedChunks
          chunks={data.chunks}
          onHover={i => { setHover(i); setHoverChunk(i !== null ? data.chunks[i].id : null); }}
        />
        {halos && <ClusterHalos data={data} />}
        <QueryShip data={data} />
        <OrbitControls
          enablePan={false}
          minDistance={1.4}
          maxDistance={6}
          autoRotate={!prefersReducedMotion() && hover === null}
          autoRotateSpeed={0.55}
        />
      </Canvas>

      {hovered && (
        <div style={{
          position: "absolute", left: 10, bottom: 10, maxWidth: 300, pointerEvents: "none",
          padding: "10px 12px", borderRadius: 10,
          background: "rgba(17,17,17,0.94)", border: "1px solid rgba(255,255,255,0.18)",
          fontFamily: T.mono, fontSize: 11.5, color: "#C9CFDA", lineHeight: 1.55,
        }}>
          <span style={{ color: hovered.retrieved ? "#34D399" : hovered.cited ? "#FBBF24" : "#60A5FA" }}>
            chunk {hovered.id} · p.{hovered.page} · {hovered.tokens} tok
            {hovered.sim !== null ? ` · sim ${(hovered.sim * 100).toFixed(0)}%` : ""}
            {hovered.retrieved ? " · retrieved" : ""}{hovered.cited ? " · cited" : ""}
          </span>
          <br />{hovered.preview}…
        </div>
      )}
    </div>
  );
}
