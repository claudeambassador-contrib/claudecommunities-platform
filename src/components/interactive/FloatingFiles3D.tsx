"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

interface FileItem {
  name: string;
  type: "pdf" | "xlsx" | "jpg" | "doc";
}

interface FloatingFiles3DProps {
  files: FileItem[];
}

const FILE_COLORS: Record<string, number> = {
  pdf: 0xe74c3c,
  xlsx: 0x27ae60,
  jpg: 0x3498db,
  doc: 0xd4836a,
};

const FILE_LABELS: Record<string, string> = {
  pdf: "PDF",
  xlsx: "XLS",
  jpg: "JPG",
  doc: "DOC",
};

function createTextTexture(text: string, bgColor: string, label: string): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 320;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  // Card background
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(8, 8, 240, 304, 16);
  ctx.fill();

  // Subtle inner border
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(8, 8, 240, 304, 16);
  ctx.stroke();

  // File icon area (darker rectangle at top)
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.roundRect(28, 28, 200, 140, 10);
  ctx.fill();

  // File type label in icon area
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "bold 48px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 128, 98);

  // File name text (truncated)
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "20px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const displayName = text.length > 16 ? `${text.substring(0, 14)}...` : text;
  ctx.fillText(displayName, 128, 210);

  // Extension badge
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.roundRect(80, 245, 96, 36, 18);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.fillText(`.${text.split(".").pop()}`, 128, 264);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export default function FloatingFiles3D({ files }: FloatingFiles3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const organizedRef = useRef(false);
  const fileCardsRef = useRef<
    Array<{
      mesh: THREE.Mesh;
      type: string;
      targetPos: THREE.Vector3;
      messyPos: THREE.Vector3;
      currentVel: THREE.Vector3;
      phase: number;
      bobSpeed: number;
      bobAmount: number;
    }>
  >([]);
  const [organized, setOrganized] = useState(false);

  const handleToggle = useCallback(() => {
    organizedRef.current = !organizedRef.current;
    setOrganized(organizedRef.current);

    const cards = fileCardsRef.current;
    if (!cards.length) return;

    if (organizedRef.current) {
      // Calculate organized positions: group by type in rows
      const typeGroups: Record<string, typeof cards> = {};
      for (const card of cards) {
        if (!typeGroups[card.type]) typeGroups[card.type] = [];
        typeGroups[card.type].push(card);
      }

      const types = Object.keys(typeGroups);
      const rowSpacing = 4.5;
      const colSpacing = 3.5;
      const startY = ((types.length - 1) * rowSpacing) / 2;

      types.forEach((type, rowIdx) => {
        const group = typeGroups[type];
        const startX = -((group.length - 1) * colSpacing) / 2;
        group.forEach((card, colIdx) => {
          card.targetPos.set(startX + colIdx * colSpacing, startY - rowIdx * rowSpacing, 0);
        });
      });
    } else {
      // Back to messy positions
      for (const card of cards) {
        card.targetPos.copy(card.messyPos);
      }
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Scene setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1c1917);

    const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 1000);
    camera.position.z = 28;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const rect = container.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    container.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 10);
    scene.add(dirLight);

    // --- Create file cards ---
    const cards: typeof fileCardsRef.current = [];
    const group = new THREE.Group();
    scene.add(group);

    const useFiles =
      files.length > 0
        ? files
        : [
            { name: "report.pdf", type: "pdf" as const },
            { name: "data.xlsx", type: "xlsx" as const },
            { name: "photo.jpg", type: "jpg" as const },
            { name: "notes.doc", type: "doc" as const },
            { name: "invoice.pdf", type: "pdf" as const },
            { name: "budget.xlsx", type: "xlsx" as const },
            { name: "logo.jpg", type: "jpg" as const },
            { name: "draft.doc", type: "doc" as const },
            { name: "receipt.pdf", type: "pdf" as const },
            { name: "chart.jpg", type: "jpg" as const },
          ];

    const textures: THREE.Texture[] = [];

    useFiles.forEach((file) => {
      const color = FILE_COLORS[file.type] || 0xd4836a;
      const label = FILE_LABELS[file.type] || "FILE";
      const colorHex = `#${new THREE.Color(color).getHexString()}`;
      const texture = createTextTexture(file.name, colorHex, label);
      textures.push(texture);

      const geo = new THREE.PlaneGeometry(2.8, 3.6);
      const mat = new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
        roughness: 0.4,
        metalness: 0.1,
      });

      const mesh = new THREE.Mesh(geo, mat);

      // Random messy position
      const messyPos = new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 8,
      );
      mesh.position.copy(messyPos);

      // Random rotation for messy state
      mesh.rotation.x = (Math.random() - 0.5) * 0.4;
      mesh.rotation.y = (Math.random() - 0.5) * 0.5;
      mesh.rotation.z = (Math.random() - 0.5) * 0.3;

      group.add(mesh);

      cards.push({
        mesh,
        type: file.type,
        targetPos: messyPos.clone(),
        messyPos: messyPos.clone(),
        currentVel: new THREE.Vector3(),
        phase: Math.random() * Math.PI * 2,
        bobSpeed: 0.5 + Math.random() * 0.8,
        bobAmount: 0.3 + Math.random() * 0.4,
      });
    });

    fileCardsRef.current = cards;

    // --- Animation ---
    let animationId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const isOrg = organizedRef.current;

      // Subtle scene rotation
      group.rotation.y = Math.sin(elapsed * 0.15) * 0.12;

      for (const card of cards) {
        const { mesh, targetPos, currentVel, phase, bobSpeed, bobAmount } = card;

        // Spring physics toward target
        const springK = 0.06;
        const damping = 0.85;

        const dx = targetPos.x - mesh.position.x;
        const dy = targetPos.y - mesh.position.y;
        const dz = targetPos.z - mesh.position.z;

        currentVel.x += dx * springK;
        currentVel.y += dy * springK;
        currentVel.z += dz * springK;

        currentVel.x *= damping;
        currentVel.y *= damping;
        currentVel.z *= damping;

        mesh.position.x += currentVel.x;
        mesh.position.y += currentVel.y + Math.sin(elapsed * bobSpeed + phase) * bobAmount * 0.01;
        mesh.position.z += currentVel.z;

        // Bob effect (add on top)
        if (!isOrg) {
          mesh.position.y += Math.sin(elapsed * bobSpeed + phase) * bobAmount * 0.005;
        }

        // Rotation: organized = flat facing camera, messy = random tilts
        if (isOrg) {
          mesh.rotation.x += (0 - mesh.rotation.x) * 0.05;
          mesh.rotation.y += (0 - mesh.rotation.y) * 0.05;
          mesh.rotation.z += (0 - mesh.rotation.z) * 0.05;
        } else {
          // Gentle wobble
          mesh.rotation.x += Math.sin(elapsed * 0.3 + phase) * 0.0008;
          mesh.rotation.z += Math.cos(elapsed * 0.25 + phase) * 0.0006;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // --- Resize ---
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) continue;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    });
    resizeObserver.observe(container);

    // --- Cleanup ---
    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      for (const card of cards) {
        card.mesh.geometry.dispose();
        (card.mesh.material as THREE.MeshStandardMaterial).dispose();
      }
      for (const tex of textures) {
        tex.dispose();
      }
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [files]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div
        className="relative rounded-xl border border-white/[0.06] overflow-hidden bg-[#1C1917]"
        style={{ aspectRatio: "16 / 9" }}
      >
        <div ref={containerRef} className="absolute inset-0" />
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <button
            type="button"
            onClick={handleToggle}
            className="px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 cursor-pointer select-none"
            style={{
              backgroundColor: organized ? "rgba(212, 131, 106, 0.9)" : "rgba(255, 255, 255, 0.1)",
              color: organized ? "#1C1917" : "rgba(255, 255, 255, 0.8)",
              border: organized
                ? "1px solid rgba(212, 131, 106, 1)"
                : "1px solid rgba(255, 255, 255, 0.15)",
              backdropFilter: "blur(8px)",
            }}
          >
            {organized ? "Organized" : "Messy"} &mdash; Click to{" "}
            {organized ? "Scatter" : "Organize"}
          </button>
        </div>
      </div>
    </div>
  );
}
