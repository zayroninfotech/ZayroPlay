// ── Bubble Shooter — ZayroPlay ───────────────────────────────────────────────
(function () {
  const canvas = document.getElementById('bubbleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // ── Constants ─────────────────────────────────────────────────────────────
  const COLS = 9, ROWS = 12, R = 24;
  const DX = R * 2, DY = R * 1.75, OFF = R;
  const SPEED = 12;
  const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#fbbf24', '#a855f7', '#f97316'];
  const FILL_ROWS = 5;

  // ── State ─────────────────────────────────────────────────────────────────
  let grid = [], projectile = null, nextColor = null;
  let score = 0, level = 1, movesLeft = 30, maxMoves = 30;
  let running = false, animId = null;

  // ── Audio ─────────────────────────────────────────────────────────────────
  let _ac = null;
  function ac() {
    if (!_ac) try { _ac = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
    if (_ac && _ac.state === 'suspended') _ac.resume();
    return _ac;
  }
  function tone(freq, dur, type, vol) {
    if (!window.zpSoundOn) return;
    try {
      const a = ac(); if (!a) return;
      const o = a.createOscillator(), g = a.createGain();
      o.connect(g); g.connect(a.destination);
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.15, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
      o.start(); o.stop(a.currentTime + dur);
    } catch(e) {}
  }
  function sndShoot()  { tone(300, 0.08, 'triangle', 0.1); }
  function sndPop(n)   { tone(440 + n * 40, 0.12, 'sine', 0.2); setTimeout(() => tone(600 + n * 40, 0.1, 'sine', 0.15), 60); }
  function sndBounce() { tone(200, 0.05, 'square', 0.07); }
  function sndWin()    { [440,550,660,880].forEach((f,i) => setTimeout(() => tone(f, 0.2, 'sine', 0.2), i * 80)); }
  function sndFail()   { tone(180, 0.4, 'sawtooth', 0.15); setTimeout(() => tone(130, 0.5, 'sawtooth', 0.1), 220); }

  // ── Grid helpers ──────────────────────────────────────────────────────────
  function colX(c, r) { return c * DX + R + (r % 2 ? OFF : 0); }
  function rowY(r)    { return r * DY + R + 2; }

  function initGrid() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    for (let r = 0; r < FILL_ROWS; r++)
      for (let c = 0; c < COLS; c++)
        grid[r][c] = COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  function gridColors() {
    const s = new Set(grid.flat().filter(Boolean));
    return s.size ? [...s] : COLORS;
  }

  function rndColor() {
    const pool = gridColors();
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ── Neighbors ─────────────────────────────────────────────────────────────
  function neighbors(r, c) {
    const odd = r % 2;
    return [
      [r-1, c + (odd ? 0 : -1)], [r-1, c + (odd ? 1 : 0)],
      [r,   c - 1],               [r,   c + 1],
      [r+1, c + (odd ? 0 : -1)], [r+1, c + (odd ? 1 : 0)],
    ].filter(([nr, nc]) => nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS);
  }

  // ── Draw bubble ───────────────────────────────────────────────────────────
  function drawBubble(x, y, color, alpha) {
    alpha = alpha === undefined ? 1 : alpha;
    ctx.save();
    ctx.globalAlpha = alpha;

    // glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;

    // body
    const grd = ctx.createRadialGradient(x - R * 0.3, y - R * 0.35, R * 0.05, x, y, R - 1);
    grd.addColorStop(0, 'rgba(255,255,255,0.75)');
    grd.addColorStop(0.4, color);
    grd.addColorStop(1, darken(color));
    ctx.beginPath();
    ctx.arc(x, y, R - 1, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();

    // shine
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x - R * 0.28, y - R * 0.32, R * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();

    ctx.restore();
  }

  function darken(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, ((n >> 16) & 0xff) - 60);
    const g = Math.max(0, ((n >> 8)  & 0xff) - 60);
    const b = Math.max(0, ( n        & 0xff)  - 60);
    return `rgb(${r},${g},${b})`;
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  let mouseX = W / 2, mouseY = H - 50;

  function draw() {
    // background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // faint grid cells
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        ctx.beginPath();
        ctx.arc(colX(c, r), rowY(r), R - 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    ctx.restore();

    // grid bubbles
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c]) drawBubble(colX(c, r), rowY(r), grid[r][c]);

    // aim line
    if (running && !projectile) {
      const sx = W / 2, sy = H - 50;
      const dx = mouseX - sx, dy = mouseY - sy;
      const len = Math.hypot(dx, dy);
      if (len > 5 && dy < 0) {
        let x = sx, y = sy, vx = (dx / len) * SPEED, vy = (dy / len) * SPEED;
        ctx.save();
        ctx.setLineDash([6, 10]);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let i = 0; i < 80; i++) {
          x += vx; y += vy;
          if (x - R < 0)  { x = R;   vx = -vx; }
          if (x + R > W)  { x = W-R; vx = -vx; }
          if (y < R) break;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // flying projectile
    if (projectile) drawBubble(projectile.x, projectile.y, projectile.color);

    // shooter base
    const sx = W / 2, sy = H - 50;
    ctx.save();
    const bg = ctx.createRadialGradient(sx, sy, 5, sx, sy, 40);
    bg.addColorStop(0, 'rgba(124,58,237,0.5)');
    bg.addColorStop(1, 'rgba(124,58,237,0)');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(sx, sy, 40, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // current bubble in shooter
    if (nextColor) {
      drawBubble(sx, sy, nextColor);
      ctx.save();
      ctx.font = 'bold 9px Orbitron,sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.textAlign = 'center';
      ctx.fillText('SHOOT', sx, H - 8);
      ctx.restore();
    }

    // score bar
    const prog = Math.min(1, score / (level * 500));
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.roundRect(4, H - 6, W - 8, 4, 2); ctx.fill();
    if (prog > 0) {
      const bar = ctx.createLinearGradient(4, 0, 4 + (W - 8) * prog, 0);
      bar.addColorStop(0, '#a78bfa'); bar.addColorStop(1, '#ec4899');
      ctx.fillStyle = bar;
      ctx.beginPath(); ctx.roundRect(4, H - 6, (W - 8) * prog, 4, 2); ctx.fill();
    }
    ctx.restore();
  }

  // ── Projectile ────────────────────────────────────────────────────────────
  function shoot() {
    if (!running || projectile || !nextColor) return;
    const sx = W / 2, sy = H - 50;
    const dx = mouseX - sx, dy = mouseY - sy;
    const len = Math.hypot(dx, dy);
    if (len < 5 || dy >= 0) return;
    projectile = { x: sx, y: sy, vx: (dx / len) * SPEED, vy: (dy / len) * SPEED, color: nextColor };
    nextColor = rndColor();
    movesLeft--;
    window.zpSetMoves && window.zpSetMoves(movesLeft, maxMoves);
    sndShoot(); ac();
  }

  function updateProjectile() {
    if (!projectile) return;
    projectile.x += projectile.vx;
    projectile.y += projectile.vy;

    if (projectile.x - R < 0)  { projectile.x = R;   projectile.vx = -projectile.vx; sndBounce(); }
    if (projectile.x + R > W)  { projectile.x = W-R; projectile.vx = -projectile.vx; sndBounce(); }
    if (projectile.y - R <= rowY(0) - R) { snapProjectile(); return; }

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (!grid[r][c]) continue;
        if (Math.hypot(projectile.x - colX(c, r), projectile.y - rowY(r)) < R * 1.85) {
          snapProjectile(); return;
        }
      }
  }

  function snapProjectile() {
    if (!projectile) return;
    const p = projectile; projectile = null;

    // find nearest empty cell
    let best = null, bestD = Infinity;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (grid[r][c]) continue;
        const d = Math.hypot(p.x - colX(c, r), p.y - rowY(r));
        if (d < bestD) { bestD = d; best = { r, c }; }
      }
    if (!best) return;

    grid[best.r][best.c] = p.color;
    const matched = floodFill(best.r, best.c, p.color);
    if (matched.length >= 3) {
      matched.forEach(({ r, c }) => grid[r][c] = null);
      score += matched.length * 10 * level;
      window.zpSetScore && window.zpSetScore(score);
      sndPop(matched.length);
      removeFloating();
      checkWin();
    }

    if (movesLeft <= 0) setTimeout(() => endGame(false), 400);
  }

  function floodFill(sr, sc, color) {
    const visited = new Set([`${sr},${sc}`]), queue = [{ r: sr, c: sc }], found = [];
    while (queue.length) {
      const { r, c } = queue.shift();
      if (grid[r][c] === color) found.push({ r, c });
      for (const [nr, nc] of neighbors(r, c)) {
        const k = `${nr},${nc}`;
        if (!visited.has(k) && grid[nr][nc] === color) { visited.add(k); queue.push({ r: nr, c: nc }); }
      }
    }
    return found;
  }

  function removeFloating() {
    const conn = new Set();
    const q = [];
    for (let c = 0; c < COLS; c++) if (grid[0][c]) { conn.add(`0,${c}`); q.push({ r:0, c }); }
    while (q.length) {
      const { r, c } = q.shift();
      for (const [nr, nc] of neighbors(r, c)) {
        const k = `${nr},${nc}`;
        if (!conn.has(k) && grid[nr] && grid[nr][nc]) { conn.add(k); q.push({ r: nr, c: nc }); }
      }
    }
    let bonus = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c] && !conn.has(`${r},${c}`)) { grid[r][c] = null; bonus += 5; }
    if (bonus) { score += bonus; window.zpSetScore && window.zpSetScore(score); }
  }

  function checkWin() {
    if (grid.flat().filter(Boolean).length === 0 || score >= level * 500) {
      setTimeout(() => nextLevel(), 500);
    }
  }

  function nextLevel() {
    level++; maxMoves = level * 30; movesLeft = maxMoves;
    sndWin();
    window.zpSetLevel  && window.zpSetLevel(level);
    window.zpSetMoves  && window.zpSetMoves(movesLeft, maxMoves);
    window.zpSetTarget && window.zpSetTarget(level * 500);
    grid.unshift(
      ...Array.from({ length: 2 }, () =>
        Array.from({ length: COLS }, () =>
          Math.random() < 0.75 ? COLORS[Math.floor(Math.random() * COLORS.length)] : null
        )
      )
    );
    grid = grid.slice(0, ROWS);
  }

  function endGame(won) {
    running = false;
    cancelAnimationFrame(animId);
    const overlay  = document.getElementById('bOverlay');
    const titleEl  = document.getElementById('bOverlayTitle');
    const subEl    = document.getElementById('bOverlaySub');
    const form     = document.getElementById('bScoreForm');
    const finalEl  = document.getElementById('bFinalScore');
    const labelEl  = document.getElementById('bStartLabel');
    if (titleEl) titleEl.textContent  = won ? '🎉 Level Clear!' : '💥 Game Over';
    if (subEl)   subEl.textContent    = won ? '' : '';
    if (finalEl) finalEl.textContent  = `Score: ${score}  •  Level ${level}`;
    if (form)    form.style.display   = 'block';
    if (labelEl) labelEl.textContent  = 'Play Again';
    if (overlay) overlay.style.display = 'flex';
    won ? sndWin() : sndFail();
  }

  // ── Game loop ─────────────────────────────────────────────────────────────
  function loop() {
    draw();
    updateProjectile();
    animId = requestAnimationFrame(loop);
  }

  // ── Start ─────────────────────────────────────────────────────────────────
  function startGame() {
    score = 0; level = 1; movesLeft = 30; maxMoves = 30;
    projectile = null;
    initGrid();
    nextColor = rndColor();
    window.zpSetScore  && window.zpSetScore(0);
    window.zpSetLevel  && window.zpSetLevel(1);
    window.zpSetMoves  && window.zpSetMoves(30, 30);
    window.zpSetTarget && window.zpSetTarget(500);
    cancelAnimationFrame(animId);
    running = true;
    loop();
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    mouseX = (e.clientX - rect.left) * scaleX;
    mouseY = (e.clientY - rect.top)  * scaleY;
  });

  canvas.addEventListener('click', e => {
    if (!running) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    mouseX = (e.clientX - rect.left) * scaleX;
    mouseY = (e.clientY - rect.top)  * scaleY;
    shoot(); ac();
  });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    mouseX = (e.touches[0].clientX - rect.left) * scaleX;
    mouseY = (e.touches[0].clientY - rect.top)  * scaleY;
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault(); shoot();
  }, { passive: false });

  // ── Score submit ──────────────────────────────────────────────────────────
  document.getElementById('bSubmitBtn')?.addEventListener('click', async () => {
    const nameEl = document.getElementById('bNameInput');
    const resEl  = document.getElementById('bSubmitResult');
    const btn    = document.getElementById('bSubmitBtn');
    const name   = (nameEl?.value.trim() || 'Player').slice(0, 20);
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving…'; }
    try {
      const res  = await fetch('/api/save-score/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score, level, game: 'bubble' }),
      });
      const data = await res.json();
      if (resEl) resEl.innerHTML = data.success
        ? `<span style="color:#4ade80">🏆 Rank #${data.rank}! Score saved.</span>`
        : `<span style="color:#f87171">Error: ${data.error}</span>`;
      if (btn && data.success) btn.style.display = 'none';
    } catch(e) {
      if (resEl) resEl.innerHTML = `<span style="color:#f87171">Network error.</span>`;
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-send me-2"></i>Submit Score'; }
    }
  });

  // ── Expose ────────────────────────────────────────────────────────────────
  window.zpSoundOn  = true;
  window.bStartGame = startGame;
})();
