import { useEffect, useMemo, useRef, useState } from "react";
import { Application, extend, type PixiReactElementProps } from "@pixi/react";
import { Graphics } from "pixi.js";
import { FAMILY_COLOR } from "./boardPalette";

extend({ Graphics });

type GraphicsDraw = NonNullable<PixiReactElementProps<typeof Graphics>["draw"]>;

interface Particle {
  x: number;
  y: number;
  vy: number;
  size: number;
  color: number;
  rot: number;
  vr: number;
  phase: number;
}

function hexColor(value: string): number {
  return value.startsWith("#") ? Number.parseInt(value.slice(1), 16) : 0xe7b53e;
}

function spawn(width: number, height: number, colors: number[], y?: number): Particle {
  return {
    x: Math.random() * width,
    y: y ?? height + 20,
    vy: 8 + Math.random() * 18,
    size: 3 + Math.random() * 9,
    color: colors[Math.floor(Math.random() * colors.length)] ?? 0xe7b53e,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.6,
    phase: Math.random() * Math.PI * 2,
  };
}

export function ReactTitleBackground({ active }: { active: boolean }) {
  const particles = useRef<Particle[]>([]);
  const [frame, setFrame] = useState(0);
  const [size, setSize] = useState(() => ({
    width: Math.max(1, window.innerWidth),
    height: Math.max(1, window.innerHeight),
  }));
  const colors = useMemo(() => Object.values(FAMILY_COLOR).map(hexColor), []);

  useEffect(() => {
    const resize = () => {
      setSize({
        width: Math.max(1, window.innerWidth),
        height: Math.max(1, window.innerHeight),
      });
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    particles.current = Array.from({ length: 46 }, () => spawn(size.width, size.height, colors, Math.random() * size.height));
  }, [colors, size.height, size.width]);

  useEffect(() => {
    if (!active) return undefined;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      particles.current = particles.current.map((particle) => {
        const next = {
          ...particle,
          y: particle.y - particle.vy * dt,
          rot: particle.rot + particle.vr * dt,
          phase: particle.phase + dt,
        };
        return next.y < -30 ? spawn(size.width, size.height, colors) : next;
      });
      setFrame((value) => (value + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active, colors, size.height, size.width]);

  const draw = useMemo<GraphicsDraw>(() => (g) => {
    g.clear();
    g.rect(0, 0, size.width, size.height).fill({ color: 0x0c0f14, alpha: 1 });
    g.circle(size.width / 2, size.height * 0.42, Math.min(size.width, size.height) * 0.34)
      .fill({ color: 0xf4c95a, alpha: 0.055 });
    g.circle(size.width / 2, size.height * 0.42, Math.min(size.width, size.height) * 0.2)
      .fill({ color: 0xd98b3a, alpha: 0.045 });

    for (const particle of particles.current) {
      const alpha = Math.max(0.08, 0.35 + Math.sin(particle.phase * 2) * 0.2);
      const cos = Math.cos(particle.rot);
      const sin = Math.sin(particle.rot);
      const base = [
        [0, -particle.size],
        [particle.size * 0.6, 0],
        [0, particle.size],
        [-particle.size * 0.6, 0],
      ];
      const points = base.flatMap(([x, y]) => [
        particle.x + x * cos - y * sin,
        particle.y + x * sin + y * cos,
      ]);
      g.poly(points).fill({ color: particle.color, alpha });
    }
  }, [frame, size.height, size.width]);

  return (
    <div className="title-bg-pixi" aria-hidden="true">
      <Application width={size.width} height={size.height} backgroundAlpha={0} antialias>
        <pixiGraphics draw={draw} />
      </Application>
    </div>
  );
}
