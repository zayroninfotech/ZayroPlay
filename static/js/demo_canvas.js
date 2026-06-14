// Animated demo bubble grid on the home page
(function () {
  const canvas = document.getElementById('demoCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const R = 20;
  const COLS = 8;
  const COLORS = ['#f472b6','#a78bfa','#34d399','#fbbf24','#38bdf8','#f87171','#4ade80'];

  const grid = [];
  for (let r = 0; r < 7; r++) {
    grid[r] = [];
    for (let c = 0; c < COLS; c++) {
      grid[r][c] = {
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        scale: 1,
        phase: Math.random() * Math.PI * 2,
        popping: false,
        popT: 0,
        alpha: 1,
      };
    }
  }

  // Randomly pop and respawn bubbles for animation
  setInterval(() => {
    const r = Math.floor(Math.random() * grid.length);
    const c = Math.floor(Math.random() * COLS);
    if (grid[r][c] && !grid[r][c].popping) {
      grid[r][c].popping = true;
      grid[r][c].popT = 0;
    }
  }, 600);

  function colX(c, r) { return R + c * (R * 2) + (r % 2 === 0 ? 0 : R); }
  function rowY(r)     { return R + r * (R * 1.73); }

  function drawBubble(x, y, color, scale, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const g = ctx.createRadialGradient(-R*0.3, -R*0.3, R*0.05, 0, 0, R);
    g.addColorStop(0, 'rgba(255,255,255,0.6)');
    g.addColorStop(0.45, color);
    g.addColorStop(1, shadeColor(color, -50));

    ctx.beginPath();
    ctx.arc(0, 0, R - 1, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(-R*0.28, -R*0.28, R*0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.shadowBlur = 0;
    ctx.fill();

    ctx.restore();
  }

  function shadeColor(hex, amt) {
    const n = parseInt(hex.replace('#',''),16);
    const r = Math.min(255,Math.max(0,(n>>16)+amt));
    const g = Math.min(255,Math.max(0,((n>>8)&0xFF)+amt));
    const b = Math.min(255,Math.max(0,(n&0xFF)+amt));
    return `rgb(${r},${g},${b})`;
  }

  let t = 0;
  function loop() {
    ctx.clearRect(0, 0, W, H);
    t += 0.03;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < COLS; c++) {
        const b = grid[r][c];
        if (!b) continue;
        const x = colX(c, r), y = rowY(r);
        const bob = Math.sin(t + b.phase) * 2.5;

        if (b.popping) {
          b.popT += 0.07;
          const sc = 1 + b.popT * 0.8;
          const al = Math.max(0, 1 - b.popT * 1.4);
          drawBubble(x, y + bob, b.color, sc, al);
          if (b.popT > 1) {
            b.popping = false;
            b.popT = 0;
            b.color = COLORS[Math.floor(Math.random() * COLORS.length)];
            b.phase = Math.random() * Math.PI * 2;
          }
        } else {
          drawBubble(x, y + bob, b.color, 1, 1);
        }
      }
    }
    requestAnimationFrame(loop);
  }
  loop();
})();
