import { useEffect, useRef } from "react";

type Mode = "play" | "ambient";
type Difficulty = "easy" | "normal";

type Gate = { x: number; gapY: number; glow: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; gold: boolean };

const SKY_TOP = "#8fd8f6";
const SKY_MID = "#c5ecfb";
const SKY_LOW = "#ffe3b8";
const SUN = "#e6a312";
const CLOUD = "#fffdf8";
const HILL_FAR = "#c5e6d2";
const HILL_NEAR = "#3e9a62";
const BIRD = "#128f84";
const BIRD_DEEP = "#0c6d64";
const BELLY = "#fff6ea";
const BEAK = "#e36a45";
const INK = "#16323a";
const GOLD = "#e6a312";

export function SkyCanvas({
  mode,
  difficulty,
  cheer,
  listening,
  reduced,
  paused,
  failed,
  reset,
  onCrash,
}: {
  mode: Mode;
  difficulty: Difficulty;
  cheer: number;
  listening: boolean;
  reduced: boolean;
  paused: boolean;
  failed: boolean;
  reset: number;
  onCrash: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({ mode, difficulty, cheer, listening, reduced, paused, failed, reset, onCrash });
  propsRef.current = { mode, difficulty, cheer, listening, reduced, paused, failed, reset, onCrash };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    let raf = 0;
    let last = performance.now();
    let width = 0;
    let height = 0;
    let cam = 0;
    let time = 0;
    let birdY = 0;
    let vy = 0;
    let ready = false;
    let lastCheer = propsRef.current.cheer;
    let lastReset = propsRef.current.reset;
    let wasFailed = false;
    let crashAt: number | null = null;
    let crashSent = false;
    const gates: Gate[] = [];
    const particles: Particle[] = [];
    let gateSerial = 0;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!ready && height > 0) {
        birdY = height * 0.42;
        ready = true;
        seedGates();
      }
    };

    const gapFor = (index: number) => {
      const easy = propsRef.current.difficulty === "easy";
      const inset = height * 0.22;
      const span = height * (easy ? 0.18 : 0.26);
      return inset + height * 0.28 + Math.sin(index * 1.35) * span;
    };

    const seedGates = () => {
      gates.length = 0;
      let x = width * 0.7;
      for (let i = 0; i < 5; i++) {
        gates.push({ x, gapY: gapFor(gateSerial), glow: 0 });
        gateSerial += 1;
        x += propsRef.current.difficulty === "easy" ? 360 : 300;
      }
    };

    const spawnParticles = (x: number, y: number) => {
      if (propsRef.current.reduced) return;
      for (let i = 0; i < 14; i++) {
        const angle = (Math.PI * 2 * i) / 14;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * (40 + (i % 4) * 18),
          vy: Math.sin(angle) * (40 + (i % 3) * 16) - 20,
          life: 0.7,
          gold: i % 2 === 0,
        });
      }
    };

    const updateParticles = (dt: number) => {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 40 * dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
    };

    const update = (dt: number) => {
      const props = propsRef.current;
      if (props.reset !== lastReset) {
        lastReset = props.reset;
        cam = 0; time = 0; birdY = height * 0.42; vy = 0; gateSerial = 0;
        crashAt = null; crashSent = false; wasFailed = false;
        seedGates();
      }
      if (props.cheer !== lastCheer) {
        lastCheer = props.cheer;
        vy = -150;
        spawnParticles(width * 0.32, birdY);
      }
      if (props.failed) {
        if (!wasFailed) { wasFailed = true; crashAt = null; vy = Math.max(90, vy); }
        time += dt;
        vy += 980 * dt;
        birdY += vy * dt;
        if (birdY >= height - 46) {
          birdY = height - 46; vy = 0;
          if (crashAt === null) { crashAt = time; spawnParticles(width * 0.32, birdY); }
          if (!crashSent && time - crashAt > 0.55) { crashSent = true; propsRef.current.onCrash(); }
        }
        updateParticles(dt);
        return;
      }
      wasFailed = false;
      const ambient = props.mode === "ambient";
      const easy = props.difficulty === "easy";
      const speed = ambient ? 28 : easy ? 78 : 118;
      cam += speed * dt;
      time += dt;
      const spacing = easy || ambient ? 360 : 300;
      while (gates.length && gates[0].x - cam < -160) {
        const lastGate = gates[gates.length - 1];
        gates.shift();
        gates.push({ x: lastGate.x + spacing, gapY: gapFor(gateSerial), glow: 0 });
        gateSerial += 1;
      }
      const birdX = width * 0.32;
      let desired = ambient ? height * 0.46 : height * 0.6;
      for (const gate of gates) {
        const screenX = gate.x - cam;
        if (screenX > birdX - 20) {
          desired = ambient ? gate.gapY * 0.45 + height * 0.22 : gate.gapY;
          break;
        }
      }
      if (!props.reduced && !ambient) desired += Math.sin(time * 2.1) * (easy ? 8 : 14);
      birdY += (desired - birdY) * Math.min(1, (ambient ? 1.4 : 2.4) * dt);
      birdY += vy * dt;
      vy *= Math.max(0, 1 - 2.4 * dt);
      const margin = 36;
      if (birdY < margin) birdY = margin;
      if (birdY > height - margin) birdY = height - margin;

      for (const gate of gates) {
        const screenX = gate.x - cam;
        const half = ambient ? height * 0.42 : height * (easy ? 0.3 : 0.24);
        const near = Math.abs(screenX - birdX) < 36;
        const outside = birdY < gate.gapY - half || birdY > gate.gapY + half;
        if (!ambient && near && outside) {
          birdY += (gate.gapY - birdY) * Math.min(1, 8 * dt);
          gate.glow = 1;
        }
        if (props.cheer === lastCheer && near && vy < -40) gate.glow = 1;
        gate.glow = Math.max(0, gate.glow - dt * 0.8);
      }

      updateParticles(dt);
    };

    const puff = (x: number, y: number, scale: number) => {
      ctx.beginPath();
      ctx.arc(x, y, 20 * scale, 0, Math.PI * 2);
      ctx.arc(x + 18 * scale, y + 4 * scale, 15 * scale, 0, Math.PI * 2);
      ctx.arc(x - 16 * scale, y + 6 * scale, 13 * scale, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawGates = () => {
      const ambient = propsRef.current.mode === "ambient";
      const easy = propsRef.current.difficulty === "easy";
      const half = ambient ? height * 0.42 : height * (easy ? 0.3 : 0.24);
      for (const gate of gates) {
        const x = gate.x - cam;
        if (x < -80 || x > width + 80) continue;
        ctx.fillStyle = gate.glow > 0.05 ? GOLD : CLOUD;
        ctx.globalAlpha = ambient ? 0.55 : 0.95;
        let y = -10;
        while (y < gate.gapY - half) {
          puff(x, y, 1.15);
          y += 28;
        }
        y = gate.gapY + half;
        while (y < height + 20) {
          puff(x, y, 1.15);
          y += 28;
        }
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = gate.glow > 0.05 ? GOLD : "rgba(22,50,58,0.18)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, gate.gapY, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };

    const drawBird = () => {
      const flap = propsRef.current.reduced ? 0.2 : Math.sin(time * (vy < -20 ? 14 : 7));
      const squash = 1 - Math.min(0.12, Math.abs(vy) / 900);
      const stretch = 1 + Math.min(0.08, Math.abs(vy) / 1100);
      ctx.save();
      ctx.translate(width * 0.32, birdY);
      if (propsRef.current.failed) ctx.rotate(0.48);
      ctx.scale(2.05 * stretch, 2.05 * squash);
      ctx.fillStyle = "rgba(22,50,58,0.12)";
      ctx.beginPath();
      ctx.ellipse(0, 30, 16, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.rotate(flap * 0.55);
      ctx.fillStyle = BIRD_DEEP;
      ctx.beginPath();
      ctx.ellipse(-8, 2, 18, 9, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = BIRD;
      ctx.beginPath();
      ctx.ellipse(0, 0, 30, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = BELLY;
      ctx.beginPath();
      ctx.ellipse(6, 5, 16, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.ellipse(2, 12, 12, 4.5, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(12, -4, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(13.6, -5.4, 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = BEAK;
      ctx.beginPath();
      ctx.moveTo(24, -2);
      ctx.lineTo(38, 2);
      ctx.lineTo(24, 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = BIRD_DEEP;
      ctx.beginPath();
      ctx.ellipse(-24, 2, 10, 7, 0.4, 0, Math.PI * 2);
      ctx.fill();
      if (propsRef.current.listening && !propsRef.current.reduced) {
        ctx.strokeStyle = GOLD;
        ctx.globalAlpha = 0.45 + 0.25 * Math.sin(time * 5);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(8, 0, 40 + Math.sin(time * 5) * 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    };

    const drawHills = (base: number, amp: number, color: string, parallax: number) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 10) {
        const y = height - base + Math.sin((x + cam * parallax) * 0.012) * amp + Math.sin((x + cam * parallax) * 0.004) * amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();
    };

    const draw = () => {
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, SKY_TOP);
      sky.addColorStop(0.55, SKY_MID);
      sky.addColorStop(1, SKY_LOW);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = SUN;
      ctx.beginPath();
      ctx.arc(width * 0.8, height * 0.14, Math.max(28, width * 0.07), 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = CLOUD;
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < 4; i++) {
        const x = ((i * 180 - cam * 0.25) % (width + 200)) + 40;
        const wrapped = x < -40 ? x + width + 200 : x;
        puff(wrapped, 70 + (i % 3) * 28, 0.85 + (i % 2) * 0.2);
      }
      ctx.globalAlpha = 1;

      drawHills(78, 16, HILL_FAR, 0.25);
      drawGates();
      drawHills(40, 12, HILL_NEAR, 0.45);
      drawBird();

      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.gold ? GOLD : BEAK;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (width < 2 || height < 2) return;
      const props = propsRef.current;
      if (!props.paused && !document.hidden) {
        let acc = dt;
        while (acc > 0.0001) {
          const step = Math.min(1 / 60, acc);
          update(step);
          acc -= step;
        }
      }
      draw();
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 h-full w-full" />;
}
