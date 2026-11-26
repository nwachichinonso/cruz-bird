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
const BIRD = "#69c9f4";
const BIRD_DEEP = "#267db8";
const BELLY = "#f4fbff";
const BEAK = "#f28b32";
const INK = "#16323a";
const GOLD = "#e6a312";

export function SkyCanvas({
  mode,
  difficulty,
  cheer,
  listening,
  lift,
  reduced,
  paused,
  failed,
  reset,
  onCrash,
  onHit,
}: {
  mode: Mode;
  difficulty: Difficulty;
  cheer: number;
  listening: boolean;
  lift: boolean;
  reduced: boolean;
  paused: boolean;
  failed: boolean;
  reset: number;
  onCrash: () => void;
  onHit: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({ mode, difficulty, cheer, listening, lift, reduced, paused, failed, reset, onCrash, onHit });
  propsRef.current = { mode, difficulty, cheer, listening, lift, reduced, paused, failed, reset, onCrash, onHit };

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
    let trapHit = false;
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
        crashAt = null; crashSent = false; wasFailed = false; trapHit = false;
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
      if (ambient) {
        const desired = height * 0.46 + Math.sin(time * 1.5) * 10;
        birdY += (desired - birdY) * Math.min(1, 1.4 * dt);
        vy = 0;
      } else {
        // Voice is the bird's lift: every spoken letter gives an upward burst.
        // Between calls gravity steadily pulls the bird down.
        if (props.lift) vy -= 620 * dt;
        else vy += 160 * dt;
        vy = Math.max(-260, Math.min(300, vy));
        birdY += vy * dt;
        if (birdY < 42) { birdY = 42; vy = Math.max(0, vy); }
        if (birdY > height - 48) { birdY = height - 48; vy = Math.min(0, vy); }
      }

      for (const gate of gates) {
        const screenX = gate.x - cam;
        const near = Math.abs(screenX - birdX) < 34;
        // Traps sit on the ground. The bird must actively stay above them.
        const trapTop = height - 112;
        const birdBottom = birdY + 30;
        if (!ambient && near && birdBottom > trapTop && !trapHit) {
          trapHit = true;
          propsRef.current.onHit();
        }
        if (near && vy < -40) gate.glow = 1;
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
      for (const trap of gates) {
        const x = trap.x - cam;
        if (x < -90 || x > width + 90) continue;
        const base = height - 30;
        const spikeWidth = 30;
        const count = 3;
        ctx.save();
        ctx.globalAlpha = ambient ? 0.5 : 1;
        // Heavy hazard base with repeated sharp spikes: a visible ground trap.
        ctx.fillStyle = trap.glow > 0.05 ? "#ffb02e" : "#b9343c";
        ctx.beginPath();
        ctx.roundRect(x - 48, base - 12, 96, 18, 7);
        ctx.fill();
        ctx.fillStyle = "#f7f1df";
        ctx.strokeStyle = "#7f2430";
        ctx.lineWidth = 2;
        for (let i = 0; i < count; i++) {
          const sx = x - 42 + i * spikeWidth;
          ctx.beginPath();
          ctx.moveTo(sx, base - 10);
          ctx.lineTo(sx + spikeWidth / 2, base - 76);
          ctx.lineTo(sx + spikeWidth, base - 10);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
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
      ctx.ellipse(0, 0, 30, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      // Soft feather tufts and layered wing detail inspired by the blue reference bird.
      ctx.fillStyle = "#9be0ff";
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.ellipse(-17 + i * 4, -19 - (i % 3) * 2, 5, 11, -0.45 + i * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#3f9bd0";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(-17 + i * 5, 7 + (i % 2) * 4, 7, 3, -0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = BELLY;
      ctx.beginPath();
      ctx.ellipse(6, 5, 16, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      ctx.ellipse(2, 12, 12, 4.5, 0.1, 0, Math.PI * 2);
      ctx.fill();
      // Big expressive eyes behind the signature round glasses.
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(8, -5, 8, 9, 0, 0, Math.PI * 2);
      ctx.ellipse(23, -5, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(10, -4, 4.3, 0, Math.PI * 2);
      ctx.arc(24, -4, 4.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(11.5, -5.5, 1.6, 0, Math.PI * 2);
      ctx.arc(25.5, -5.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#172c49";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(0, -15, 17, 20, 6);
      ctx.roundRect(17, -15, 15, 20, 6);
      ctx.moveTo(17, -7);
      ctx.lineTo(18, -7);
      ctx.stroke();
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

    const drawCity = () => {
      const base = height * 0.72;
      for (let i = 0; i < 11; i++) {
        const cycle = width + 180;
        const raw = (i * 112 - cam * 0.22) % cycle;
        const x = (raw + cycle) % cycle - 70;
        const w = 54 + (i % 3) * 18;
        const h = 85 + (i % 4) * 25;
        ctx.fillStyle = i % 2 ? "#79b9c5" : "#6aa7b8";
        ctx.globalAlpha = 0.42;
        ctx.fillRect(x, base - h, w, h);
        ctx.fillStyle = "#fff2bd";
        ctx.globalAlpha = 0.5;
        for (let wy = base - h + 14; wy < base - 12; wy += 19) {
          for (let wx = x + 10; wx < x + w - 5; wx += 17) ctx.fillRect(wx, wy, 6, 8);
        }
      }
      ctx.globalAlpha = 1;
    };

    const drawRunway = () => {
      const horizon = height * 0.77;
      ctx.fillStyle = "#27835e";
      ctx.fillRect(0, horizon, width, height - horizon);
      // Perspective railway inspired by the runner reference: sleepers and twin rails
      // converge toward the horizon while the camera scrolls forward.
      ctx.fillStyle = "#6b4734";
      ctx.beginPath();
      ctx.moveTo(width * 0.43, horizon);
      ctx.lineTo(width * 0.57, horizon);
      ctx.lineTo(width * 0.94, height);
      ctx.lineTo(width * 0.06, height);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 13; i++) {
        const t = ((i / 13 + (cam * 0.0016) % 1) % 1);
        const y = horizon + (height - horizon) * t * t;
        const half = 4 + t * width * 0.39;
        ctx.strokeStyle = "#b77a4b";
        ctx.lineWidth = 2 + t * 12;
        ctx.beginPath();
        ctx.moveTo(width / 2 - half, y);
        ctx.lineTo(width / 2 + half, y);
        ctx.stroke();
      }
      for (const side of [-1, 1]) {
        ctx.strokeStyle = "#a9b9c4";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(width * (0.5 + side * 0.035), horizon);
        ctx.lineTo(width * (0.5 + side * 0.34), height);
        ctx.stroke();
        ctx.strokeStyle = "#526b7c";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(width * (0.5 + side * 0.035) - 2, horizon);
        ctx.lineTo(width * (0.5 + side * 0.34) - 2, height);
        ctx.stroke();
      }
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

    const drawTreeLine = () => {
      for (let i = 0; i < 7; i++) {
        const cycle = width + 250;
        const rawX = (i * 178 - cam * 0.52) % cycle;
        const x = (rawX + cycle) % cycle - 90;
        const scale = 0.58 + (i % 3) * 0.16;
        const base = height - 26;
        ctx.save();
        ctx.translate(x, base);
        ctx.scale(scale, scale);
        ctx.fillStyle = "#8b5a3c";
        ctx.fillRect(-5, -55, 10, 58);
        ctx.fillStyle = i % 2 ? "#239b72" : "#42b96f";
        ctx.beginPath();
        ctx.arc(0, -70, 27, 0, Math.PI * 2);
        ctx.arc(-19, -57, 19, 0, Math.PI * 2);
        ctx.arc(19, -57, 19, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.beginPath();
        ctx.arc(-8, -79, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
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

      drawCity();
      drawHills(78, 16, HILL_FAR, 0.25);
      drawTreeLine();
      drawHills(40, 12, HILL_NEAR, 0.45);
      drawRunway();
      drawGates();
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
