"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface NodeDef {
  id: string;
  label: string;
  color: number;
  radius: number;
  distance: number;
  phi: number;
  theta: number;
}

const NODES: NodeDef[] = [
  {
    id: "cowork",
    label: "Claude Cowork",
    color: 0xd4836a,
    radius: 1.4,
    distance: 0,
    phi: 0,
    theta: 0,
  },
  {
    id: "drive",
    label: "Google Drive",
    color: 0x4285f4,
    radius: 0.8,
    distance: 9,
    phi: 0.6,
    theta: 0,
  },
  {
    id: "gmail",
    label: "Gmail",
    color: 0xea4335,
    radius: 0.8,
    distance: 10,
    phi: 1.2,
    theta: 1.05,
  },
  {
    id: "files",
    label: "Files",
    color: 0xfbbc05,
    radius: 0.7,
    distance: 8.5,
    phi: 2.0,
    theta: 2.1,
  },
  {
    id: "browser",
    label: "Browser",
    color: 0x34a853,
    radius: 0.75,
    distance: 9.5,
    phi: 2.8,
    theta: 3.14,
  },
  {
    id: "excel",
    label: "Excel",
    color: 0x217346,
    radius: 0.7,
    distance: 8,
    phi: 0.9,
    theta: 4.2,
  },
  {
    id: "calendar",
    label: "Calendar",
    color: 0x7c4dff,
    radius: 0.75,
    distance: 10,
    phi: 1.8,
    theta: 5.2,
  },
];

function createTextSprite(text: string, color: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  ctx.clearRect(0, 0, 512, 128);

  // Background pill
  ctx.fillStyle = "rgba(28, 25, 23, 0.8)";
  ctx.font = "bold 36px -apple-system, BlinkMacSystemFont, sans-serif";
  const measuredWidth = ctx.measureText(text).width;
  const pillWidth = measuredWidth + 40;
  const pillX = (512 - pillWidth) / 2;
  ctx.beginPath();
  ctx.roundRect(pillX, 20, pillWidth, 70, 35);
  ctx.fill();

  // Border
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(pillX, 20, pillWidth, 70, 35);
  ctx.stroke();

  // Text
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 56);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(6, 1.5, 1);

  return sprite;
}

function createGlowSprite(color: number, size: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  const c = new THREE.Color(color);
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(
    0,
    `rgba(${Math.floor(c.r * 255)}, ${Math.floor(c.g * 255)}, ${Math.floor(c.b * 255)}, 0.4)`,
  );
  gradient.addColorStop(
    0.4,
    `rgba(${Math.floor(c.r * 255)}, ${Math.floor(c.g * 255)}, ${Math.floor(c.b * 255)}, 0.15)`,
  );
  gradient.addColorStop(
    1,
    `rgba(${Math.floor(c.r * 255)}, ${Math.floor(c.g * 255)}, ${Math.floor(c.b * 255)}, 0)`,
  );

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.setScalar(size * 4);
  return sprite;
}

export default function NetworkGraph3D() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Scene setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1c1917);

    // Add subtle fog for depth
    scene.fog = new THREE.FogExp2(0x1c1917, 0.012);

    const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 1000);
    camera.position.set(0, 3, 22);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const rect = container.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    container.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xd4836a, 1.5, 50);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    const backLight = new THREE.DirectionalLight(0x6366f1, 0.3);
    backLight.position.set(-10, 5, -10);
    scene.add(backLight);

    // --- Create nodes ---
    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    interface NodeObj {
      def: NodeDef;
      sphere: THREE.Mesh;
      glow: THREE.Sprite;
      label: THREE.Sprite;
      basePos: THREE.Vector3;
      orbitOffset: number;
    }

    const nodeObjects: NodeObj[] = [];
    const nodeTextures: THREE.Texture[] = [];
    const connections: {
      line: THREE.Line;
      from: NodeObj;
      to: NodeObj;
    }[] = [];

    NODES.forEach((def) => {
      // Sphere
      const geo = new THREE.SphereGeometry(def.radius, 32, 32);
      const mat = new THREE.MeshStandardMaterial({
        color: def.color,
        emissive: def.color,
        emissiveIntensity: 0.3,
        roughness: 0.3,
        metalness: 0.6,
      });
      const sphere = new THREE.Mesh(geo, mat);

      // Position
      let basePos: THREE.Vector3;
      if (def.distance === 0) {
        basePos = new THREE.Vector3(0, 0, 0);
      } else {
        basePos = new THREE.Vector3(
          def.distance * Math.sin(def.phi) * Math.cos(def.theta),
          def.distance * Math.cos(def.phi) * 0.5, // flatten Y a bit
          def.distance * Math.sin(def.phi) * Math.sin(def.theta),
        );
      }
      sphere.position.copy(basePos);
      graphGroup.add(sphere);

      // Glow
      const glow = createGlowSprite(def.color, def.radius);
      glow.position.copy(basePos);
      graphGroup.add(glow);

      // Label
      const colorHex = `#${new THREE.Color(def.color).getHexString()}`;
      const label = createTextSprite(def.label, colorHex);
      label.position.copy(basePos);
      label.position.y += def.radius + 1.6;
      graphGroup.add(label);

      if (label.material.map) nodeTextures.push(label.material.map);
      if (glow.material.map) nodeTextures.push(glow.material.map);

      nodeObjects.push({
        def,
        sphere,
        glow,
        label,
        basePos,
        orbitOffset: Math.random() * Math.PI * 2,
      });
    });

    // --- Create connections (from center to each outer node) ---
    const centerNode = nodeObjects.find((n) => n.def.id === "cowork");
    if (!centerNode) return;
    const outerNodes = nodeObjects.filter((n) => n.def.id !== "cowork");

    outerNodes.forEach((outerNode) => {
      const points = [centerNode.sphere.position.clone(), outerNode.sphere.position.clone()];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const mat = new THREE.LineDashedMaterial({
        color: outerNode.def.color,
        dashSize: 0.5,
        gapSize: 0.3,
        transparent: true,
        opacity: 0.35,
      });

      const line = new THREE.Line(geo, mat);
      line.computeLineDistances();
      graphGroup.add(line);

      connections.push({
        line,
        from: centerNode,
        to: outerNode,
      });
    });

    // --- Background particles for atmosphere ---
    const bgParticleCount = 200;
    const bgPositions = new Float32Array(bgParticleCount * 3);
    for (let i = 0; i < bgParticleCount; i++) {
      bgPositions[i * 3] = (Math.random() - 0.5) * 60;
      bgPositions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      bgPositions[i * 3 + 2] = (Math.random() - 0.5) * 40;
    }
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute("position", new THREE.BufferAttribute(bgPositions, 3));
    const bgMat = new THREE.PointsMaterial({
      color: 0x555555,
      size: 0.08,
      transparent: true,
      opacity: 0.5,
    });
    const bgParticles = new THREE.Points(bgGeo, bgMat);
    scene.add(bgParticles);

    // --- Mouse hover detection ---
    const mouse = new THREE.Vector2(9999, 9999);
    const raycaster = new THREE.Raycaster();
    let hoveredNodeId: string | null = null;

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onMouseLeave = () => {
      mouse.set(9999, 9999);
      hoveredNodeId = null;
    };

    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseleave", onMouseLeave);

    // --- Animation ---
    let animationId: number;
    const clock = new THREE.Clock();

    // Subtle node bobbing and orbit
    const updateNodeMotion = (elapsed: number) => {
      for (const node of nodeObjects) {
        if (node.def.distance > 0) {
          const t = elapsed * 0.3 + node.orbitOffset;
          const bob = Math.sin(t * 1.5) * 0.3;
          const drift = Math.cos(t * 0.7) * 0.2;

          node.sphere.position.x = node.basePos.x + drift;
          node.sphere.position.y = node.basePos.y + bob;
          node.sphere.position.z = node.basePos.z + Math.sin(t * 0.5) * 0.15;

          node.glow.position.copy(node.sphere.position);
          node.label.position.copy(node.sphere.position);
          node.label.position.y += node.def.radius + 1.6;
        } else {
          // Center node subtle pulse
          const scale = 1 + Math.sin(elapsed * 1.2) * 0.05;
          node.sphere.scale.setScalar(scale);
          node.glow.scale.setScalar(node.def.radius * 4 * (1 + Math.sin(elapsed * 0.8) * 0.1));
        }
      }
    };

    // Update connection line geometry to follow nodes
    const updateConnectionGeometry = () => {
      for (const conn of connections) {
        const posAttr = conn.line.geometry.getAttribute("position") as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        arr[0] = conn.from.sphere.position.x;
        arr[1] = conn.from.sphere.position.y;
        arr[2] = conn.from.sphere.position.z;
        arr[3] = conn.to.sphere.position.x;
        arr[4] = conn.to.sphere.position.y;
        arr[5] = conn.to.sphere.position.z;
        posAttr.needsUpdate = true;
        conn.line.computeLineDistances();

        // Animate dash flow
        const mat = conn.line.material as THREE.LineDashedMaterial;
        mat.dashSize = 0.5;
        mat.gapSize = 0.3;
      }
    };

    // Raycast pointer against node spheres and store the hovered id
    const updateHoveredNode = () => {
      raycaster.setFromCamera(mouse, camera);
      const spheres = nodeObjects.map((n) => n.sphere);
      const intersects = raycaster.intersectObjects(spheres);

      let newHoveredId: string | null = null;
      if (intersects.length > 0) {
        const hitSphere = intersects[0].object;
        const hitNode = nodeObjects.find((n) => n.sphere === hitSphere);
        if (hitNode) newHoveredId = hitNode.def.id;
      }
      hoveredNodeId = newHoveredId;
    };

    // Ease a single node's materials/scale toward its hover target state
    const updateNodeHighlight = (node: (typeof nodeObjects)[number]) => {
      const mat = node.sphere.material as THREE.MeshStandardMaterial;
      const isHovered = hoveredNodeId === node.def.id;
      const isConnected =
        hoveredNodeId === "cowork" ||
        (hoveredNodeId !== null && node.def.id === "cowork") ||
        hoveredNodeId === node.def.id;

      const targetEmissive = isHovered ? 0.7 : isConnected && hoveredNodeId ? 0.45 : 0.3;
      mat.emissiveIntensity += (targetEmissive - mat.emissiveIntensity) * 0.1;

      // Scale highlight
      if (node.def.distance > 0) {
        const targetScale = isHovered ? 1.25 : 1;
        node.sphere.scale.x += (targetScale - node.sphere.scale.x) * 0.1;
        node.sphere.scale.y += (targetScale - node.sphere.scale.y) * 0.1;
        node.sphere.scale.z += (targetScale - node.sphere.scale.z) * 0.1;
      }

      // Glow intensity
      const glowMat = node.glow.material as THREE.SpriteMaterial;
      const targetOpacity = isHovered ? 1 : 0.6;
      glowMat.opacity += (targetOpacity - glowMat.opacity) * 0.1;

      // Label opacity
      const labelMat = node.label.material as THREE.SpriteMaterial;
      const labelTarget = isHovered || hoveredNodeId === null ? 0.9 : 0.3;
      labelMat.opacity += (labelTarget - labelMat.opacity) * 0.1;
    };

    // Ease connection lines toward their hover target opacity
    const updateConnectionHighlights = () => {
      for (const conn of connections) {
        const mat = conn.line.material as THREE.LineDashedMaterial;
        const isHighlighted = hoveredNodeId === conn.to.def.id || hoveredNodeId === "cowork";
        const targetOpacity = isHighlighted ? 0.8 : hoveredNodeId === null ? 0.35 : 0.12;
        mat.opacity += (targetOpacity - mat.opacity) * 0.1;
        // The dash flow is achieved by the line distance computation each frame
        mat.dashSize = 0.5;
      }
    };

    const updateHighlights = () => {
      for (const node of nodeObjects) updateNodeHighlight(node);
      updateConnectionHighlights();
    };

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      // Gentle orbit rotation of whole graph
      graphGroup.rotation.y = elapsed * 0.08;

      updateNodeMotion(elapsed);
      updateConnectionGeometry();
      updateHoveredNode();
      updateHighlights();

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
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
      resizeObserver.disconnect();

      for (const node of nodeObjects) {
        node.sphere.geometry.dispose();
        (node.sphere.material as THREE.MeshStandardMaterial).dispose();
        (node.glow.material as THREE.SpriteMaterial).dispose();
        (node.label.material as THREE.SpriteMaterial).dispose();
      }
      for (const tex of nodeTextures) {
        tex.dispose();
      }
      for (const conn of connections) {
        conn.line.geometry.dispose();
        (conn.line.material as THREE.LineDashedMaterial).dispose();
      }
      bgGeo.dispose();
      bgMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div
        className="relative rounded-xl border border-white/[0.06] overflow-hidden bg-[#1C1917]"
        style={{ aspectRatio: "16 / 9" }}
      >
        <div ref={containerRef} className="absolute inset-0" />
        <div className="absolute bottom-3 right-4 z-10 pointer-events-none">
          <span className="text-[11px] text-white/30 select-none">
            Hover to explore connections
          </span>
        </div>
      </div>
    </div>
  );
}
