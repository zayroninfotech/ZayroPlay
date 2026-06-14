// ── Flappy Bird ────────────────────────────────────────────────────────────
(function(){
const canvas=document.getElementById('flappyCanvas');if(!canvas)return;
const ctx=canvas.getContext('2d');
const W=canvas.width,H=canvas.height;
const fScore=document.getElementById('fScore'),fBest=document.getElementById('fBest');
const fSpeed=document.getElementById('fSpeed');
const overlay=document.getElementById('fOverlay'),oTitle=document.getElementById('fOTitle');
const oSub=document.getElementById('fOSub'),startBtn=document.getElementById('fStart');
const startLbl=document.getElementById('fStartLbl'),scoreForm=document.getElementById('fScoreForm');
const finalEl=document.getElementById('fFinal'),nameIn=document.getElementById('fName');
const submitBtn=document.getElementById('fSubmit'),submitRes=document.getElementById('fSubmitRes');

const PIPE_W=56,GAP=145,GRAVITY=0.38,FLAP=-8,BIRD_X=80,BIRD_R=16;
let bird,pipes,score,best=0,pipeSpeed,gameActive=false,animId,frame=0,particles=[];
let clouds=[{x:80,y:60,w:100},{x:240,y:35,w:80},{x:340,y:80,w:120}];

function startGame(){
  bird={y:H/2,vy:0,angle:0,flapAnim:0};
  pipes=[];score=0;pipeSpeed=2.8;frame=0;particles=[];
  fScore.textContent=0;fSpeed.textContent='1x';
  overlay.style.display='none';scoreForm.style.display='none';
  gameActive=true;
  if(animId)cancelAnimationFrame(animId);
  loop();
}

function flap(){if(!gameActive)return;bird.vy=FLAP;bird.flapAnim=1;}

function spawnPipe(){
  const minH=60,maxH=H-GAP-80;
  const topH=minH+Math.random()*(maxH-minH);
  pipes.push({x:W+10,topH,scored:false});
}

function spawnParticles(x,y){
  for(let i=0;i<16;i++){
    const a=Math.random()*Math.PI*2,sp=2+Math.random()*5;
    const cols=['#38bdf8','#6366f1','#fff','#fbbf24'];
    particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,color:cols[Math.floor(Math.random()*cols.length)],life:1,decay:.03+Math.random()*.03,size:3+Math.random()*5});
  }
}

function update(){
  frame++;
  bird.vy+=GRAVITY;bird.y+=bird.vy;
  bird.angle=Math.max(-25,Math.min(70,bird.vy*4));
  bird.flapAnim=Math.max(0,bird.flapAnim-.12);

  // clouds
  clouds.forEach(c=>{c.x-=0.5;if(c.x+c.w<0)c.x=W+c.w;});

  // pipes
  if(frame%Math.round(90/pipeSpeed)===0)spawnPipe();
  for(let i=pipes.length-1;i>=0;i--){
    pipes[i].x-=pipeSpeed;
    if(!pipes[i].scored&&pipes[i].x+PIPE_W<BIRD_X){
      pipes[i].scored=true;score++;
      fScore.textContent=score;
      if(score>best){best=score;fBest.textContent=best;}
      pipeSpeed=2.8+score*0.08;
      fSpeed.textContent=(pipeSpeed/2.8).toFixed(1)+'x';
    }
    if(pipes[i].x+PIPE_W<0)pipes.splice(i,1);
  }

  // collision
  if(bird.y-BIRD_R<0||bird.y+BIRD_R>H){spawnParticles(BIRD_X,bird.y);endGame();return;}
  for(const p of pipes){
    if(BIRD_X+BIRD_R-6>p.x&&BIRD_X-BIRD_R+6<p.x+PIPE_W){
      if(bird.y-BIRD_R+4<p.topH||bird.y+BIRD_R-4>p.topH+GAP){
        spawnParticles(BIRD_X,bird.y);endGame();return;
      }
    }
  }
}

function drawBird(){
  ctx.save();ctx.translate(BIRD_X,bird.y);ctx.rotate(bird.angle*Math.PI/180);
  // body
  const g=ctx.createRadialGradient(-4,-4,2,0,0,BIRD_R);
  g.addColorStop(0,'#93c5fd');g.addColorStop(.5,'#3b82f6');g.addColorStop(1,'#1d4ed8');
  ctx.fillStyle=g;ctx.shadowColor='#38bdf8';ctx.shadowBlur=14;
  ctx.beginPath();ctx.arc(0,0,BIRD_R,0,Math.PI*2);ctx.fill();
  // belly
  ctx.shadowBlur=0;ctx.fillStyle='#bfdbfe';ctx.beginPath();ctx.ellipse(3,4,9,7,0,0,Math.PI*2);ctx.fill();
  // wing
  const wingY=bird.flapAnim>0?-8:2;
  ctx.fillStyle='#1d4ed8';ctx.beginPath();ctx.ellipse(-6,wingY,10,5,-.5,0,Math.PI*2);ctx.fill();
  // eye
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(8,-4,5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#1e293b';ctx.beginPath();ctx.arc(9,-4,2.5,0,Math.PI*2);ctx.fill();
  // beak
  ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.moveTo(14,-2);ctx.lineTo(22,0);ctx.lineTo(14,4);ctx.closePath();ctx.fill();
  ctx.restore();
}

function drawPipe(p){
  // Top pipe
  const topGrad=ctx.createLinearGradient(p.x,0,p.x+PIPE_W,0);
  topGrad.addColorStop(0,'#166534');topGrad.addColorStop(.4,'#4ade80');topGrad.addColorStop(1,'#166534');
  ctx.fillStyle=topGrad;ctx.shadowColor='#4ade80';ctx.shadowBlur=8;
  ctx.beginPath();ctx.roundRect(p.x,0,PIPE_W,p.topH-10,4);ctx.fill();
  ctx.fillStyle='#22c55e';ctx.shadowBlur=0;
  ctx.beginPath();ctx.roundRect(p.x-6,p.topH-22,PIPE_W+12,22,6);ctx.fill();
  // Bottom pipe
  const botY=p.topH+GAP;
  ctx.fillStyle=topGrad;ctx.shadowColor='#4ade80';ctx.shadowBlur=8;
  ctx.beginPath();ctx.roundRect(p.x,botY+22,PIPE_W,H-botY-22,4);ctx.fill();
  ctx.fillStyle='#22c55e';ctx.shadowBlur=0;
  ctx.beginPath();ctx.roundRect(p.x-6,botY,PIPE_W+12,22,6);ctx.fill();
}

function drawClouds(){
  clouds.forEach(c=>{
    ctx.save();ctx.fillStyle='rgba(255,255,255,0.05)';
    ctx.beginPath();ctx.ellipse(c.x,c.y,c.w/2,18,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(c.x-c.w*.2,c.y+8,c.w*.3,13,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(c.x+c.w*.25,c.y+6,c.w*.28,12,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
  });
}

function drawScore(){
  ctx.save();ctx.font='bold 32px "Orbitron",monospace';ctx.textAlign='center';
  ctx.fillStyle='rgba(255,255,255,0.9)';ctx.shadowColor='#38bdf8';ctx.shadowBlur=10;
  ctx.fillText(score,W/2,50);ctx.restore();
}

function draw(){
  ctx.fillStyle='rgba(10,10,26,0.96)';ctx.fillRect(0,0,W,H);
  drawClouds();
  pipes.forEach(drawPipe);
  drawBird();
  particles=particles.filter(p=>{
    ctx.save();ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=8;
    ctx.beginPath();ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2);ctx.fill();ctx.restore();
    p.x+=p.vx;p.y+=p.vy;p.vy+=.1;p.life-=p.decay;return p.life>0;
  });
  drawScore();
  // ground
  ctx.fillStyle='#1e293b';ctx.fillRect(0,H-20,W,20);
  ctx.fillStyle='#334155';ctx.fillRect(0,H-20,W,3);
}

function loop(){update();draw();animId=requestAnimationFrame(loop);}

function endGame(){
  gameActive=false;
  oTitle.textContent='💥 You Crashed!';oSub.textContent='';
  finalEl.textContent=`Score: ${score} pipes`;
  scoreForm.style.display='block';submitRes.textContent='';nameIn.value='';
  submitBtn.disabled=false;submitBtn.innerHTML='<i class="bi bi-send me-2"></i>Submit Score';
  submitBtn.style.display='';startLbl.textContent='Play Again';
  overlay.style.display='flex';
}

submitBtn.addEventListener('click',async()=>{
  const name=(nameIn.value.trim()||'Player').slice(0,20);
  submitBtn.disabled=true;submitBtn.innerHTML='<span class="spinner-border spinner-border-sm me-2"></span>Saving…';
  try{const res=await fetch('/api/save-score/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,score,level:1,game:'flappy'})});
    const d=await res.json();if(d.success){submitRes.innerHTML=`<span style="color:#34d399"><i class="bi bi-check-circle-fill me-1"></i>Saved! Rank #${d.rank}</span>`;submitBtn.style.display='none';}
    else throw new Error(d.error);}
  catch(e){submitRes.innerHTML=`<span style="color:#f87171">${e.message}</span>`;submitBtn.disabled=false;submitBtn.innerHTML='<i class="bi bi-send me-2"></i>Submit Score';}
});

document.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();flap();}});
canvas.addEventListener('click',flap);
canvas.addEventListener('touchstart',e=>{e.preventDefault();flap();},{passive:false});
startBtn.addEventListener('click',startGame);
})();
