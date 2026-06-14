/* hero_anim.js — ZayroPlay Neon City Gaming Animation v2 */
(function () {
  const canvas = document.getElementById('heroAnimCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 560, H = 400;
  canvas.width = W; canvas.height = H;

  const logo = new Image();
  logo.src = canvas.dataset.logo;

  const rand = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  /* ══ 1. STAR FIELD ══════════════════════════════════════════════════════ */
  const STARS = Array.from({ length: 120 }, () => ({
    x: rand(0, W), y: rand(0, H),
    r: rand(0.4, 2),
    speed: rand(0.1, 0.5),
    twinkle: rand(0, TAU),
  }));

  function drawStars(t) {
    STARS.forEach(s => {
      s.x -= s.speed;
      if (s.x < 0) { s.x = W; s.y = rand(0, H); }
      const alpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.2 + s.twinkle));
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    });
  }

  /* ══ 2. NEON GRID FLOOR ═════════════════════════════════════════════════ */
  function drawGrid(t) {
    ctx.save();
    const VPX = W / 2, VPY = H * 0.58;
    const ROWS = 10, COLS = 14;
    const offset = (t * 30) % (H / ROWS);

    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth = 0.7;
    ctx.shadowColor = '#a78bfa';
    ctx.shadowBlur = 4;
    ctx.globalAlpha = 0.5;

    // Horizontal lines
    for (let i = 0; i <= ROWS; i++) {
      const prog = (i / ROWS);
      const y = VPY + (H - VPY) * prog + offset * prog;
      if (y > H) continue;
      const lx = lerp(VPX, 0, prog);
      const rx = lerp(VPX, W, prog);
      ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(rx, y); ctx.stroke();
    }
    // Vertical lines
    for (let j = 0; j <= COLS; j++) {
      const prog = j / COLS;
      const bx = lerp(0, W, prog);
      ctx.beginPath();
      ctx.moveTo(VPX, VPY);
      ctx.lineTo(bx, H);
      ctx.stroke();
    }
    ctx.restore();
  }

  const lerp = (a, b, t) => a + (b - a) * t;

  /* ══ 3. FLOATING GAME CARDS ═════════════════════════════════════════════ */
  const CARDS = [
    { emoji:'♟️', label:'Chess',   color:'#8b5cf6', x:60,  y:80,  delay:0    },
    { emoji:'🎲', label:'Ludo',    color:'#f97316', x:460, y:70,  delay:0.4  },
    { emoji:'🎱', label:'8 Ball',  color:'#06b6d4', x:30,  y:220, delay:0.8  },
    { emoji:'🪙', label:'Carrom',  color:'#f59e0b', x:490, y:210, delay:1.2  },
    { emoji:'🫧', label:'Bubbles', color:'#ec4899', x:75,  y:330, delay:1.6  },
    { emoji:'🐍', label:'Snake',   color:'#10b981', x:470, y:330, delay:2.0  },
  ];

  function drawCards(t) {
    CARDS.forEach(c => {
      const phase = Math.max(0, t - c.delay);
      const appear = Math.min(phase * 2, 1); // 0→1 in 0.5s
      if (appear <= 0) return;
      const bob = Math.sin(t * 1.4 + c.delay) * 7;
      const cx = c.x, cy = c.y + bob;
      const w = 68, h = 68;

      ctx.save();
      ctx.globalAlpha = appear * 0.9;
      ctx.translate(cx, cy);

      // Card glow
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 18;

      // Card background
      ctx.fillStyle = '#1e1b4bcc';
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 1.5;
      roundRect(ctx, -w/2, -h/2, w, h, 12);
      ctx.fill();
      ctx.stroke();

      // Emoji
      ctx.shadowBlur = 8;
      ctx.font = '26px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(c.emoji, 0, -8);

      // Label
      ctx.shadowBlur = 0;
      ctx.font = 'bold 10px Orbitron, sans-serif';
      ctx.fillStyle = c.color;
      ctx.fillText(c.label, 0, 20);

      ctx.restore();
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ══ 4. CONNECTION LINES (cards → logo) ════════════════════════════════ */
  function drawLines(t) {
    CARDS.forEach((c, i) => {
      const phase = Math.max(0, t - c.delay);
      const appear = Math.min(phase * 2, 1);
      if (appear < 0.5) return;
      const bob = Math.sin(t * 1.4 + c.delay) * 7;
      const pulse = 0.3 + 0.3 * Math.sin(t * 3 + i);

      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = -t * 20;
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = (appear - 0.5) * 2 * pulse;
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(c.x, c.y + bob);
      ctx.lineTo(W / 2, H / 2 - 10);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    });
  }

  /* ══ 5. LOGO CENTER ══════════════════════════════════════════════════════ */
  function drawLogo(t) {
    if (!logo.complete || !logo.naturalWidth) return;
    const size = 160 + 6 * Math.sin(t * 1.5);
    const cx = W / 2, cy = H / 2 - 10;

    // Outer pulse rings
    for (let i = 0; i < 3; i++) {
      const phase = ((t * 0.5) + i / 3) % 1;
      const r = lerp(75, 130, phase);
      const alpha = (1 - phase) * 0.4;
      ctx.save();
      ctx.strokeStyle = `rgba(167,139,250,${alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // Spinning arc ring
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.8);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 15;
    ctx.setLineDash([25, 15]);
    ctx.beginPath();
    ctx.arc(0, 0, 88, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-t * 0.5);
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#a78bfa';
    ctx.shadowBlur = 8;
    ctx.setLineDash([10, 20]);
    ctx.beginPath();
    ctx.arc(0, 0, 100, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Logo image
    ctx.save();
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 30 + 12 * Math.sin(t * 2);
    ctx.drawImage(logo, cx - size/2, cy - size/2, size, size);
    ctx.restore();
  }

  /* ══ 6. SCORE COUNTER (animated) ════════════════════════════════════════ */
  let scoreVal = 0;
  function drawScoreCounter(t) {
    scoreVal = Math.floor(t * 1800) % 99999;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px Orbitron, sans-serif';
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 8;
    ctx.fillText(`⭐ ${String(scoreVal).padStart(5,'0')}`, W / 2, H - 52);
    ctx.restore();
  }

  /* ══ 7. BRAND FOOTER ═════════════════════════════════════════════════════ */
  function drawBrand(t) {
    ctx.save();
    ctx.textAlign = 'center';

    const grd = ctx.createLinearGradient(W/2-70, 0, W/2+70, 0);
    grd.addColorStop(0,   '#a78bfa');
    grd.addColorStop(0.5, '#f97316');
    grd.addColorStop(1,   '#fbbf24');
    ctx.font = 'bold 20px Orbitron, sans-serif';
    ctx.fillStyle = grd;
    ctx.shadowColor = '#7c3aed';
    ctx.shadowBlur = 10;
    ctx.fillText('ZayroPlay', W/2, H - 30);

    ctx.font = '10px Exo 2, sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.75)';
    ctx.shadowBlur = 0;
    ctx.fillText('Zayron Infotech Pvt. Ltd.', W/2, H - 14);
    ctx.restore();
  }

  /* ══ MAIN LOOP ═══════════════════════════════════════════════════════════ */
  let startTime = null;
  function frame(ts) {
    if (!startTime) startTime = ts;
    const t = (ts - startTime) / 1000;

    // Background
    ctx.fillStyle = '#06040f';
    ctx.fillRect(0, 0, W, H);

    drawStars(t);
    drawGrid(t);
    drawLines(t);
    drawCards(t);
    drawLogo(t);
    drawScoreCounter(t);
    drawBrand(t);

    requestAnimationFrame(frame);
  }

  logo.onload = () => requestAnimationFrame(frame);
  if (logo.complete && logo.naturalWidth) requestAnimationFrame(frame);
})();
