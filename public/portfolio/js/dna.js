/* DNA helix — particle pairing in canvas, base pairs labelled (A·T / G·C). */
(function () {
  const cv = document.getElementById('dna-canvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    const r = cv.getBoundingClientRect();
    W = Math.floor(r.width); H = Math.floor(r.height);
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(cv);
  resize();

  const PAIRS = ['A·T', 'T·A', 'G·C', 'C·G', 'A·T', 'G·C'];
  const N = 38;          // rungs
  const RADIUS = 70;     // helix radius (px)
  const SPACING = 18;    // px between rungs
  const PERIOD = 4.6;    // seconds per rotation

  let t0 = performance.now();
  function frame() {
    const t = (performance.now() - t0) / 1000;
    ctx.clearRect(0, 0, W, H);

    // Vignette gradient backdrop
    const grad = ctx.createRadialGradient(W * 0.5, H * 0.5, 20, W * 0.5, H * 0.5, Math.max(W, H) * 0.7);
    grad.addColorStop(0, 'rgba(42,111,163,0.18)');
    grad.addColorStop(1, 'rgba(12,20,36,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2;
    const startY = H * 0.5 - (N * SPACING) / 2;

    // Draw rungs first (under spheres)
    for (let i = 0; i < N; i++) {
      const phase = i * 0.45 + (t * (Math.PI * 2 / PERIOD));
      const x1 = cx + Math.cos(phase) * RADIUS;
      const x2 = cx - Math.cos(phase) * RADIUS;
      const y = startY + i * SPACING;
      const z1 = Math.sin(phase);    // -1..1
      const z2 = -z1;
      const alpha = 0.18 + 0.4 * (Math.max(z1, z2) * 0.5 + 0.5);

      ctx.strokeStyle = `rgba(217,119,87,${alpha.toFixed(3)})`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();

      // base-pair label every 4th rung at center
      if (i % 5 === 2) {
        ctx.fillStyle = `rgba(217,119,87,${(alpha + 0.2).toFixed(3)})`;
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(PAIRS[(i / 5 | 0) % PAIRS.length], cx, y - 3);
      }
    }

    // Draw spheres on each strand — depth-sort
    const points = [];
    for (let i = 0; i < N; i++) {
      const phase = i * 0.45 + (t * (Math.PI * 2 / PERIOD));
      const y = startY + i * SPACING;
      points.push({
        x: cx + Math.cos(phase) * RADIUS,
        y, z: Math.sin(phase), strand: 0, idx: i
      });
      points.push({
        x: cx - Math.cos(phase) * RADIUS,
        y, z: -Math.sin(phase), strand: 1, idx: i
      });
    }
    points.sort((a, b) => a.z - b.z); // back-to-front

    points.forEach(p => {
      const depth = (p.z + 1) / 2;        // 0..1
      const r = 2.4 + depth * 2.8;
      const alpha = 0.45 + depth * 0.55;
      const color = p.strand === 0 ? '232,238,247' : '111,154,209';
      ctx.fillStyle = `rgba(${color},${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      // bright core
      if (depth > 0.7) {
        ctx.fillStyle = `rgba(255,255,255,${(depth - 0.6).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(p.x - r * 0.3, p.y - r * 0.3, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Background drifting particles (cosmic dust)
    for (let i = 0; i < 40; i++) {
      const px = ((i * 73 + t * 8) % W);
      const py = ((i * 41 + t * 4) % H);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(px, py, 1, 1);
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
