// ── Bubble Shooter — ZayroPlay ───────────────────────────────────────────────
'use strict';

const canvas = document.getElementById('bubbleCanvas');
const ctx    = canvas.getContext('2d');

const COLS   = 9;
const ROWS   = 13;
const R      = 26;          // bubble radius
const DX     = R * 2;       // col step
const DY     = R * 1.74;    // row step (hex)
const OFF    = R;            // odd-row x offset
const SPEED  = 14;
const COLORS = ['#ef4444','#3b82f6','#22c55e','#fbbf24','#a855f7','#f97316'];
const FILL_ROWS = 5;         // pre-filled rows at start

// grid[r][c] = color string | null
let grid = [];
let projectile   = null;
let nextColor    = null;
let score        = 0;
let level        = 1;
let movesLeft    = 30;
let running      = false;
let animId       = null;
let pendingSnap  = false;

/* ── Audio ── */
let AC = null;
function getAC(){
  if(!AC) try{ AC=new(window.AudioContext||window.webkitAudioContext)(); }catch(e){}
  if(AC && AC.state==='suspended') AC.resume();
  return AC;
}
function tone(f,t,type='sine',v=0.15){
  if(!window.zpSoundOn) return;
  try{
    const ac=getAC(); if(!ac) return;
    const o=ac.createOscillator(),g=ac.createGain();
    o.connect(g);g.connect(ac.destination);
    o.type=type;o.frequency.value=f;
    g.gain.setValueAtTime(v,ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+t);
    o.start();o.stop(ac.currentTime+t);
  }catch(e){}
}
function sndShoot(){ tone(300,.08,'triangle',.1); }
function sndPop(n){
  const f=440+n*30;
  tone(f,.1);setTimeout(()=>tone(f*1.25,.08),60);
  if(n>=5)setTimeout(()=>tone(f*1.5,.12),120);
}
function sndBounce(){ tone(200,.04,'square',.06); }
function sndLevelUp(){ [440,550,660,880].forEach((f,i)=>setTimeout(()=>tone(f,.2,.sine,.2),i*80)); }
function sndFail(){ tone(180,.4,'sawtooth',.15);setTimeout(()=>tone(130,.5,'sawtooth',.12),220); }

/* ── Grid helpers ── */
function colX(c, r){ return c * DX + R + (r % 2 ? OFF : 0); }
function rowY(r)    { return r * DY + R + 2; }

function initGrid(){
  grid = Array.from({length:ROWS}, ()=> Array(COLS).fill(null));
  for(let r=0;r<FILL_ROWS;r++)
    for(let c=0;c<COLS;c++)
      grid[r][c] = COLORS[Math.floor(Math.random()*COLORS.length)];
}

function randomColor(){
  // use only colors present in grid (+ 1 random to avoid lock)
  const present = [...new Set(grid.flat().filter(Boolean))];
  if(!present.length) return COLORS[Math.floor(Math.random()*COLORS.length)];
  const pool = present.length > 2
    ? present
    : [...present, COLORS[Math.floor(Math.random()*COLORS.length)]];
  return pool[Math.floor(Math.random()*pool.length)];
}

/* ── Drawing ── */
function drawBubble(x,y,color,alpha=1,scale=1){
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x,y);
  ctx.scale(scale,scale);

  // shadow glow
  ctx.shadowColor = color;
  ctx.shadowBlur  = 14;

  // gradient sphere
  const grd = ctx.createRadialGradient(-R*.3,-R*.35,R*.08,-R*.1,-R*.1,R*.95);
  grd.addColorStop(0,'rgba(255,255,255,.65)');
  grd.addColorStop(0.35,color);
  grd.addColorStop(1,shadeColor(color,-50));
  ctx.beginPath();
  ctx.arc(0,0,R-.5,0,Math.PI*2);
  ctx.fillStyle=grd;
  ctx.fill();

  // shine
  ctx.shadowBlur=0;
  const shine=ctx.createRadialGradient(-R*.3,-R*.38,0,-R*.3,-R*.38,R*.45);
  shine.addColorStop(0,'rgba(255,255,255,.55)');
  shine.addColorStop(1,'rgba(255,255,255,0)');
  ctx.beginPath();
  ctx.arc(-R*.28,-R*.35,R*.4,0,Math.PI*2);
  ctx.fillStyle=shine;
  ctx.fill();

  ctx.restore();
}

function shadeColor(hex,pct){
  const n=parseInt(hex.slice(1),16);
  const r=Math.min(255,Math.max(0,((n>>16)&0xff)+pct));
  const g=Math.min(255,Math.max(0,((n>>8)&0xff)+pct));
  const b=Math.min(255,Math.max(0,(n&0xff)+pct));
  return `rgb(${r},${g},${b})`;
}

function drawGrid(){
  for(let r=0;r<ROWS;r++)
    for(let c=0;c<COLS;c++)
      if(grid[r][c])
        drawBubble(colX(c,r), rowY(r), grid[r][c]);
}

/* ── Aim line ── */
let mouseX = canvas.width/2, mouseY = canvas.height - 60;

function drawAim(){
  if(!running || projectile) return;
  const sx = canvas.width/2, sy = canvas.height - 55;
  const dx = mouseX - sx, dy = mouseY - sy;
  const len = Math.hypot(dx,dy);
  if(len<1) return;
  const vx = dx/len * SPEED, vy = dy/len * SPEED;

  let x=sx,y=sy,pvx=vx,pvy=vy;
  ctx.save();
  ctx.setLineDash([6,10]);
  ctx.strokeStyle='rgba(255,255,255,.3)';
  ctx.lineWidth=2;
  ctx.beginPath();
  ctx.moveTo(x,y);

  for(let i=0;i<80;i++){
    x+=pvx; y+=pvy;
    if(x-R<0){x=R;pvx=-pvx;}
    if(x+R>canvas.width){x=canvas.width-R;pvx=-pvx;}
    if(y<R) break;
    ctx.lineTo(x,y);
  }
  ctx.stroke();
  ctx.restore();
}

/* ── Shooter ── */
function drawShooter(){
  const sx=canvas.width/2, sy=canvas.height-55;

  // base
  ctx.save();
  const bg=ctx.createRadialGradient(sx,sy+10,5,sx,sy,40);
  bg.addColorStop(0,'rgba(124,58,237,.6)');
  bg.addColorStop(1,'rgba(124,58,237,0)');
  ctx.fillStyle=bg;
  ctx.beginPath();ctx.arc(sx,sy+10,38,0,Math.PI*2);ctx.fill();
  ctx.restore();

  // current bubble
  if(nextColor) drawBubble(sx, sy, nextColor, 1, 1);

  // label NEXT
  if(nextColor){
    ctx.save();
    ctx.font='bold 10px Orbitron,sans-serif';
    ctx.fillStyle='rgba(255,255,255,.5)';
    ctx.textAlign='center';
    ctx.fillText('SHOOT', sx, canvas.height-8);
    ctx.restore();
  }
}

/* ── Projectile ── */
function shoot(){
  if(!running || projectile || !nextColor) return;
  const sx=canvas.width/2, sy=canvas.height-55;
  const dx=mouseX-sx, dy=mouseY-sy;
  const len=Math.hypot(dx,dy);
  if(len<1||dy>0) return; // must shoot upward
  projectile={
    x:sx,y:sy,
    vx:(dx/len)*SPEED,
    vy:(dy/len)*SPEED,
    color:nextColor
  };
  nextColor=randomColor();
  movesLeft--;
  window.zpSetMoves && window.zpSetMoves(movesLeft, level*30);
  sndShoot();
  getAC();
}

function updateProjectile(){
  if(!projectile) return;
  projectile.x += projectile.vx;
  projectile.y += projectile.vy;

  // wall bounce
  if(projectile.x-R < 0){ projectile.x=R; projectile.vx=-projectile.vx; sndBounce(); }
  if(projectile.x+R > canvas.width){ projectile.x=canvas.width-R; projectile.vx=-projectile.vx; sndBounce(); }

  // ceiling
  if(projectile.y-R <= rowY(0)-R){
    snapProjectile();
    return;
  }

  // collision with grid bubbles
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      if(!grid[r][c]) continue;
      const bx=colX(c,r), by=rowY(r);
      if(Math.hypot(projectile.x-bx, projectile.y-by) < R*1.9){
        snapProjectile();
        return;
      }
    }
  }
}

function snapProjectile(){
  if(!projectile||pendingSnap) return;
  pendingSnap=true;
  // find nearest empty cell
  let best=null, bestD=Infinity;
  for(let r=0;r<ROWS;r++){
    for(let c=0;c<COLS;c++){
      if(grid[r][c]) continue;
      const d=Math.hypot(projectile.x-colX(c,r), projectile.y-rowY(r));
      if(d<bestD){bestD=d;best={r,c};}
    }
  }
  if(!best){ projectile=null;pendingSnap=false;return; }
  grid[best.r][best.c]=projectile.color;

  // find matches
  const matched=floodFill(best.r,best.c,projectile.color);
  if(matched.length>=3){
    matched.forEach(({r,c})=>grid[r][c]=null);
    const gained = matched.length*10*(level);
    score+=gained;
    window.zpSetScore && window.zpSetScore(score);
    sndPop(matched.length);
    removeFloating();
    checkLevelWin();
  }

  projectile=null;
  pendingSnap=false;

  // check game over (bubbles too low)
  if(movesLeft<=0 && score < level*500){
    setTimeout(()=>endGame(false),300);
  }
}

/* ── Flood fill ── */
function floodFill(sr,sc,color){
  const visited=new Set(), queue=[{r:sr,c:sc}], found=[];
  visited.add(`${sr},${sc}`);
  while(queue.length){
    const {r,c}=queue.shift();
    if(grid[r][c]===color) found.push({r,c});
    for(const [nr,nc] of neighbors(r,c)){
      const key=`${nr},${nc}`;
      if(!visited.has(key)&&grid[nr]&&grid[nr][nc]===color){
        visited.add(key);queue.push({r:nr,c:nc});
      }
    }
  }
  return found;
}

function neighbors(r,c){
  const odd=r%2;
  return [
    [r-1,c+(odd?0:-1)],[r-1,c+(odd?1:0)],
    [r,c-1],[r,c+1],
    [r+1,c+(odd?0:-1)],[r+1,c+(odd?1:0)],
  ].filter(([nr,nc])=>nr>=0&&nr<ROWS&&nc>=0&&nc<COLS);
}

/* ── Remove floating bubbles ── */
function removeFloating(){
  // BFS from row 0 to find connected
  const connected=new Set();
  const queue=[];
  for(let c=0;c<COLS;c++) if(grid[0][c]){queue.push({r:0,c});connected.add(`0,${c}`);}
  while(queue.length){
    const {r,c}=queue.shift();
    for(const [nr,nc] of neighbors(r,c)){
      const key=`${nr},${nc}`;
      if(!connected.has(key)&&grid[nr]&&grid[nr][nc]){
        connected.add(key);queue.push({r:nr,c:nc});
      }
    }
  }
  let bonus=0;
  for(let r=0;r<ROWS;r++)
    for(let c=0;c<COLS;c++)
      if(grid[r][c]&&!connected.has(`${r},${c}`)){
        grid[r][c]=null; bonus+=5;
      }
  if(bonus){score+=bonus;window.zpSetScore&&window.zpSetScore(score);}
}

/* ── Level / Game over ── */
function checkLevelWin(){
  const remaining=grid.flat().filter(Boolean).length;
  if(remaining===0||score>=level*500){
    setTimeout(()=>nextLevel(),400);
  }
}

function nextLevel(){
  level++;
  movesLeft=level*30;
  sndLevelUp();
  window.zpSetLevel&&window.zpSetLevel(level);
  window.zpSetMoves&&window.zpSetMoves(movesLeft,movesLeft);
  window.zpSetTarget&&window.zpSetTarget(level*500);
  // add new rows
  grid.unshift(...Array.from({length:2},()=>
    Array.from({length:COLS},()=>
      Math.random()<.7?COLORS[Math.floor(Math.random()*COLORS.length)]:null
    )
  ));
  grid=grid.slice(0,ROWS);
}

function endGame(won){
  running=false;
  cancelAnimationFrame(animId);
  const overlay=document.getElementById('bOverlay');
  const title=document.getElementById('bOverlayTitle');
  const sub=document.getElementById('bOverlaySub');
  const form=document.getElementById('bScoreForm');
  const finalEl=document.getElementById('bFinalScore');
  overlay.style.display='flex';
  if(won){
    title.textContent='🎉 You Win!';
    sub.textContent=`Amazing! Level ${level} cleared. Score: ${score}`;
    sndLevelUp();
  } else {
    title.textContent='💥 Game Over';
    sub.textContent=`You scored ${score} points. Try again!`;
    sndFail();
  }
  if(finalEl) finalEl.textContent=`Final Score: ${score}`;
  if(form) form.style.display='block';
  document.getElementById('bStartLabel').textContent='Play Again';
}

/* ── Main loop ── */
function gameLoop(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // background grid lines (subtle)
  ctx.save();
  ctx.strokeStyle='rgba(255,255,255,.03)';
  for(let r=0;r<ROWS;r++)
    for(let c=0;c<COLS;c++){
      ctx.beginPath();
      ctx.arc(colX(c,r),rowY(r),R-.5,0,Math.PI*2);
      ctx.stroke();
    }
  ctx.restore();

  drawGrid();
  drawAim();
  if(projectile) drawBubble(projectile.x,projectile.y,projectile.color);
  updateProjectile();
  drawShooter();

  animId=requestAnimationFrame(gameLoop);
}

/* ── Start / Restart ── */
function startGame(){
  score=0; level=1; movesLeft=30; projectile=null; pendingSnap=false;
  initGrid();
  nextColor=randomColor();
  window.zpSetScore&&window.zpSetScore(0);
  window.zpSetLevel&&window.zpSetLevel(1);
  window.zpSetMoves&&window.zpSetMoves(30,30);
  window.zpSetTarget&&window.zpSetTarget(500);
  cancelAnimationFrame(animId);
  running=true;
  gameLoop();
}

/* ── Input ── */
canvas.addEventListener('mousemove',e=>{
  const r=canvas.getBoundingClientRect();
  mouseX=e.clientX-r.left;
  mouseY=e.clientY-r.top;
});
canvas.addEventListener('click',e=>{
  if(!running) return;
  const r=canvas.getBoundingClientRect();
  mouseX=e.clientX-r.left;
  mouseY=e.clientY-r.top;
  shoot();
  getAC();
});
canvas.addEventListener('touchmove',e=>{
  e.preventDefault();
  const r=canvas.getBoundingClientRect();
  mouseX=e.touches[0].clientX-r.left;
  mouseY=e.touches[0].clientY-r.top;
},{passive:false});
canvas.addEventListener('touchend',e=>{
  e.preventDefault();
  shoot();
},{passive:false});

/* ── UI wiring ── */
document.getElementById('bStartBtn').addEventListener('click',()=>{
  document.getElementById('bOverlay').style.display='none';
  startGame();
});

document.getElementById('bSubmitBtn')?.addEventListener('click',async()=>{
  const name=document.getElementById('bNameInput').value.trim()||'Player';
  const res=await fetch('/api/save-score/',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name,score,level,game:'bubble'})
  });
  const data=await res.json();
  const el=document.getElementById('bSubmitResult');
  if(data.success) el.innerHTML=`<span style="color:#4ade80">🏆 Rank #${data.rank}! Score saved.</span>`;
  else el.innerHTML=`<span style="color:#f87171">Error saving score.</span>`;
});

window.zpSoundOn=true;
