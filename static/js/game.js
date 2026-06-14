// ── Bubble Shooter — Enhanced Engine ────────────────────────────────────────
(function () {
  const canvas  = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // DOM refs
  const scoreEl     = document.getElementById('scoreDisplay');
  const levelEl     = document.getElementById('levelDisplay');
  const shotsEl     = document.getElementById('shotsDisplay');
  const bestEl      = document.getElementById('bestScoreDisplay');
  const comboEl     = document.getElementById('comboDisplay');
  const comboCard   = document.getElementById('comboCard');
  const streakBadge = document.getElementById('streakBadge');
  const accEl       = document.getElementById('accDisplay');
  const accFill     = document.getElementById('accFill');
  const nextPreview = document.getElementById('nextBubblePreview');
  const overlay     = document.getElementById('gameOverlay');
  const overlayTitle= document.getElementById('overlayTitle');
  const overlaySub  = document.getElementById('overlaySubtitle');
  const startBtn    = document.getElementById('startBtn');
  const startLabel  = document.getElementById('startBtnLabel');
  const submitForm  = document.getElementById('scoreSubmitForm');
  const finalScoreT = document.getElementById('finalScoreText');
  const nameInput   = document.getElementById('playerNameInput');
  const submitBtn   = document.getElementById('submitScoreBtn');
  const submitResult= document.getElementById('submitResult');
  const soundToggle = document.getElementById('soundToggle');
  const soundLabel  = document.getElementById('soundLabel');
  const fxToggle    = document.getElementById('fxToggle');
  const fxLabel     = document.getElementById('fxLabel');

  // ── Settings ───────────────────────────────────────────────────────────
  let soundOn = true, fxOn = true;

  soundToggle && soundToggle.addEventListener('click', () => {
    soundOn = !soundOn;
    soundToggle.classList.toggle('on', soundOn);
    if (soundLabel) soundLabel.textContent = soundOn ? 'ON' : 'OFF';
  });
  fxToggle && fxToggle.addEventListener('click', () => {
    fxOn = !fxOn;
    fxToggle.classList.toggle('on', fxOn);
    if (fxLabel) fxLabel.textContent = fxOn ? 'ON' : 'OFF';
  });

  // ── Sound Engine (Web Audio API) ───────────────────────────────────────
  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  function playTone(freq, type, dur, vol = 0.18, startTime = 0) {
    if (!soundOn) return;
    try {
      const ac = getAudio();
      const t  = ac.currentTime + startTime;
      const o  = ac.createOscillator();
      const g  = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.start(t); o.stop(t + dur);
    } catch(e) {}
  }

  function sndShoot()   { playTone(220, 'sawtooth', 0.07, 0.12); }
  function sndPop(n)    {
    // slightly different pitch per bubble in cluster
    for (let i = 0; i < Math.min(n, 6); i++)
      playTone(400 + i * 60, 'sine', 0.12, 0.15, i * 0.03);
  }
  function sndCombo(mult) {
    const notes = [330,392,494,587,659];
    for (let i = 0; i < mult; i++)
      playTone(notes[Math.min(i, notes.length-1)], 'triangle', 0.18, 0.2, i * 0.07);
  }
  function sndLevelUp() {
    [523,659,784,1047].forEach((f, i) => playTone(f, 'sine', 0.25, 0.22, i * 0.1));
  }
  function sndGameOver() {
    [392,330,262,196].forEach((f, i) => playTone(f, 'sawtooth', 0.35, 0.15, i * 0.15));
  }
  function sndBomb()    {
    playTone(80, 'sawtooth', 0.4, 0.3);
    playTone(120, 'square',  0.3, 0.2, 0.05);
  }
  function sndRainbow() {
    [523,659,784,523].forEach((f, i) => playTone(f, 'sine', 0.12, 0.18, i * 0.04));
  }
  function sndWarn()    { playTone(160, 'square', 0.15, 0.1); }
  function sndWall()    { playTone(280, 'triangle', 0.06, 0.08); }

  // ── Constants ──────────────────────────────────────────────────────────
  const R        = 22;
  const COLS     = 10;
  const SHOOTER_X= W / 2;
  const SHOOTER_Y= H - 50;
  const COLORS   = ['#f472b6','#a78bfa','#34d399','#fbbf24','#38bdf8','#f87171','#4ade80','#fb923c'];
  const BOMB_COLOR    = '__bomb__';
  const RAINBOW_COLOR = '__rainbow__';

  // ── State ──────────────────────────────────────────────────────────────
  let grid = [], projectile = null, nextColor = null;
  let score = 0, shots = 0, level = 1, bestScore = 0;
  let aimAngle = -Math.PI/2, gameActive = false, animId = null;
  let particles = [], floatTexts = [], trail = [];
  let screenFlash = 0, screenShake = { x: 0, y: 0, dur: 0 };
  let comboCount = 0, totalShots = 0, hitShots = 0;
  let displayScore = 0;  // for animated counter
  let warnPulse = 0;

  // ── localStorage best score ────────────────────────────────────────────
  const LS_KEY = 'zayroplay_bubble_best';
  try { bestScore = parseInt(localStorage.getItem(LS_KEY)) || 0; } catch(e) {}
  if (bestEl) bestEl.textContent = bestScore > 0 ? bestScore.toLocaleString() : '—';

  // ── Helpers ────────────────────────────────────────────────────────────
  function colX(c, r) { return R + c*(R*2) + (r%2===0 ? 0 : R); }
  function rowY(r)    { return R + r*(R*1.73); }
  function shotsForLevel(lvl) { return Math.max(12, Math.round(55 / lvl)); }

  function rndColor(includeSp = false) {
    const pool = COLORS.slice(0, Math.min(4 + level, COLORS.length));
    if (includeSp && level >= 3) {
      const rnd = Math.random();
      if (rnd < 0.04) return BOMB_COLOR;
      if (rnd < 0.09) return RAINBOW_COLOR;
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function shade(hex, amt) {
    if (hex.startsWith('__')) return hex;
    const n = parseInt(hex.replace('#',''), 16);
    const r = Math.min(255, Math.max(0,(n>>16)+amt));
    const g = Math.min(255, Math.max(0,((n>>8)&0xFF)+amt));
    const b = Math.min(255, Math.max(0,(n&0xFF)+amt));
    return `rgb(${r},${g},${b})`;
  }

  function getRealColor(color) {
    if (color === RAINBOW_COLOR) return '#ffffff';
    if (color === BOMB_COLOR)    return '#555555';
    return color;
  }

  // ── Grid ───────────────────────────────────────────────────────────────
  function initGrid(rows) {
    grid = [];
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < COLS; c++) grid[r][c] = rndColor(r > 1);
    }
  }

  // ── Projectile ─────────────────────────────────────────────────────────
  function spawnProjectile() {
    const color = nextColor || rndColor(true);
    nextColor = rndColor(true);
    projectile = { x: SHOOTER_X, y: SHOOTER_Y, vx: 0, vy: 0, color, active: false };
    updateNextPreview();
  }

  function updateNextPreview() {
    if (!nextPreview) return;
    if (nextColor === BOMB_COLOR)    { nextPreview.style.background = 'radial-gradient(circle at 35% 35%,#aaa,#333)'; return; }
    if (nextColor === RAINBOW_COLOR) { nextPreview.style.background = 'conic-gradient(#f472b6,#a78bfa,#38bdf8,#34d399,#fbbf24,#f472b6)'; return; }
    nextPreview.style.background = nextColor;
  }

  function shoot() {
    if (!gameActive || (projectile && projectile.active)) return;
    if (shots <= 0) { endGame(); return; }
    shots--;
    totalShots++;
    updateHUD();
    projectile.vx = Math.cos(aimAngle) * 11;
    projectile.vy = Math.sin(aimAngle) * 11;
    projectile.active = true;
    trail = [];
    sndShoot();
  }

  // ── Snap ──────────────────────────────────────────────────────────────
  function snapToGrid(x, y) {
    let bestR = 0, bestC = 0, bestD = Infinity;
    const maxR = Math.min(grid.length + 2, 20);
    for (let r = 0; r < maxR; r++) {
      for (let c = 0; c < COLS; c++) {
        if (grid[r] && grid[r][c]) continue;
        const d = Math.hypot(x - colX(c,r), y - rowY(r));
        if (d < bestD) { bestD = d; bestR = r; bestC = c; }
      }
    }
    return { row: bestR, col: bestC };
  }

  function placeBubble(r, c, color) {
    while (grid.length <= r) grid.push(new Array(COLS).fill(null));
    grid[r][c] = color;
  }

  // ── BFS ───────────────────────────────────────────────────────────────
  function nbrs(r, c) {
    const e = r % 2 === 0;
    return [[r-1, e?c-1:c],[r-1, e?c:c+1],[r,c-1],[r,c+1],[r+1, e?c-1:c],[r+1, e?c:c+1]]
      .filter(([nr,nc]) => nr >= 0 && nc >= 0 && nc < COLS);
  }

  function getCluster(r, c) {
    const color = grid[r]?.[c];
    if (!color) return [];
    // Rainbow matches anything, bomb matches anything
    if (color === RAINBOW_COLOR || color === BOMB_COLOR) return [[r, c]];
    const vis = new Set(), q = [[r,c]], res = [];
    while (q.length) {
      const [cr,cc] = q.shift(), k = `${cr},${cc}`;
      if (vis.has(k)) continue;
      const gc = grid[cr]?.[cc];
      if (!gc) continue;
      // rainbow in grid counts as this color
      if (gc !== color && gc !== RAINBOW_COLOR) continue;
      vis.add(k); res.push([cr, cc]);
      for (const [nr,nc] of nbrs(cr,cc)) q.push([nr, nc]);
    }
    return res;
  }

  function getBombArea(r, c) {
    const res = new Set();
    res.add(`${r},${c}`);
    for (const [nr,nc] of nbrs(r, c)) {
      res.add(`${nr},${nc}`);
      for (const [nr2,nc2] of nbrs(nr, nc)) res.add(`${nr2},${nc2}`);
    }
    return [...res].map(k => k.split(',').map(Number)).filter(([rr,cc]) => grid[rr]?.[cc]);
  }

  function getFloating() {
    const conn = new Set();
    for (let c = 0; c < COLS; c++) if (grid[0]?.[c]) bfsConn(0, c, conn);
    const fl = [];
    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c] && !conn.has(`${r},${c}`)) fl.push([r, c]);
    return fl;
  }

  function bfsConn(sr, sc, vis) {
    const q = [[sr, sc]];
    while (q.length) {
      const [r,c] = q.shift(), k = `${r},${c}`;
      if (vis.has(k) || !grid[r]?.[c]) continue;
      vis.add(k);
      for (const [nr,nc] of nbrs(r, c)) q.push([nr, nc]);
    }
  }

  // ── Particles ─────────────────────────────────────────────────────────
  function spawnParticles(x, y, color, n = 14) {
    if (!fxOn) return;
    const rc = getRealColor(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 6;
      const type = ['circle','star','ring'][Math.floor(Math.random()*3)];
      particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp,
        color: rc, life: 1, decay: 0.022 + Math.random()*0.03,
        size: 3 + Math.random() * 6, type });
    }
    // ring burst
    if (n > 8) {
      particles.push({ x, y, vx: 0, vy: 0, color: rc, life: 1,
        decay: 0.04, size: R * 0.5, type: 'ring_burst' });
    }
  }

  function spawnFloatText(x, y, text, color = '#fbbf24') {
    if (!fxOn) return;
    floatTexts.push({ x, y, text, color, life: 1, vy: -1.5, decay: 0.025 });
  }

  function startScreenShake(strength = 4, dur = 300) {
    if (!fxOn) return;
    screenShake.dur = dur;
    screenShake.strength = strength;
  }

  // ── HUD ───────────────────────────────────────────────────────────────
  function updateHUD() {
    if (levelEl) levelEl.textContent = level;
    if (shotsEl) shotsEl.textContent = shots;
    updateComboUI();
    updateAccuracy();
  }

  function updateComboUI() {
    if (!comboEl || !comboCard) return;
    comboEl.textContent = `×${comboCount || 1}`;
    const active = comboCount >= 2;
    comboCard.classList.toggle('active', active);
    if (streakBadge) streakBadge.style.display = comboCount >= 4 ? 'block' : 'none';
  }

  function updateAccuracy() {
    if (!accEl || !accFill) return;
    if (totalShots === 0) { accEl.textContent = '—'; accFill.style.width = '0%'; return; }
    const pct = Math.round((hitShots / totalShots) * 100);
    accEl.textContent = `${pct}%`;
    accFill.style.width = `${pct}%`;
  }

  // Animated score counter
  function tickScore() {
    if (displayScore < score) {
      displayScore = Math.min(score, displayScore + Math.ceil((score - displayScore) / 8) + 1);
      if (scoreEl) scoreEl.textContent = displayScore.toLocaleString();
      requestAnimationFrame(tickScore);
    }
  }
  function addScore(pts) {
    score += pts;
    tickScore();
  }

  // ── Land bubble ───────────────────────────────────────────────────────
  function landBubble() {
    const { row, col } = snapToGrid(projectile.x, projectile.y);
    const px = colX(col, row), py = rowY(row);

    // Bomb special
    if (projectile.color === BOMB_COLOR) {
      const area = getBombArea(row, col);
      sndBomb();
      startScreenShake(8, 400);
      area.forEach(([r,c]) => {
        if (grid[r]?.[c]) {
          spawnParticles(colX(c,r), rowY(r), grid[r][c] === BOMB_COLOR ? '#888' : grid[r][c], 20);
          grid[r][c] = null;
        }
      });
      spawnFloatText(px, py, '💣 BOOM!', '#fb923c');
      addScore(area.length * 15 * level);
      comboCount++;
      updateComboUI();
      cleanupAfterPop(row, col, px, py, area.length);
      return;
    }

    placeBubble(row, col, projectile.color);

    let cluster = getCluster(row, col);

    // Rainbow bubble in grid: try to find biggest adjacent cluster
    if (projectile.color === RAINBOW_COLOR) {
      let biggest = [], bestColor = null;
      for (const [nr,nc] of nbrs(row, col)) {
        if (!grid[nr]?.[nc] || grid[nr][nc] === RAINBOW_COLOR || grid[nr][nc] === BOMB_COLOR) continue;
        const tmp = grid[row][col]; grid[row][col] = grid[nr][nc];
        const cl = getCluster(row, col);
        if (cl.length > biggest.length) { biggest = cl; bestColor = grid[nr][nc]; }
        grid[row][col] = tmp;
      }
      if (biggest.length >= 3) { cluster = biggest; sndRainbow(); }
      else { cluster = []; }
    }

    if (cluster.length >= 3) {
      hitShots++;
      comboCount++;
      const mult = Math.min(comboCount, 5);
      cluster.forEach(([r,c]) => {
        spawnParticles(colX(c,r), rowY(r), grid[r][c], 16);
        grid[r][c] = null;
      });
      const pts = cluster.length * 10 * level * mult;
      addScore(pts);
      sndPop(cluster.length);
      if (mult >= 2) sndCombo(mult);
      spawnFloatText(px, py, `+${pts}${mult >= 2 ? ' ×'+mult+'!' : ''}`, mult >= 3 ? '#fbbf24' : '#34d399');
      if (comboCount >= 3) startScreenShake(comboCount * 1.5, 250);
      screenFlash = 0.3 + comboCount * 0.05;

      const floating = getFloating();
      floating.forEach(([r,c]) => {
        spawnParticles(colX(c,r), rowY(r), grid[r][c], 8);
        grid[r][c] = null;
        addScore(5);
      });

      cleanupAfterPop(row, col, px, py, cluster.length);
    } else {
      comboCount = 0;
      updateComboUI();
      if (isGameLost() || shots <= 0) { endGame(); return; }
      spawnProjectile();
    }
  }

  function cleanupAfterPop(r, c, px, py, clusterSize) {
    updateHUD();
    if (isGridEmpty()) { levelUp(px, py); return; }
    if (isGameLost() || shots <= 0) { endGame(); return; }
    spawnProjectile();
  }

  function levelUp(px, py) {
    level++;
    shots = shotsForLevel(level);
    screenFlash = 0.7;
    startScreenShake(10, 500);
    sndLevelUp();
    spawnFloatText(W/2, H/2, `✨ LEVEL ${level}!`, '#a78bfa');
    spawnFloatText(W/2, H/2 + 36, `+${level * 200} bonus`, '#fbbf24');
    addScore(level * 200);
    setTimeout(() => {
      initGrid(5 + level);
      updateHUD();
      spawnProjectile();
    }, 700);
  }

  function isGridEmpty() { return grid.every(r => r.every(c => !c)); }
  function isGameLost() {
    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c] && rowY(r) + R > SHOOTER_Y - R * 2) return true;
    return false;
  }

  function isDangerClose() {
    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c] && rowY(r) + R > SHOOTER_Y - R * 5) return true;
    return false;
  }

  // ── Aim projection ────────────────────────────────────────────────────
  function getAimPath() {
    const pts = [{ x: SHOOTER_X, y: SHOOTER_Y }];
    let x = SHOOTER_X, y = SHOOTER_Y;
    let vx = Math.cos(aimAngle) * 11, vy = Math.sin(aimAngle) * 11;
    for (let i = 0; i < 60; i++) {
      x += vx; y += vy;
      if (x - R < 0)  { vx *= -1; x += vx * 2; }
      if (x + R > W)  { vx *= -1; x += vx * 2; }
      if (y < 0 || y > H) break;
      pts.push({ x, y });
      // check collision with grid
      let hit = false;
      for (let r = 0; r < grid.length && !hit; r++)
        for (let c = 0; c < COLS && !hit; c++)
          if (grid[r][c] && Math.hypot(x - colX(c,r), y - rowY(r)) < R*1.85) hit = true;
      if (hit) break;
    }
    return pts;
  }

  // ── Update ────────────────────────────────────────────────────────────
  function update() {
    if (!gameActive) return;

    screenFlash = Math.max(0, screenFlash - 0.035);
    warnPulse   = (warnPulse + 0.06) % (Math.PI * 2);
    if (screenShake.dur > 0) {
      screenShake.dur -= 16;
      const s = screenShake.strength * (screenShake.dur / 400);
      screenShake.x = (Math.random() - 0.5) * s;
      screenShake.y = (Math.random() - 0.5) * s;
    } else { screenShake.x = 0; screenShake.y = 0; }

    particles = particles.filter(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.type !== 'ring_burst') p.vy += 0.12;
      else p.size += 2.5;
      p.life -= p.decay;
      return p.life > 0;
    });

    floatTexts = floatTexts.filter(t => {
      t.y += t.vy; t.life -= t.decay; return t.life > 0;
    });

    if (!projectile || !projectile.active) return;

    // Trail
    trail.push({ x: projectile.x, y: projectile.y, life: 1 });
    if (trail.length > 12) trail.shift();
    trail.forEach(t => { t.life -= 0.09; });

    projectile.x += projectile.vx;
    projectile.y += projectile.vy;

    if (projectile.x - R < 0) { projectile.x = R;   projectile.vx *= -1; sndWall(); }
    if (projectile.x + R > W) { projectile.x = W-R;  projectile.vx *= -1; sndWall(); }
    if (projectile.y - R < 0) { landBubble(); return; }
    if (projectile.y > H + R) { spawnProjectile(); return; }

    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c] && Math.hypot(projectile.x - colX(c,r), projectile.y - rowY(r)) < R*1.92) {
          landBubble(); return;
        }
  }

  // ── Draw helpers ──────────────────────────────────────────────────────
  function drawBubble(x, y, color, alpha = 1, scale = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    if (color === BOMB_COLOR) {
      ctx.shadowColor = '#888'; ctx.shadowBlur = 14;
      const g = ctx.createRadialGradient(-R*0.3,-R*0.3,R*0.08,0,0,R);
      g.addColorStop(0, 'rgba(255,255,255,0.5)');
      g.addColorStop(0.4, '#777');
      g.addColorStop(1, '#111');
      ctx.beginPath(); ctx.arc(0,0,R-1,0,Math.PI*2);
      ctx.fillStyle = g; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff'; ctx.font = `bold ${R}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💣', 0, 1);
      ctx.restore(); return;
    }

    if (color === RAINBOW_COLOR) {
      ctx.shadowColor = '#fff'; ctx.shadowBlur = 20;
      const g = ctx.createConicGradient(0, 0, 0);
      g.addColorStop(0,    '#f472b6');
      g.addColorStop(0.2,  '#a78bfa');
      g.addColorStop(0.4,  '#38bdf8');
      g.addColorStop(0.6,  '#34d399');
      g.addColorStop(0.8,  '#fbbf24');
      g.addColorStop(1,    '#f472b6');
      ctx.beginPath(); ctx.arc(0,0,R-1,0,Math.PI*2);
      ctx.fillStyle = g; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff'; ctx.font = `bold ${R}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🌈', 0, 1);
      ctx.restore(); return;
    }

    ctx.shadowColor = color; ctx.shadowBlur = 14;
    const g = ctx.createRadialGradient(-R*0.3,-R*0.3,R*0.08,0,0,R);
    g.addColorStop(0, 'rgba(255,255,255,0.65)');
    g.addColorStop(0.4, color);
    g.addColorStop(1, shade(color, -50));
    ctx.beginPath(); ctx.arc(0,0,R-1,0,Math.PI*2);
    ctx.fillStyle = g; ctx.fill();

    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(-R*0.28,-R*0.3,R*0.22,0,Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();

    ctx.restore();
  }

  function drawAimLine() {
    if (!projectile || projectile.active) return;
    const pts = getAimPath();
    const projColor = getRealColor(projectile.color);

    ctx.save();
    // colored dashed line
    ctx.strokeStyle = projectile.color === BOMB_COLOR ? 'rgba(200,100,50,0.35)' :
                      projectile.color === RAINBOW_COLOR ? 'rgba(255,255,255,0.3)' :
                      projColor + '55';
    ctx.setLineDash([7, 9]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // landing dot
    if (pts.length > 1) {
      const lp = pts[pts.length - 1];
      ctx.shadowColor = projColor; ctx.shadowBlur = 16;
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = projColor;
      ctx.beginPath(); ctx.arc(lp.x, lp.y, 6, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  function drawShooter() {
    ctx.save();
    const fire = comboCount >= 3 && fxOn;

    if (fire) {
      // fire glow aura
      const glow = ctx.createRadialGradient(SHOOTER_X, SHOOTER_Y, 10, SHOOTER_X, SHOOTER_Y, 45);
      glow.addColorStop(0, 'rgba(251,146,60,0.5)');
      glow.addColorStop(1, 'rgba(251,146,60,0)');
      ctx.beginPath(); ctx.arc(SHOOTER_X, SHOOTER_Y, 45, 0, Math.PI*2);
      ctx.fillStyle = glow; ctx.fill();
    }

    const bg = ctx.createRadialGradient(SHOOTER_X, SHOOTER_Y, 3, SHOOTER_X, SHOOTER_Y, 28);
    bg.addColorStop(0, fire ? '#fbbf24' : '#c4b5fd');
    bg.addColorStop(1, fire ? '#7c2d12' : '#4c1d95');
    ctx.beginPath(); ctx.arc(SHOOTER_X, SHOOTER_Y, 26, 0, Math.PI*2);
    ctx.fillStyle = bg;
    ctx.shadowColor = fire ? '#f97316' : '#7c3aed'; ctx.shadowBlur = 20;
    ctx.fill();

    const bx = SHOOTER_X + Math.cos(aimAngle) * 34;
    const by = SHOOTER_Y + Math.sin(aimAngle) * 34;
    ctx.strokeStyle = fire ? '#fde68a' : '#ddd6fe';
    ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.shadowColor = fire ? '#fbbf24' : '#a78bfa'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(SHOOTER_X, SHOOTER_Y); ctx.lineTo(bx, by); ctx.stroke();

    ctx.restore();
  }

  function drawTrail() {
    if (!projectile || !projectile.active || !fxOn) return;
    trail.forEach((t, i) => {
      const a = t.life * 0.5 * (i / trail.length);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = getRealColor(projectile.color);
      ctx.shadowColor = getRealColor(projectile.color); ctx.shadowBlur = 6;
      const s = R * 0.35 * t.life;
      ctx.beginPath(); ctx.arc(t.x, t.y, s, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      ctx.fillStyle = p.color;
      if (p.type === 'circle') {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size*p.life, 0, Math.PI*2); ctx.fill();
      } else if (p.type === 'star') {
        ctx.translate(p.x, p.y); ctx.rotate(p.life * 4);
        const s = p.size * p.life;
        ctx.beginPath();
        ctx.moveTo(0,-s); ctx.lineTo(s*0.3,-s*0.3); ctx.lineTo(s,0);
        ctx.lineTo(s*0.3,s*0.3); ctx.lineTo(0,s); ctx.lineTo(-s*0.3,s*0.3);
        ctx.lineTo(-s,0); ctx.lineTo(-s*0.3,-s*0.3);
        ctx.closePath(); ctx.fill();
      } else if (p.type === 'ring_burst') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * p.life;
        ctx.globalAlpha = p.life * 0.7;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.stroke();
      } else {
        ctx.translate(p.x, p.y); ctx.rotate(p.life * 3);
        const s = p.size * p.life;
        ctx.beginPath();
        ctx.moveTo(0,-s); ctx.lineTo(s,0); ctx.lineTo(0,s); ctx.lineTo(-s,0);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    });
  }

  function drawFloatTexts() {
    floatTexts.forEach(t => {
      ctx.save();
      ctx.globalAlpha = t.life;
      ctx.fillStyle = t.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 3;
      ctx.font = `bold ${18 + (1-t.life)*4}px "Orbitron", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    });
  }

  function draw() {
    ctx.save();
    if (screenShake.x || screenShake.y) ctx.translate(screenShake.x, screenShake.y);

    // bg
    ctx.fillStyle = 'rgba(10,10,26,0.96)';
    ctx.fillRect(0, 0, W, H);

    // hex grid ghost
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = 0.5;
    for (let r = 0; r < 20; r++)
      for (let c = 0; c < COLS; c++) {
        ctx.beginPath(); ctx.arc(colX(c,r), rowY(r), R, 0, Math.PI*2); ctx.stroke();
      }
    ctx.restore();

    // screen flash
    if (screenFlash > 0 && fxOn) {
      ctx.save();
      ctx.globalAlpha = screenFlash * 0.2;
      ctx.fillStyle = '#a78bfa';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // danger zone pulsing
    const dY = SHOOTER_Y - R * 2;
    const dangerNear = isDangerClose();
    ctx.save();
    ctx.strokeStyle = dangerNear
      ? `rgba(248,113,113,${0.4 + 0.3 * Math.sin(warnPulse)})`
      : 'rgba(248,113,113,0.2)';
    ctx.lineWidth = dangerNear ? 2 : 1;
    ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.moveTo(0, dY); ctx.lineTo(W, dY); ctx.stroke();
    if (dangerNear) {
      ctx.globalAlpha = 0.06 + 0.04 * Math.sin(warnPulse);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(0, dY, W, SHOOTER_Y - dY);
    }
    ctx.restore();

    // grid bubbles
    for (let r = 0; r < grid.length; r++)
      for (let c = 0; c < COLS; c++)
        if (grid[r][c]) drawBubble(colX(c,r), rowY(r), grid[r][c]);

    drawParticles();
    drawTrail();
    drawAimLine();
    drawShooter();

    if (projectile) drawBubble(projectile.x, projectile.y, projectile.color);

    // level-up ring
    if (screenFlash > 0.55 && fxOn) {
      ctx.save();
      ctx.strokeStyle = `rgba(167,139,250,${screenFlash - 0.55})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(SHOOTER_X, SHOOTER_Y, 40 + (1-screenFlash)*80, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }

    drawFloatTexts();
    ctx.restore();
  }

  function loop() { update(); draw(); animId = requestAnimationFrame(loop); }

  // ── Lifecycle ──────────────────────────────────────────────────────────
  function startGame() {
    score = 0; displayScore = 0; level = 1; comboCount = 0;
    particles = []; floatTexts = []; trail = [];
    totalShots = 0; hitShots = 0; screenFlash = 0;
    shots = shotsForLevel(1);
    initGrid(6);
    nextColor = rndColor(true);
    spawnProjectile();
    updateHUD();
    overlay.style.display = 'none';
    submitForm.style.display = 'none';
    gameActive = true;
    if (animId) cancelAnimationFrame(animId);
    loop();
  }

  function endGame() {
    gameActive = false;
    sndGameOver();
    if (score > bestScore) {
      bestScore = score;
      try { localStorage.setItem(LS_KEY, bestScore); } catch(e) {}
      if (bestEl) bestEl.textContent = bestScore.toLocaleString();
    }
    overlayTitle.textContent = shots <= 0 ? '💀 Out of Shots!' : '🫧 Game Over!';
    overlaySub.textContent = '';
    finalScoreT.textContent = `Your Score: ${score.toLocaleString()} — Level ${level}`;
    submitForm.style.display = 'block';
    submitResult.textContent = '';
    nameInput.value = nameInput.getAttribute('value') || '';
    startLabel.textContent = 'Play Again';
    overlay.style.display = 'flex';
  }

  // ── Score submission ───────────────────────────────────────────────────
  submitBtn && submitBtn.addEventListener('click', async () => {
    const name = (nameInput.value.trim() || 'Player').slice(0, 20);
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving…';
    try {
      const res  = await fetch('/api/save-score/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score, level })
      });
      const data = await res.json();
      if (data.success) {
        submitResult.innerHTML = `<span style="color:#34d399"><i class="bi bi-check-circle-fill me-1"></i>Saved! You ranked #${data.rank}</span>`;
        submitBtn.style.display = 'none';
      } else throw new Error(data.error);
    } catch(e) {
      submitResult.innerHTML = `<span style="color:#f87171"><i class="bi bi-x-circle me-1"></i>Error: ${e.message}</span>`;
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="bi bi-send me-2"></i>Submit Score';
    }
  });

  // ── Input ──────────────────────────────────────────────────────────────
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const dx = (e.clientX - rect.left) * scaleX - SHOOTER_X;
    const dy = (e.clientY - rect.top)  * scaleX - SHOOTER_Y;
    aimAngle = Math.max(-Math.PI + 0.12, Math.min(-0.12, Math.atan2(dy, dx)));
  });

  canvas.addEventListener('click', () => {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    shoot();
  });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const t = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    const dx = (t.clientX - rect.left) * scaleX - SHOOTER_X;
    const dy = (t.clientY - rect.top)  * scaleX - SHOOTER_Y;
    aimAngle = Math.max(-Math.PI + 0.12, Math.min(-0.12, Math.atan2(dy, dx)));
  }, { passive: false });

  canvas.addEventListener('touchend', () => {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    shoot();
  });

  startBtn && startBtn.addEventListener('click', () => {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    startGame();
  });
})();
