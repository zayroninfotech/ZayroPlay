// ── Candy Crush Game Engine ────────────────────────────────────────────────
(function () {
  const canvas = document.getElementById('candyCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // DOM
  const scoreEl   = document.getElementById('cScoreDisplay');
  const levelEl   = document.getElementById('cLevelDisplay');
  const movesEl   = document.getElementById('cMovesDisplay');
  const targetEl  = document.getElementById('cTargetDisplay');
  const bestEl    = document.getElementById('cBestDisplay');
  const fillEl    = document.getElementById('movesFill');
  const overlay   = document.getElementById('cOverlay');
  const oTitle    = document.getElementById('cOverlayTitle');
  const oSub      = document.getElementById('cOverlaySub');
  const startBtn  = document.getElementById('cStartBtn');
  const startLbl  = document.getElementById('cStartLabel');
  const scoreForm = document.getElementById('cScoreForm');
  const finalEl   = document.getElementById('cFinalScore');
  const nameIn    = document.getElementById('cNameInput');
  const submitBtn = document.getElementById('cSubmitBtn');
  const submitRes = document.getElementById('cSubmitResult');

  // ── Constants ────────────────────────────────────────────────────────────
  const COLS = 8, ROWS = 8;
  const CELL = Math.floor(Math.min(W / COLS, H / ROWS));
  const OX   = Math.floor((W - COLS * CELL) / 2);
  const OY   = Math.floor((H - ROWS * CELL) / 2);

  const CANDIES = [
    { color: '#ef4444', shadow: '#b91c1c', label: '🔴', name: 'red' },
    { color: '#f97316', shadow: '#c2410c', label: '🟠', name: 'orange' },
    { color: '#facc15', shadow: '#ca8a04', label: '🟡', name: 'yellow' },
    { color: '#4ade80', shadow: '#16a34a', label: '🟢', name: 'green' },
    { color: '#38bdf8', shadow: '#0284c7', label: '🔵', name: 'blue' },
    { color: '#c084fc', shadow: '#7e22ce', label: '🟣', name: 'purple' },
    { color: '#f472b6', shadow: '#be185d', label: '🩷', name: 'pink' },
  ];

  // ── State ────────────────────────────────────────────────────────────────
  let board = [], score = 0, moves = 30, level = 1, target = 500, best = 0;
  let selected = null, gameActive = false, animId = null;
  let particles = [], fallingCells = [], flashCells = [];
  let maxMoves = 30, cascade = 0;

  // ── Board ────────────────────────────────────────────────────────────────
  function rndCandy() { return Math.floor(Math.random() * Math.min(5 + level, CANDIES.length)); }

  function initBoard() {
    board = [];
    for (let r = 0; r < ROWS; r++) {
      board[r] = [];
      for (let c = 0; c < COLS; c++) {
        let t;
        do { t = rndCandy(); } while (wouldMatch(r, c, t));
        board[r][c] = { type: t, y: r, targetY: r, falling: false, alpha: 1, scale: 1 };
      }
    }
  }

  function wouldMatch(r, c, t) {
    if (c >= 2 && board[r][c-1]?.type === t && board[r][c-2]?.type === t) return true;
    if (r >= 2 && board[r-1]?.[c]?.type === t && board[r-2]?.[c]?.type === t) return true;
    return false;
  }

  // ── Matching ─────────────────────────────────────────────────────────────
  function findMatches() {
    const matched = new Set();
    // horizontal
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS - 2; c++) {
        const t = board[r][c]?.type;
        if (t == null) continue;
        if (board[r][c+1]?.type === t && board[r][c+2]?.type === t) {
          let e = c + 2;
          while (e + 1 < COLS && board[r][e+1]?.type === t) e++;
          for (let i = c; i <= e; i++) matched.add(`${r},${i}`);
        }
      }
    }
    // vertical
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS - 2; r++) {
        const t = board[r][c]?.type;
        if (t == null) continue;
        if (board[r+1]?.[c]?.type === t && board[r+2]?.[c]?.type === t) {
          let e = r + 2;
          while (e + 1 < ROWS && board[e+1]?.[c]?.type === t) e++;
          for (let i = r; i <= e; i++) matched.add(`${i},${c}`);
        }
      }
    }
    return matched;
  }

  function removeMatches(matched) {
    const pts = [0, 0, 0, 30, 80, 150, 240, 350];
    const byRow = {};
    matched.forEach(k => {
      const [r, c] = k.split(',').map(Number);
      byRow[r] = (byRow[r] || 0) + 1;
      const candy = board[r][c];
      if (candy) {
        spawnParticles(OX + c * CELL + CELL / 2, OY + r * CELL + CELL / 2, CANDIES[candy.type].color);
        flashCells.push({ r, c, life: 1 });
      }
      board[r][c] = null;
    });
    const matchSize = matched.size;
    const mult = Math.max(1, cascade);
    score += (pts[Math.min(matchSize, pts.length - 1)] || matchSize * 30) * mult * level;
    cascade++;
    updateHUD();
  }

  function applyGravity() {
    let fell = false;
    for (let c = 0; c < COLS; c++) {
      let empty = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r][c]) {
          if (r !== empty) {
            board[empty][c] = board[r][c];
            board[r][c] = null;
            fell = true;
          }
          empty--;
        }
      }
      // fill from top
      for (let r = empty; r >= 0; r--) {
        board[r][c] = { type: rndCandy(), y: -1, targetY: r, falling: true, alpha: 1, scale: 1 };
        fell = true;
      }
    }
    return fell;
  }

  // ── Swap & resolve ───────────────────────────────────────────────────────
  function swap(r1, c1, r2, c2) {
    const tmp = board[r1][c1];
    board[r1][c1] = board[r2][c2];
    board[r2][c2] = tmp;
  }

  function trySwap(r1, c1, r2, c2) {
    if (r2 < 0 || r2 >= ROWS || c2 < 0 || c2 >= COLS) return false;
    if (!board[r1][c1] || !board[r2][c2]) return false;
    swap(r1, c1, r2, c2);
    const m = findMatches();
    if (m.size === 0) { swap(r1, c1, r2, c2); return false; }
    moves--;
    cascade = 0;
    updateHUD();
    resolveBoard();
    return true;
  }

  function resolveBoard() {
    const m = findMatches();
    if (m.size > 0) {
      removeMatches(m);
      setTimeout(() => { applyGravity(); setTimeout(resolveBoard, 350); }, 300);
    } else {
      cascade = 0;
      if (score >= target) { levelUp(); return; }
      if (moves <= 0) { endGame(); return; }
    }
  }

  function levelUp() {
    level++;
    target = Math.floor(target * 1.6);
    moves = 30; maxMoves = 30;
    levelEl.textContent = level;
    targetEl.textContent = target;
    initBoard();
    updateHUD();
  }

  // ── Particles ────────────────────────────────────────────────────────────
  function spawnParticles(x, y, color, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5;
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        color, life: 1, decay: 0.03 + Math.random() * 0.03,
        size: 3 + Math.random() * 5, shape: Math.random() < 0.5 ? 'circle' : 'star'
      });
    }
  }

  // ── HUD ──────────────────────────────────────────────────────────────────
  function updateHUD() {
    if (scoreEl) scoreEl.textContent = score.toLocaleString();
    if (movesEl) movesEl.textContent = moves;
    if (fillEl)  fillEl.style.width = Math.max(0, (moves / maxMoves) * 100) + '%';
  }

  // ── Draw ─────────────────────────────────────────────────────────────────
  function drawCandy(x, y, type, alpha = 1, scale = 1) {
    const c = CANDIES[type];
    const r = CELL / 2 - 4;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x + CELL / 2, y + CELL / 2);
    ctx.scale(scale, scale);

    // shadow
    ctx.beginPath();
    ctx.arc(2, 4, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();

    // body gradient
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.05, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,255,0.7)');
    g.addColorStop(0.35, c.color);
    g.addColorStop(1, c.shadow);

    ctx.shadowColor = c.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    // shine
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(-r * 0.28, -r * 0.3, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();

    // emoji label (small)
    ctx.font = `${Math.floor(r * 0.75)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(c.label, 0, 0);

    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = 'rgba(10,10,26,0.96)';
    ctx.fillRect(0, 0, W, H);

    // board bg
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = OX + c * CELL, y = OY + r * CELL;
        ctx.fillStyle = (r + c) % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)';
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 8);
        ctx.fill();
      }
    }

    // selected highlight
    if (selected) {
      const [sr, sc] = selected;
      const x = OX + sc * CELL, y = OY + sr * CELL;
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.roundRect(x + 3, y + 3, CELL - 6, CELL - 6, 10);
      ctx.stroke();
      ctx.restore();
    }

    // flash cells
    flashCells = flashCells.filter(f => {
      const x = OX + f.c * CELL, y = OY + f.r * CELL;
      ctx.save();
      ctx.globalAlpha = f.life * 0.6;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, CELL - 4, CELL - 4, 8);
      ctx.fill();
      ctx.restore();
      f.life -= 0.12;
      return f.life > 0;
    });

    // candies
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = board[r][c];
        if (!cell) continue;
        const cx = OX + c * CELL;
        const cy = OY + r * CELL;
        drawCandy(cx, cy, cell.type, cell.alpha, cell.scale);
      }
    }

    // particles
    particles = particles.filter(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      if (p.shape === 'circle') {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.translate(p.x, p.y); ctx.rotate(p.life * 4);
        const s = p.size * p.life;
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(s, 0); ctx.lineTo(0, s); ctx.lineTo(-s, 0);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= p.decay;
      return p.life > 0;
    });

    // score progress bar on canvas
    const prog = Math.min(1, score / target);
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath(); ctx.roundRect(OX, OY + ROWS * CELL + 10, COLS * CELL, 8, 4); ctx.fill();
    const barGrad = ctx.createLinearGradient(OX, 0, OX + COLS * CELL * prog, 0);
    barGrad.addColorStop(0, '#fbbf24');
    barGrad.addColorStop(1, '#ef4444');
    ctx.fillStyle = barGrad;
    ctx.beginPath(); ctx.roundRect(OX, OY + ROWS * CELL + 10, COLS * CELL * prog, 8, 4); ctx.fill();
    ctx.restore();
  }

  function loop() { draw(); animId = requestAnimationFrame(loop); }

  // ── Input ────────────────────────────────────────────────────────────────
  canvas.addEventListener('click', e => {
    if (!gameActive) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const c = Math.floor((mx - OX) / CELL);
    const r = Math.floor((my - OY) / CELL);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) { selected = null; return; }
    if (!selected) {
      selected = [r, c];
    } else {
      const [sr, sc] = selected;
      const dr = Math.abs(r - sr), dc = Math.abs(c - sc);
      if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
        trySwap(sr, sc, r, c);
      } else {
        selected = [r, c];
        return;
      }
      selected = null;
    }
  });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    const mx = t.clientX - rect.left, my = t.clientY - rect.top;
    canvas.dispatchEvent(new MouseEvent('click', {
      clientX: rect.left + mx, clientY: rect.top + my
    }));
  }, { passive: false });

  // ── Lifecycle ────────────────────────────────────────────────────────────
  function startGame() {
    score = 0; moves = 30; maxMoves = 30; level = 1; target = 500;
    cascade = 0; particles = []; flashCells = []; selected = null;
    scoreEl.textContent = '0'; levelEl.textContent = '1';
    movesEl.textContent = '30'; targetEl.textContent = '500';
    initBoard(); updateHUD();
    overlay.style.display = 'none';
    scoreForm.style.display = 'none';
    gameActive = true;
    if (animId) cancelAnimationFrame(animId);
    loop();
  }

  function endGame() {
    gameActive = false;
    if (score > best) { best = score; if (bestEl) bestEl.textContent = best.toLocaleString(); }
    oTitle.textContent = moves <= 0 ? '⏰ No More Moves!' : '🍬 Game Over!';
    oSub.textContent = '';
    finalEl.textContent = `Score: ${score.toLocaleString()} — Level ${level}`;
    scoreForm.style.display = 'block';
    submitRes.textContent = ''; nameIn.value = '';
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="bi bi-send me-2"></i>Submit Score';
    startLbl.textContent = 'Play Again';
    overlay.style.display = 'flex';
  }

  // ── Score submit ─────────────────────────────────────────────────────────
  submitBtn.addEventListener('click', async () => {
    const name = (nameIn.value.trim() || 'Player').slice(0, 20);
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving…';
    try {
      const res = await fetch('/api/save-score/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score, level, game: 'candy' })
      });
      const data = await res.json();
      if (data.success) {
        submitRes.innerHTML = `<span style="color:#34d399"><i class="bi bi-check-circle-fill me-1"></i>Saved! You ranked #${data.rank}</span>`;
        submitBtn.style.display = 'none';
      } else throw new Error(data.error);
    } catch (e) {
      submitRes.innerHTML = `<span style="color:#f87171"><i class="bi bi-x-circle me-1"></i>${e.message}</span>`;
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-send me-2"></i>Submit Score';
    }
  });

  startBtn.addEventListener('click', startGame);
})();
