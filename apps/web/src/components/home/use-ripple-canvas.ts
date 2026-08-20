'use client';

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

interface Field {
  a: Float32Array;
  b: Float32Array;
}

interface Drop {
  x: number;
  y: number;
  vy: number;
  size: number;
  targetY: number;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  r: number;
}

/**
 * Hero 水波 canvas 动画（移植自原型 startRipples）：
 * 双波（毛细波+重力波）水面模拟，世界空间为正圆、渲染时垂直压缩为椭圆；
 * 随机雨滴入水、鼠标移动微扰、点击溅落；卸载时 cancelAnimationFrame + removeEventListener。
 */
export function useRippleCanvas(): RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const host = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    if (!ctx || !host) return;

    const CELL = 4;
    const SQ = 0.34; // 垂直压缩比 —— 圆形波纹显示为椭圆
    let W = 0;
    let H = 0;
    let cols = 0;
    let rows = 0;
    let cap: Field;
    let grav: Field;
    let off: HTMLCanvasElement;
    let octx: CanvasRenderingContext2D | null = null;
    let imgData: ImageData | null = null;
    let rafId = 0;
    const drops: Drop[] = [];
    const sparks: Spark[] = [];

    const mkField = (): Field => ({
      a: new Float32Array(cols * rows),
      b: new Float32Array(cols * rows),
    });

    const step = (f: Field, damp: number) => {
      const c = f.a;
      const p = f.b;
      for (let y = 1; y < rows - 1; y++) {
        const row = y * cols;
        for (let x = 1; x < cols - 1; x++) {
          const i = row + x;
          p[i] = ((c[i - 1] + c[i + 1] + c[i - cols] + c[i + cols]) * 0.5 - p[i]) * damp;
        }
      }
      f.a = p;
      f.b = c;
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.max(4, Math.ceil(W / CELL));
      rows = Math.max(4, Math.ceil(H / SQ / CELL)); // 世界高度 = 屏幕高度 / SQ
      cap = mkField();
      grav = mkField();
      off = document.createElement('canvas');
      off.width = cols;
      off.height = rows;
      octx = off.getContext('2d');
      imgData = octx ? octx.createImageData(cols, rows) : null;
    };
    resize();
    window.addEventListener('resize', resize);

    // 屏幕 y → 世界 y（去压缩）
    const s2wy = (sy: number) => sy / SQ;

    const disturb = (f: Field, wx: number, wy: number, radius: number, strength: number) => {
      const F = f.a;
      const cx = wx / CELL;
      const cy = wy / CELL;
      const r = radius / CELL;
      const x0 = Math.max(1, Math.floor(cx - r));
      const x1 = Math.min(cols - 2, Math.ceil(cx + r));
      const y0 = Math.max(1, Math.floor(cy - r));
      const y1 = Math.min(rows - 2, Math.ceil(cy + r));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const d = Math.hypot(x - cx, y - cy) / r;
          if (d <= 1) F[y * cols + x] -= strength * (Math.cos(d * Math.PI) + 1) * 0.5;
        }
      }
    };

    // 入水：散开范围与纹路深度都随水滴大小变化
    const splashAt = (wx: number, wy: number, size: number) => {
      disturb(cap, wx, wy, 3 + size * 3.5, 2 + size * 3); // 毛细波：细密、深
      disturb(grav, wx, wy, 6 + size * 6, 1 + size * 2); // 重力波：宽缓、持久
    };

    const toLocal = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    let lastMove = 0;
    const onMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      if (now - lastMove < 34) return;
      lastMove = now;
      const p = toLocal(e);
      disturb(cap, p.x, s2wy(p.y), 4, 0.8);
    };
    const onClick = (e: MouseEvent) => {
      const p = toLocal(e);
      splashAt(p.x, s2wy(p.y), 2.5);
    };
    host.addEventListener('mousemove', onMouseMove);
    host.addEventListener('click', onClick);

    let nextDrop = performance.now() + 400;
    let nextAmbient = performance.now() + 1500;
    let last = 0;

    const tick = (t: number) => {
      if (t - last < 24) {
        rafId = requestAnimationFrame(tick); // ~40fps
        return;
      }
      last = t;
      // ---- 下雨：大小 / 速度 / 间隔 / 落点全随机，大滴更快更重 ----
      if (t >= nextDrop && W > 0) {
        const size = 1 + Math.random() * 3.5;
        drops.push({
          x: W * 0.05 + Math.random() * W * 0.9,
          y: -14,
          vy: 1.2 + size * 0.55 + Math.random() * 1.1,
          size,
          targetY: H * (0.32 + Math.random() * 0.6),
        });
        nextDrop = t + 700 + Math.random() * 2200;
      }
      // ---- 环境微扰 ----
      if (t >= nextAmbient && W > 0) {
        disturb(grav, Math.random() * W, Math.random() * rows * CELL, 7, 0.5 + Math.random() * 0.7);
        nextAmbient = t + 1400 + Math.random() * 2400;
      }
      // ---- 波动方程：毛细波快、衰减快；重力波慢、持久 ----
      step(cap, 0.95);
      step(grav, 0.988);
      // ---- 光影：由高度场梯度计算，左上光源 ----
      if (imgData && octx) {
        const px = imgData.data;
        const C = cap.a;
        const G = grav.a;
        for (let y = 1; y < rows - 1; y++) {
          const row = y * cols;
          for (let x = 1; x < cols - 1; x++) {
            const i = row + x;
            const light =
              (C[i - 1] - C[i + 1] + (G[i - 1] - G[i + 1]) * 0.65) * 0.9 +
              (C[i - cols] - C[i + cols] + (G[i - cols] - G[i + cols]) * 0.65) * 0.7;
            const o = i * 4;
            if (light > 0.008) {
              px[o] = 250;
              px[o + 1] = 252;
              px[o + 2] = 244;
              px[o + 3] = Math.min(200, light * 230);
            } else if (light < -0.008) {
              px[o] = 70;
              px[o + 1] = 88;
              px[o + 2] = 48;
              px[o + 3] = Math.min(170, -light * 190);
            } else {
              px[o + 3] = 0;
            }
          }
        }
        octx.putImageData(imgData, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.imageSmoothingEnabled = true;
        // 整幅垂直压缩绘制：正圆波纹 → 椭圆
        ctx.drawImage(off, 0, 0, cols, rows, 0, 0, W, rows * CELL * SQ);
      }
      // ---- 水滴垂直下落（带高光）----
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.y += d.vy;
        d.vy += 0.055;
        const stretch = Math.min(2.4, 1 + d.vy * 0.12);
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.size * 0.62, d.size * stretch, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(96,116,66,.6)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(d.x - d.size * 0.22, d.y - d.size * stretch * 0.42, d.size * 0.26, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.fill();
        if (d.y >= d.targetY) {
          drops.splice(i, 1);
          splashAt(d.x, s2wy(d.targetY), d.size);
          const n = 2 + Math.round(Math.random() * d.size);
          for (let k = 0; k < n; k++) {
            sparks.push({
              x: d.x,
              y: d.targetY,
              vx: (Math.random() - 0.5) * 1.8,
              vy: -(0.8 + Math.random() * d.size * 0.6),
              life: 1,
              r: 0.5 + Math.random(),
            });
          }
        }
      }
      // ---- 水花粒子：回落激起次级小涟漪 ----
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.1;
        s.life -= 0.035;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        if (s.vy > 0 && s.life < 0.5) {
          disturb(cap, s.x, s2wy(s.y), 2.5, 0.5);
          sparks.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(107,127,67,${(s.life * 0.65).toFixed(2)})`;
        ctx.fill();
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      host.removeEventListener('mousemove', onMouseMove);
      host.removeEventListener('click', onClick);
    };
  }, []);

  return canvasRef;
}
