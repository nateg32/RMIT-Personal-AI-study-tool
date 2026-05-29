"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { cn } from "@/lib/utils";

type DottedSurfaceProps = Omit<React.ComponentProps<"div">, "ref">;

function getCanvasSize() {
  return {
    width: Math.max(window.innerWidth, 320),
    height: Math.max(window.innerHeight, 320),
  };
}

export function DottedSurface({ className, ...props }: DottedSurfaceProps) {
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const separation = 190;
    const amountX = 26;
    const amountY = 32;
    const { width, height } = getCanvasSize();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 10000);
    camera.position.set(0, 520, 1540);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.pointerEvents = "none";
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];
    const dark = resolvedTheme === "dark";
    const palette = dark
      ? [
          [0.22, 0.71, 0.55],
          [0.49, 0.59, 0.95],
          [0.89, 0.63, 0.23],
        ]
      : [
          [0.06, 0.48, 0.35],
          [0.2, 0.35, 0.78],
          [0.72, 0.47, 0.07],
        ];

    for (let ix = 0; ix < amountX; ix++) {
      for (let iy = 0; iy < amountY; iy++) {
        positions.push(
          ix * separation - (amountX * separation) / 2,
          0,
          iy * separation - (amountY * separation) / 2,
        );
        const color = palette[(ix + iy) % palette.length];
        colors.push(color[0], color[1], color[2]);
      }
    }

    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: dark ? 8 : 7,
      vertexColors: true,
      transparent: true,
      opacity: dark ? 0.34 : 0.24,
      sizeAttenuation: true,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    points.rotation.x = -0.08;
    scene.add(points);

    let frameId = 0;
    let count = 0;
    let pageVisible = !document.hidden;

    const renderFrame = () => {
      const positionAttribute = geometry.attributes.position;
      const nextPositions = positionAttribute.array as Float32Array;
      let particleIndex = 0;

      for (let ix = 0; ix < amountX; ix++) {
        for (let iy = 0; iy < amountY; iy++) {
          const index = particleIndex * 3;
          nextPositions[index + 1] =
            Math.sin((ix + count) * 0.28) * 42 + Math.sin((iy + count) * 0.42) * 36;
          particleIndex++;
        }
      }

      positionAttribute.needsUpdate = true;
      renderer.render(scene, camera);
      count += 0.055;
    };

    let lastRender = 0;
    const animate = (timestamp = 0) => {
      if (!pageVisible) {
        frameId = 0;
        return;
      }
      if (timestamp - lastRender > 33) {
        renderFrame();
        lastRender = timestamp;
      }
      frameId = window.requestAnimationFrame(animate);
    };

    const handleResize = () => {
      const nextSize = getCanvasSize();
      camera.aspect = nextSize.width / nextSize.height;
      camera.updateProjectionMatrix();
      renderer.setSize(nextSize.width, nextSize.height);
      renderer.render(scene, camera);
    };

    const handleVisibilityChange = () => {
      pageVisible = !document.hidden;
      if (pageVisible && !reducedMotion && !frameId) {
        frameId = window.requestAnimationFrame(animate);
      } else if (!pageVisible && frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }
    };

    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (reducedMotion) {
      renderFrame();
    } else {
      animate();
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (frameId) window.cancelAnimationFrame(frameId);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [resolvedTheme]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn("pointer-events-none fixed inset-0 z-0 select-none overflow-hidden", className)}
      {...props}
    />
  );
}
