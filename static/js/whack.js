// ── Whack-a-Mole ──────────────────────────────────────────────────────────
(function(){
const grid=document.getElementById('whackGrid');if(!grid)return;
const wScore=document.getElementById('wScore'),wTime=document.getElementById('wTime');
const wHits=document.getElementById('wHits'),wMiss=document.getElementById('wMiss');
const wFill=document.getElementById('wTimeFill');
const overlay=document.getElementById('wOverlay'),oTitle=document.getElementById('wOTitle');
const startBtn=document.getElementById('wStart'),startLbl=document.getElementById('wStartLbl');
const scoreForm=document.getElementById('wScoreForm'),finalEl=document.getElementById('wFinal');
const nameIn=document.getElementById('wName'),submitBtn=document.getElementById('wSubmit');
const submitRes=document.getElementById('wSubmitRes');

const HOLES=9,MOLES=['🐭','🐹','🐭','🐹','💣','🐭','🐹','🐭','🐹'];
let holes=[],score=0,hits=0,misses=0,timer=30,timerInt=null,moleTimers=[],gameActive=false;

function buildGrid(){
  grid.innerHTML='';holes=[];
  for(let i=0;i<HOLES;i++){
    const h=document.createElement('div');h.className='hole';
    const m=document.createElement('div');m.className='mole';
    h.appendChild(m);
    h.addEventListener('click',e=>whack(e,i));
    grid.appendChild(h);holes.push({el:h,moleEl:m,active:false,isBomb:false});
  }
}

function showMole(i){
  if(!gameActive)return;
  const h=holes[i];if(h.active)return;
  const isBomb=Math.random()<0.18;
  h.isBomb=isBomb;h.active=true;
  h.moleEl.textContent=isBomb?'💣':'🐭';
  if(isBomb)h.moleEl.classList.add('bomb-mole');
  else h.moleEl.classList.remove('bomb-mole');
  h.el.classList.add('active');
  const dur=Math.max(600,1400-score*8);
  moleTimers[i]=setTimeout(()=>{if(h.active){h.el.classList.remove('active');h.active=false;}},dur);
}

function whack(e,i){
  if(!gameActive)return;
  const h=holes[i];if(!h.active)return;
  clearTimeout(moleTimers[i]);
  h.el.classList.add('whacked');
  setTimeout(()=>{h.el.classList.remove('whacked','active');h.active=false;},350);
  if(h.isBomb){
    score=Math.max(0,score-15);
    showHitLabel(h.el,'−15','#f87171');
  } else {
    const pts=score>200?20:10;score+=pts;hits++;
    showHitLabel(h.el,`+${pts}`,'#4ade80');
  }
  updateHUD();
}

function showHitLabel(holEl,text,color){
  const lbl=document.createElement('div');lbl.className='hit-label';
  lbl.textContent=text;lbl.style.color=color;
  holEl.appendChild(lbl);setTimeout(()=>lbl.remove(),700);
}

function spawnLoop(){
  if(!gameActive)return;
  const available=holes.map((_,i)=>i).filter(i=>!holes[i].active);
  if(available.length>0){
    const i=available[Math.floor(Math.random()*available.length)];
    showMole(i);
  }
  const delay=Math.max(300,900-score*5);
  setTimeout(spawnLoop,delay);
}

function updateHUD(){
  wScore.textContent=score;wHits.textContent=hits;wMiss.textContent=misses;
}

function startGame(){
  buildGrid();score=0;hits=0;misses=0;timer=30;
  updateHUD();wTime.textContent=30;wFill.style.width='100%';
  overlay.style.display='none';scoreForm.style.display='none';
  gameActive=true;
  clearInterval(timerInt);
  timerInt=setInterval(()=>{
    timer--;wTime.textContent=timer;wFill.style.width=(timer/30*100)+'%';
    if(timer<=0){clearInterval(timerInt);endGame();}
  },1000);
  spawnLoop();
}

function endGame(){
  gameActive=false;moleTimers.forEach(clearTimeout);
  holes.forEach(h=>{h.el.classList.remove('active','whacked');h.active=false;});
  oTitle.textContent='⏰ Time\'s Up!';
  finalEl.textContent=`Score: ${score} — ${hits} hits`;
  scoreForm.style.display='block';submitRes.textContent='';nameIn.value='';
  submitBtn.disabled=false;submitBtn.innerHTML='<i class="bi bi-send me-2"></i>Submit Score';
  submitBtn.style.display='';startLbl.textContent='Play Again';
  overlay.style.display='flex';
}

submitBtn.addEventListener('click',async()=>{
  const name=(nameIn.value.trim()||'Player').slice(0,20);
  submitBtn.disabled=true;submitBtn.innerHTML='<span class="spinner-border spinner-border-sm me-2"></span>Saving…';
  try{const res=await fetch('/api/save-score/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,score,level:1,game:'whack'})});
    const d=await res.json();if(d.success){submitRes.innerHTML=`<span style="color:#34d399"><i class="bi bi-check-circle-fill me-1"></i>Saved! Rank #${d.rank}</span>`;submitBtn.style.display='none';}
    else throw new Error(d.error);}
  catch(e){submitRes.innerHTML=`<span style="color:#f87171">${e.message}</span>`;submitBtn.disabled=false;submitBtn.innerHTML='<i class="bi bi-send me-2"></i>Submit Score';}
});

startBtn.addEventListener('click',startGame);
})();
