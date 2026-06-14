// ── Bubble Shooter — Full Game Engine ──────────────────────────────────────
(function () {
  const canvas  = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx     = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // DOM refs
  const scoreEl     = document.getElementById('scoreDisplay');
  const levelEl     = document.getElementById('levelDisplay');
  const shotsEl     = document.getElementById('shotsDisplay');
  const bestEl      = document.getElementById('bestScoreDisplay');
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

  // ── Constants ──────────────────────────────────────────────────────────
  const R       = 22;
  const COLS    = 10;
  const SHOOTER_X = W / 2;
  const SHOOTER_Y = H - 50;
  const COLORS  = ['#f472b6','#a78bfa','#34d399','#fbbf24','#38bdf8','#f87171','#4ade80','#fb923c'];

  // ── State ──────────────────────────────────────────────────────────────
  let grid=[], projectile=null, nextColor=null;
  function shotsForLevel(lvl){ return Math.max(10, Math.round(50 / lvl)); }
  let score=0, shots=shotsForLevel(1), level=1, bestScore=0;
  let aimAngle=-Math.PI/2, gameActive=false, animId=null;
  let particles=[], screenFlash=0, comboCount=0;

  // ── Helpers ────────────────────────────────────────────────────────────
  function colX(c,r){ return R + c*(R*2) + (r%2===0?0:R); }
  function rowY(r)  { return R + r*(R*1.73); }
  function rndColor(){ return COLORS[Math.floor(Math.random()*Math.min(4+level,COLORS.length))]; }

  // ── Grid ───────────────────────────────────────────────────────────────
  function initGrid(rows){
    grid=[];
    for(let r=0;r<rows;r++){
      grid[r]=[];
      for(let c=0;c<COLS;c++) grid[r][c]=rndColor();
    }
  }

  // ── Projectile ─────────────────────────────────────────────────────────
  function spawnProjectile(){
    const color = nextColor || rndColor();
    nextColor = rndColor();
    projectile = { x:SHOOTER_X, y:SHOOTER_Y, vx:0, vy:0, color, active:false };
    if(nextPreview) nextPreview.style.background = nextColor;
  }

  function shoot(){
    if(!gameActive || (projectile && projectile.active)) return;
    if(shots<=0){ endGame(); return; }
    shots--;
    updateHUD();
    projectile.vx = Math.cos(aimAngle)*11;
    projectile.vy = Math.sin(aimAngle)*11;
    projectile.active = true;
  }

  // ── Snap ──────────────────────────────────────────────────────────────
  function snapToGrid(x,y){
    let bestR=0,bestC=0,bestD=Infinity;
    const maxR = Math.min(grid.length+2, 20);
    for(let r=0;r<maxR;r++){
      for(let c=0;c<COLS;c++){
        if(grid[r]&&grid[r][c]) continue;
        const d=Math.hypot(x-colX(c,r),y-rowY(r));
        if(d<bestD){bestD=d;bestR=r;bestC=c;}
      }
    }
    return {row:bestR,col:bestC};
  }

  function placeBubble(r,c,color){
    while(grid.length<=r) grid.push(new Array(COLS).fill(null));
    grid[r][c]=color;
  }

  // ── BFS ───────────────────────────────────────────────────────────────
  function getCluster(r,c){
    const color=grid[r]?.[c]; if(!color) return [];
    const vis=new Set(), q=[[r,c]], res=[];
    while(q.length){
      const [cr,cc]=q.shift(), k=`${cr},${cc}`;
      if(vis.has(k)||grid[cr]?.[cc]!==color) continue;
      vis.add(k); res.push([cr,cc]);
      for(const [nr,nc] of nbrs(cr,cc)) q.push([nr,nc]);
    }
    return res;
  }

  function nbrs(r,c){
    const e=r%2===0;
    return [[r-1,e?c-1:c],[r-1,e?c:c+1],[r,c-1],[r,c+1],[r+1,e?c-1:c],[r+1,e?c:c+1]]
      .filter(([nr,nc])=>nr>=0&&nc>=0&&nc<COLS);
  }

  function getFloating(){
    const conn=new Set();
    for(let c=0;c<COLS;c++) if(grid[0]?.[c]) bfsConn(0,c,conn);
    const fl=[];
    for(let r=0;r<grid.length;r++)
      for(let c=0;c<COLS;c++)
        if(grid[r][c]&&!conn.has(`${r},${c}`)) fl.push([r,c]);
    return fl;
  }

  function bfsConn(sr,sc,vis){
    const q=[[sr,sc]];
    while(q.length){
      const [r,c]=q.shift(), k=`${r},${c}`;
      if(vis.has(k)||!grid[r]?.[c]) continue;
      vis.add(k);
      for(const [nr,nc] of nbrs(r,c)) q.push([nr,nc]);
    }
  }

  // ── Particles ─────────────────────────────────────────────────────────
  function spawnParticles(x,y,color,n=14){
    for(let i=0;i<n;i++){
      const a=Math.random()*Math.PI*2, sp=2+Math.random()*5;
      particles.push({
        x,y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp,
        color, life:1, decay:0.025+Math.random()*0.03,
        size:3+Math.random()*6, type:Math.random()<0.5?'circle':'star'
      });
    }
  }

  // ── HUD ───────────────────────────────────────────────────────────────
  function updateHUD(){
    if(scoreEl) scoreEl.textContent = score.toLocaleString();
    if(levelEl) levelEl.textContent = level;
    if(shotsEl) shotsEl.textContent = shots;
  }

  // ── Update ────────────────────────────────────────────────────────────
  function update(){
    if(!gameActive) return;

    screenFlash = Math.max(0, screenFlash-0.04);

    particles = particles.filter(p=>{
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.1; p.life-=p.decay; return p.life>0;
    });

    if(!projectile||!projectile.active) return;

    projectile.x+=projectile.vx;
    projectile.y+=projectile.vy;

    if(projectile.x-R<0)  { projectile.x=R; projectile.vx*=-1; }
    if(projectile.x+R>W)  { projectile.x=W-R; projectile.vx*=-1; }
    if(projectile.y-R<0)  { landBubble(); return; }
    if(projectile.y>H+R)  { spawnProjectile(); return; }

    for(let r=0;r<grid.length;r++){
      for(let c=0;c<COLS;c++){
        if(!grid[r][c]) continue;
        if(Math.hypot(projectile.x-colX(c,r), projectile.y-rowY(r)) < R*1.92){
          landBubble(); return;
        }
      }
    }
  }

  function landBubble(){
    const {row,col}=snapToGrid(projectile.x,projectile.y);
    placeBubble(row,col,projectile.color);

    const cluster=getCluster(row,col);
    if(cluster.length>=3){
      comboCount++;
      const mult = Math.min(comboCount,5);
      cluster.forEach(([r,c])=>{ spawnParticles(colX(c,r),rowY(r),grid[r][c]); grid[r][c]=null; });
      score += cluster.length*10*level*mult;

      const floating=getFloating();
      floating.forEach(([r,c])=>{ spawnParticles(colX(c,r),rowY(r),grid[r][c],7); grid[r][c]=null; score+=5; });

      screenFlash=0.4;
      updateHUD();
    } else {
      comboCount=0;
    }

    if(isGridEmpty()){ levelUp(); return; }
    if(isGameLost()||shots<=0){ endGame(); return; }
    spawnProjectile();
  }

  function levelUp(){
    level++;
    shots=shotsForLevel(level);
    screenFlash=0.6;
    setTimeout(()=>{
      initGrid(5+level);
      updateHUD();
      spawnProjectile();
    },400);
  }

  function isGridEmpty(){ return grid.every(r=>r.every(c=>!c)); }
  function isGameLost(){
    for(let r=0;r<grid.length;r++)
      for(let c=0;c<COLS;c++)
        if(grid[r][c]&&rowY(r)+R>SHOOTER_Y-R*2) return true;
    return false;
  }

  // ── Draw ──────────────────────────────────────────────────────────────
  function shade(hex,amt){
    const n=parseInt(hex.replace('#',''),16);
    const r=Math.min(255,Math.max(0,(n>>16)+amt));
    const g=Math.min(255,Math.max(0,((n>>8)&0xFF)+amt));
    const b=Math.min(255,Math.max(0,(n&0xFF)+amt));
    return `rgb(${r},${g},${b})`;
  }

  function drawBubble(x,y,color,alpha=1,scale=1){
    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.translate(x,y);
    ctx.scale(scale,scale);

    // outer glow
    ctx.shadowColor=color;
    ctx.shadowBlur=14;

    const g=ctx.createRadialGradient(-R*0.3,-R*0.3,R*0.08,0,0,R);
    g.addColorStop(0,'rgba(255,255,255,0.65)');
    g.addColorStop(0.4,color);
    g.addColorStop(1,shade(color,-50));

    ctx.beginPath();
    ctx.arc(0,0,R-1,0,Math.PI*2);
    ctx.fillStyle=g;
    ctx.fill();

    // specular
    ctx.shadowBlur=0;
    ctx.beginPath();
    ctx.arc(-R*0.28,-R*0.3,R*0.22,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.fill();

    ctx.restore();
  }

  function drawAimLine(){
    if(!projectile||projectile.active) return;
    ctx.save();
    ctx.strokeStyle='rgba(255,255,255,0.18)';
    ctx.setLineDash([7,9]);
    ctx.lineWidth=1.5;
    ctx.beginPath();
    let x=SHOOTER_X, y=SHOOTER_Y;
    let vx=Math.cos(aimAngle)*11, vy=Math.sin(aimAngle)*11;
    ctx.moveTo(x,y);
    for(let i=0;i<35;i++){
      x+=vx; y+=vy;
      if(x-R<0||x+R>W){ vx*=-1; x+=vx*2; }
      if(y<0) break;
      ctx.lineTo(x,y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawShooter(){
    ctx.save();
    // base platform
    const bg=ctx.createRadialGradient(SHOOTER_X,SHOOTER_Y,3,SHOOTER_X,SHOOTER_Y,28);
    bg.addColorStop(0,'#c4b5fd');
    bg.addColorStop(1,'#4c1d95');
    ctx.beginPath();
    ctx.arc(SHOOTER_X,SHOOTER_Y,26,0,Math.PI*2);
    ctx.fillStyle=bg;
    ctx.shadowColor='#7c3aed';
    ctx.shadowBlur=20;
    ctx.fill();

    // barrel
    const bx=SHOOTER_X+Math.cos(aimAngle)*34;
    const by=SHOOTER_Y+Math.sin(aimAngle)*34;
    ctx.strokeStyle='#ddd6fe';
    ctx.lineWidth=9;
    ctx.lineCap='round';
    ctx.shadowColor='#a78bfa';
    ctx.shadowBlur=12;
    ctx.beginPath();
    ctx.moveTo(SHOOTER_X,SHOOTER_Y);
    ctx.lineTo(bx,by);
    ctx.stroke();

    ctx.restore();
  }

  function drawParticles(){
    particles.forEach(p=>{
      ctx.save();
      ctx.globalAlpha=p.life;
      ctx.shadowColor=p.color;
      ctx.shadowBlur=10;
      ctx.fillStyle=p.color;
      if(p.type==='circle'){
        ctx.beginPath();
        ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2);
        ctx.fill();
      } else {
        // small diamond
        ctx.translate(p.x,p.y);
        ctx.rotate(p.life*3);
        const s=p.size*p.life;
        ctx.beginPath();
        ctx.moveTo(0,-s); ctx.lineTo(s,0); ctx.lineTo(0,s); ctx.lineTo(-s,0);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    });
  }

  function draw(){
    // bg
    ctx.fillStyle='rgba(10,10,26,0.96)';
    ctx.fillRect(0,0,W,H);

    // subtle hex pattern
    ctx.save();
    ctx.strokeStyle='rgba(255,255,255,0.025)';
    ctx.lineWidth=0.5;
    for(let r=0;r<20;r++)
      for(let c=0;c<COLS;c++){
        ctx.beginPath();
        ctx.arc(colX(c,r),rowY(r),R,0,Math.PI*2);
        ctx.stroke();
      }
    ctx.restore();

    // screen flash on pop
    if(screenFlash>0){
      ctx.save();
      ctx.globalAlpha=screenFlash*0.18;
      ctx.fillStyle='#a78bfa';
      ctx.fillRect(0,0,W,H);
      ctx.restore();
    }

    // grid bubbles
    for(let r=0;r<grid.length;r++)
      for(let c=0;c<COLS;c++)
        if(grid[r][c]) drawBubble(colX(c,r),rowY(r),grid[r][c]);

    drawParticles();
    drawAimLine();
    drawShooter();

    if(projectile) drawBubble(projectile.x,projectile.y,projectile.color);

    // danger line
    const dY=SHOOTER_Y-R*2;
    ctx.save();
    ctx.strokeStyle='rgba(248,113,113,0.2)';
    ctx.lineWidth=1;
    ctx.setLineDash([4,6]);
    ctx.beginPath(); ctx.moveTo(0,dY); ctx.lineTo(W,dY); ctx.stroke();
    ctx.restore();

    // level up flash ring
    if(screenFlash>0.45){
      ctx.save();
      ctx.strokeStyle=`rgba(52,211,153,${screenFlash-0.45})`;
      ctx.lineWidth=4;
      ctx.beginPath();
      ctx.arc(SHOOTER_X,SHOOTER_Y,40+(1-screenFlash)*60,0,Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function loop(){ update(); draw(); animId=requestAnimationFrame(loop); }

  // ── Game lifecycle ─────────────────────────────────────────────────────
  function startGame(){
    score=0; level=1; shots=shotsForLevel(1); comboCount=0; particles=[];
    updateHUD();
    initGrid(6);
    nextColor=rndColor();
    spawnProjectile();
    overlay.style.display='none';
    submitForm.style.display='none';
    gameActive=true;
    if(animId) cancelAnimationFrame(animId);
    loop();
  }

  function endGame(){
    gameActive=false;
    if(score>bestScore){ bestScore=score; if(bestEl) bestEl.textContent=bestScore.toLocaleString(); }

    overlayTitle.textContent = shots<=0 ? '💀 Out of Shots!' : '🫧 Game Over!';
    overlaySub.textContent = '';
    finalScoreT.textContent = `Your Score: ${score.toLocaleString()} — Level ${level}`;
    submitForm.style.display='block';
    submitResult.textContent='';
    nameInput.value='';
    startLabel.textContent='Play Again';
    overlay.style.display='flex';
  }

  // ── Score submission ───────────────────────────────────────────────────
  submitBtn.addEventListener('click', async ()=>{
    const name=(nameInput.value.trim()||'Player').slice(0,20);
    submitBtn.disabled=true;
    submitBtn.innerHTML='<span class="spinner-border spinner-border-sm me-2"></span>Saving…';
    try {
      const res=await fetch('/api/save-score/',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({name,score,level})
      });
      const data=await res.json();
      if(data.success){
        submitResult.innerHTML=`<span style="color:#34d399"><i class="bi bi-check-circle-fill me-1"></i>Saved! You ranked #${data.rank}</span>`;
        submitBtn.style.display='none';
      } else throw new Error(data.error);
    } catch(e){
      submitResult.innerHTML=`<span style="color:#f87171"><i class="bi bi-x-circle me-1"></i>Error: ${e.message}</span>`;
      submitBtn.disabled=false;
      submitBtn.innerHTML='<i class="bi bi-send me-2"></i>Submit Score';
    }
  });

  // ── Input ──────────────────────────────────────────────────────────────
  canvas.addEventListener('mousemove',e=>{
    const rect=canvas.getBoundingClientRect();
    const dx=e.clientX-rect.left-SHOOTER_X;
    const dy=e.clientY-rect.top-SHOOTER_Y;
    aimAngle=Math.max(-Math.PI+0.12,Math.min(-0.12,Math.atan2(dy,dx)));
  });

  canvas.addEventListener('click',shoot);

  canvas.addEventListener('touchmove',e=>{
    e.preventDefault();
    const t=e.touches[0];
    const rect=canvas.getBoundingClientRect();
    const dx=t.clientX-rect.left-SHOOTER_X;
    const dy=t.clientY-rect.top-SHOOTER_Y;
    aimAngle=Math.max(-Math.PI+0.12,Math.min(-0.12,Math.atan2(dy,dx)));
  },{passive:false});

  canvas.addEventListener('touchend',shoot);
  startBtn.addEventListener('click',startGame);
})();
