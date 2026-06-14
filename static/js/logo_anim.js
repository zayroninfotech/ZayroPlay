/* logo_anim.js — Animated hero canvas for ZayroPlay logo */
(function () {
  const canvas = document.getElementById('logoAnimCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width  = 420;
  const H = canvas.height = 420;
  const CX = W / 2, CY = H / 2;

  const logo = new Image();
  logo.src = canvas.dataset.logo;

  // ── Particles ──────────────────────────────────────────────────────────────
  const PARTICLES = [];
  function spawnParticle() {
    const angle = Math.random() * Math.PI * 2;
    const radius = 130 + Math.random() * 30;
    PARTICLES.push({
      x: CX + Math.cos(angle) * radius,
      y: CY + Math.sin(angle) * radius,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -1.5 - Math.random() * 2,
      life: 1,
      decay: 0.012 + Math.random() * 0.015,
      size: 3 + Math.random() * 5,
      hue: 20 + Math.random() * 40,   // orange-yellow fire
    });
  }

  // ── Rings ──────────────────────────────────────────────────────────────────
  let ringAngle = 0;

  function drawRings(t) {
    // Outer spinning gradient ring
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(ringAngle);
    const grad = ctx.createConicalGradient
      ? null   // fallback below
      : null;

    // Draw 3 arcs with different rotations
    const rings = [
      { r: 160, w: 4,  alpha: 0.7, color: '#f97316', speed: 0.008 },
      { r: 150, w: 3,  alpha: 0.5, color: '#a78bfa', speed: -0.012 },
      { r: 170, w: 2,  alpha: 0.4, color: '#fbbf24', speed: 0.015 },
    ];

    rings.forEach((ring, i) => {
      ctx.save();
      ctx.rotate(t * ring.speed * 60);
      ctx.strokeStyle = ring.color;
      ctx.globalAlpha = ring.alpha * (0.7 + 0.3 * Math.sin(t * 2 + i));
      ctx.lineWidth = ring.w;
      ctx.setLineDash([30, 15, 10, 20]);
      ctx.lineDashOffset = t * 40;
      ctx.beginPath();
      ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    });
    ctx.restore();
  }

  function drawGlow(t) {
    // Pulsing glow behind logo
    const pulse = 0.6 + 0.4 * Math.sin(t * 2);
    const grd = ctx.createRadialGradient(CX, CY, 20, CX, CY, 150);
    grd.addColorStop(0,   `rgba(124,58,237,${0.35 * pulse})`);
    grd.addColorStop(0.5, `rgba(249,115,22,${0.15 * pulse})`);
    grd.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(CX, CY, 150, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawParticles() {
    PARTICLES.forEach((p, i) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) { PARTICLES.splice(i, 1); return; }
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = `hsl(${p.hue},100%,60%)`;
      ctx.shadowColor = `hsl(${p.hue},100%,60%)`;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawEnergyBursts(t) {
    // 6 energy spokes rotating
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(t * 0.3);
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i / 6) * Math.PI * 2);
      const alpha = 0.15 + 0.1 * Math.sin(t * 3 + i);
      const grd = ctx.createLinearGradient(0, 0, 0, -160);
      grd.addColorStop(0,   `rgba(249,115,22,${alpha})`);
      grd.addColorStop(0.6, `rgba(124,58,237,${alpha * 0.5})`);
      grd.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, -160);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawStars(t) {
    // Twinkling stars around the ring
    const starPositions = [
      [200, 80], [230, 200], [200, 320], [100, 350],
      [30, 250], [50, 130], [150, 20], [280, 130],
    ];
    starPositions.forEach(([sx, sy], i) => {
      const alpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i * 0.9));
      const size  = 1.5 + 1.5 * Math.abs(Math.sin(t + i));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // ── Main loop ──────────────────────────────────────────────────────────────
  let startTime = null;
  function frame(ts) {
    if (!startTime) startTime = ts;
    const t = (ts - startTime) / 1000;

    ctx.clearRect(0, 0, W, H);

    drawEnergyBursts(t);
    drawGlow(t);
    drawRings(t);
    drawStars(t);

    // Spawn fire particles
    if (Math.random() < 0.4) spawnParticle();
    drawParticles();

    // Draw logo on top
    if (logo.complete && logo.naturalWidth > 0) {
      const logoSize = 220 + 8 * Math.sin(t * 1.5);
      const logoX = CX - logoSize / 2;
      const logoY = CY - logoSize / 2;
      ctx.save();
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 30 + 10 * Math.sin(t * 2);
      ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
      ctx.restore();
    }

    ringAngle += 0.002;
    requestAnimationFrame(frame);
  }

  logo.onload = () => requestAnimationFrame(frame);
  // If already cached
  if (logo.complete && logo.naturalWidth > 0) requestAnimationFrame(frame);
})();
