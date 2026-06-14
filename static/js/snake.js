// ── Snake Game ─────────────────────────────────────────────────────────────
(function(){
const canvas=document.getElementById('snakeCanvas');if(!canvas)return;
const ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height,CELL=24,COLS=W/CELL,ROWS=H/CELL;
const sScore=document.getElementById('sScore'),sBest=document.getElementById('sBest');
const sLen=document.getElementById('sLen'),sLvl=document.getElementById('sLvl');
const overlay=document.getElementById('sOverlay'),oTitle=document.getElementById('sOTitle');
const oSub=document.getElementById('sOSub'),startBtn=document.getElementById('sStart');
const startLbl=document.getElementById('sStartLbl'),scoreForm=document.getElementById('sScoreForm');
const finalEl=document.getElementById('sFinal'),nameIn=document.getElementById('sName');
const submitBtn=document.getElementById('sSubmit'),submitRes=document.getElementById('sSubmitRes');

let snake,dir,nextDir,food,goldenFood,score,best=0,gameActive=false,animId,tickInterval,level,particles=[];

function rndCell(avoid=[]){
  let c;
  do{c={x:Math.floor(Math.random()*COLS),y:Math.floor(Math.random()*ROWS)};}
  while(avoid.some(a=>a.x===c.x&&a.y===c.y));
  return c;
}

function startGame(){
  snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}];
  dir={x:1,y:0};nextDir={x:1,y:0};
  score=0;level=1;particles=[];
  food=rndCell(snake);goldenFood=null;
  updateHUD();
  overlay.style.display='none';scoreForm.style.display='none';
  gameActive=true;
  if(animId)cancelAnimationFrame(animId);
  clearInterval(tickInterval);
  tickInterval=setInterval(tick,140);
  animId=requestAnimationFrame(draw);
}

function tick(){
  if(!gameActive)return;
  dir={...nextDir};
  const head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};
  // wall collision
  if(head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS){endGame();return;}
  // self collision
  if(snake.some(s=>s.x===head.x&&s.y===head.y)){endGame();return;}
  snake.unshift(head);
  let grew=false;
  if(head.x===food.x&&head.y===food.y){
    score+=10*level;grew=true;
    spawnParticles(food.x*CELL+CELL/2,food.y*CELL+CELL/2,'#4ade80');
    food=rndCell(snake);
    if(snake.length%5===0&&!goldenFood)goldenFood=rndCell(snake);
  } else if(goldenFood&&head.x===goldenFood.x&&head.y===goldenFood.y){
    score+=50*level;grew=true;
    spawnParticles(goldenFood.x*CELL+CELL/2,goldenFood.y*CELL+CELL/2,'#fbbf24',20);
    goldenFood=null;
  }
  if(!grew)snake.pop();
  level=Math.floor(snake.length/5)+1;
  clearInterval(tickInterval);
  tickInterval=setInterval(tick,Math.max(60,140-level*10));
  updateHUD();
}

function spawnParticles(x,y,color,n=12){
  for(let i=0;i<n;i++){
    const a=Math.random()*Math.PI*2,sp=2+Math.random()*4;
    particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,color,life:1,decay:.04+Math.random()*.03,size:3+Math.random()*4});
  }
}

function updateHUD(){
  sScore.textContent=score;sBest.textContent=best;
  sLen.textContent=snake.length;sLvl.textContent=level;
}

function draw(){
  // bg
  ctx.fillStyle='rgba(10,10,26,0.96)';ctx.fillRect(0,0,W,H);
  // grid
  ctx.strokeStyle='rgba(255,255,255,0.03)';ctx.lineWidth=1;
  for(let x=0;x<COLS;x++)for(let y=0;y<ROWS;y++){ctx.strokeRect(x*CELL,y*CELL,CELL,CELL);}
  // food
  drawFood(food,'#4ade80','#16a34a');
  if(goldenFood)drawFood(goldenFood,'#fbbf24','#d97706',true);
  // snake
  snake.forEach((s,i)=>{
    const t=1-i/snake.length;
    const g=ctx.createRadialGradient(s.x*CELL+CELL/2,s.y*CELL+CELL/2,1,s.x*CELL+CELL/2,s.y*CELL+CELL/2,CELL/2);
    g.addColorStop(0,`rgba(74,222,128,${t})`);g.addColorStop(1,`rgba(22,163,74,${t*0.6})`);
    ctx.fillStyle=g;
    ctx.shadowColor='#4ade80';ctx.shadowBlur=i===0?16:6;
    ctx.beginPath();ctx.roundRect(s.x*CELL+1,s.y*CELL+1,CELL-2,CELL-2,i===0?6:4);ctx.fill();
    if(i===0){// eyes
      ctx.shadowBlur=0;ctx.fillStyle='#fff';
      const ex=s.x*CELL+(dir.x===0?CELL*0.3:dir.x>0?CELL*0.65:CELL*0.2);
      const ey=s.y*CELL+(dir.y===0?CELL*0.3:dir.y>0?CELL*0.65:CELL*0.2);
      ctx.beginPath();ctx.arc(ex,ey,3,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#000';ctx.beginPath();ctx.arc(ex+dir.x,ey+dir.y,1.5,0,Math.PI*2);ctx.fill();
    }
  });
  ctx.shadowBlur=0;
  // particles
  particles=particles.filter(p=>{
    ctx.save();ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=8;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2);ctx.fill();ctx.restore();
    p.x+=p.vx;p.y+=p.vy;p.vy+=.1;p.life-=p.decay;return p.life>0;
  });
  animId=requestAnimationFrame(draw);
}

function drawFood(f,c1,c2,golden=false){
  ctx.save();
  const g=ctx.createRadialGradient(f.x*CELL+CELL*.35,f.y*CELL+CELL*.35,1,f.x*CELL+CELL/2,f.y*CELL+CELL/2,CELL/2-2);
  g.addColorStop(0,'rgba(255,255,255,0.7)');g.addColorStop(.4,c1);g.addColorStop(1,c2);
  ctx.fillStyle=g;ctx.shadowColor=c1;ctx.shadowBlur=golden?20:12;
  if(golden){ctx.save();ctx.translate(f.x*CELL+CELL/2,f.y*CELL+CELL/2);
    ctx.rotate(Date.now()*.003);ctx.fillRect(-CELL*.35,-CELL*.35,CELL*.7,CELL*.7);ctx.restore();}
  else{ctx.beginPath();ctx.arc(f.x*CELL+CELL/2,f.y*CELL+CELL/2,CELL/2-3,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}

function endGame(){
  gameActive=false;clearInterval(tickInterval);
  if(score>best){best=score;sBest.textContent=best;}
  oTitle.textContent='💀 Game Over!';oSub.textContent='';
  finalEl.textContent=`Score: ${score} — Length: ${snake.length}`;
  scoreForm.style.display='block';submitRes.textContent='';nameIn.value='';
  submitBtn.disabled=false;submitBtn.innerHTML='<i class="bi bi-send me-2"></i>Submit Score';
  submitBtn.style.display='';startLbl.textContent='Play Again';
  overlay.style.display='flex';
}

submitBtn.addEventListener('click',async()=>{
  const name=(nameIn.value.trim()||'Player').slice(0,20);
  submitBtn.disabled=true;submitBtn.innerHTML='<span class="spinner-border spinner-border-sm me-2"></span>Saving…';
  try{const res=await fetch('/api/save-score/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,score,level,game:'snake'})});
    const d=await res.json();if(d.success){submitRes.innerHTML=`<span style="color:#34d399"><i class="bi bi-check-circle-fill me-1"></i>Saved! Rank #${d.rank}</span>`;submitBtn.style.display='none';}
    else throw new Error(d.error);}
  catch(e){submitRes.innerHTML=`<span style="color:#f87171">${e.message}</span>`;submitBtn.disabled=false;submitBtn.innerHTML='<i class="bi bi-send me-2"></i>Submit Score';}
});

// Controls
document.addEventListener('keydown',e=>{
  if(e.key==='ArrowUp'||e.key==='w'){e.preventDefault();if(dir.y!==1)nextDir={x:0,y:-1};}
  if(e.key==='ArrowDown'||e.key==='s'){e.preventDefault();if(dir.y!==-1)nextDir={x:0,y:1};}
  if(e.key==='ArrowLeft'||e.key==='a'){e.preventDefault();if(dir.x!==1)nextDir={x:-1,y:0};}
  if(e.key==='ArrowRight'||e.key==='d'){e.preventDefault();if(dir.x!==-1)nextDir={x:1,y:0};}
  if(e.key==='p'||e.key==='P'){gameActive=!gameActive;if(gameActive)tickInterval=setInterval(tick,Math.max(60,140-level*10));}
});
window.snakeDpad=function(d){
  if(d==='up'&&dir.y!==1)nextDir={x:0,y:-1};
  if(d==='down'&&dir.y!==-1)nextDir={x:0,y:1};
  if(d==='left'&&dir.x!==1)nextDir={x:-1,y:0};
  if(d==='right'&&dir.x!==-1)nextDir={x:1,y:0};
};
startBtn.addEventListener('click',startGame);
})();
