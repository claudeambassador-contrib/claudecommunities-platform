"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface ThreeJSHeroProps {
  title: string;
  subtitle: string;
}

export default function ThreeJSHero({ title, subtitle }: ThreeJSHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1c1917);

    const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
    camera.position.z = 40;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const rect = container.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    container.appendChild(renderer.domElement);

    // --- Particle system ---
    const PARTICLE_COUNT = 600;
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);
    const velocities = new Float32Array(PARTICLE_COUNT * 3); // for repulsion recovery
    const originalPositions = new Float32Array(PARTICLE_COUNT * 3);

    // Color palette: coral, warm white, soft amber, rose
    const palette = [
      new THREE.Color(0xd4836a), // coral accent
      new THREE.Color(0xe8c4b8), // soft warm
      new THREE.Color(0xffffff), // white
      new THREE.Color(0xf5a882), // peach
      new THREE.Color(0xd4836a), // coral (double weight)
      new THREE.Color(0xfbbf24), // amber
      new THREE.Color(0xff9b8a), // rose
    ];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;

      // Distribute in a loose sphere / cloud shape
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r = 12 + Math.random() * 14; // radius 12-26

      // Add some noise for organic feel
      const noiseX = (Math.random() - 0.5) * 6;
      const noiseY = (Math.random() - 0.5) * 6;
      const noiseZ = (Math.random() - 0.5) * 6;

      positions[i3] = Math.sin(phi) * Math.cos(theta) * r + noiseX;
      positions[i3 + 1] = Math.sin(phi) * Math.sin(theta) * r + noiseY;
      positions[i3 + 2] = Math.cos(phi) * r + noiseZ;

      originalPositions[i3] = positions[i3];
      originalPositions[i3 + 1] = positions[i3 + 1];
      originalPositions[i3 + 2] = positions[i3 + 2];

      velocities[i3] = 0;
      velocities[i3 + 1] = 0;
      velocities[i3 + 2] = 0;

      const color = palette[Math.floor(Math.random() * palette.length)];
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;

      sizes[i] = 0.3 + Math.random() * 1.2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    // Custom shader for soft glowing particles
    const vertexShader = `
      attribute float size;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float dist = length(mvPosition.xyz);
        vAlpha = clamp(1.0 - dist / 80.0, 0.15, 1.0);
        gl_PointSize = size * (180.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        if (d > 0.5) discard;
        // Soft glow falloff
        float glow = 1.0 - smoothstep(0.0, 0.5, d);
        float core = 1.0 - smoothstep(0.0, 0.2, d);
        vec3 finalColor = vColor * (0.6 + core * 0.4);
        float alpha = glow * vAlpha * 0.85;
        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // --- Inner core glow (subtle bright center) ---
    const coreGeo = new THREE.SphereGeometry(3, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xd4836a,
      transparent: true,
      opacity: 0.04,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // --- Mouse tracking ---
    const mouse = new THREE.Vector2(9999, 9999); // off-screen initially
    const raycaster = new THREE.Raycaster();
    const mouseWorld = new THREE.Vector3();

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      // Project mouse into world space at z=0
      raycaster.setFromCamera(mouse, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      raycaster.ray.intersectPlane(plane, mouseWorld);
    };

    const onMouseLeave = () => {
      mouse.set(9999, 9999);
      mouseWorld.set(9999, 9999, 9999);
    };

    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseleave", onMouseLeave);

    // --- Animation ---
    let animationId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
      const posArr = posAttr.array as Float32Array;

      // Gentle rotation
      particles.rotation.y = elapsed * 0.06;
      particles.rotation.x = Math.sin(elapsed * 0.03) * 0.1;

      // Particle interaction + organic motion
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const i3 = i * 3;

        // Organic floating motion (in local space, add subtle oscillation)
        const phase = i * 0.37 + elapsed * 0.4;
        const floatX = Math.sin(phase) * 0.02;
        const floatY = Math.cos(phase * 0.7) * 0.025;
        const floatZ = Math.sin(phase * 0.5) * 0.015;

        // Mouse repulsion
        const dx = posArr[i3] - mouseWorld.x;
        const dy = posArr[i3 + 1] - mouseWorld.y;
        const dz = posArr[i3 + 2] - mouseWorld.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const repelRadius = 10;
        const repelStrength = 0.8;

        if (dist < repelRadius && dist > 0.01) {
          const force = (1 - dist / repelRadius) * repelStrength;
          velocities[i3] += (dx / dist) * force;
          velocities[i3 + 1] += (dy / dist) * force;
          velocities[i3 + 2] += (dz / dist) * force;
        }

        // Spring back to original + apply velocity
        const springK = 0.02;
        const damping = 0.92;

        velocities[i3] += (originalPositions[i3] - posArr[i3]) * springK;
        velocities[i3 + 1] += (originalPositions[i3 + 1] - posArr[i3 + 1]) * springK;
        velocities[i3 + 2] += (originalPositions[i3 + 2] - posArr[i3 + 2]) * springK;

        velocities[i3] *= damping;
        velocities[i3 + 1] *= damping;
        velocities[i3 + 2] *= damping;

        posArr[i3] += velocities[i3] + floatX;
        posArr[i3 + 1] += velocities[i3 + 1] + floatY;
        posArr[i3 + 2] += velocities[i3 + 2] + floatZ;
      }

      posAttr.needsUpdate = true;

      // Pulse core glow
      coreMat.opacity = 0.03 + Math.sin(elapsed * 1.5) * 0.015;
      core.scale.setScalar(1 + Math.sin(elapsed * 0.8) * 0.1);

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
      geometry.dispose();
      material.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div
        className="relative rounded-xl border border-white/[0.06] overflow-hidden"
        style={{ aspectRatio: "16 / 9" }}
      >
        <div ref={containerRef} className="absolute inset-0" />
        <div
          ref={overlayRef}
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10"
        >
          <h2 className="text-3xl md:text-5xl font-bold text-white/90 text-center drop-shadow-lg mb-3 select-none">
            {title}
          </h2>
          <p className="text-base md:text-lg text-white/50 text-center max-w-md select-none">
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}
