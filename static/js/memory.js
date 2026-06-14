// ── Memory Match ───────────────────────────────────────────────────────────
(function(){
const board=document.getElementById('memoryBoard');if(!board)return;
const mScore=document.getElementById('mScore'),mTime=document.getElementById('mTime');
const mPairs=document.getElementById('mPairs'),mMoves=document.getElementById('mMoves');
const mFill=document.getElementById('mTimeFill');
const overlay=document.getElementById('mOverlay'),oTitle=document.getElementById('mOTitle');
const oSub=document.getElementById('mOSub'),startBtn=document.getElementById('mStart');
const startLbl=document.getElementById('mStartLbl'),scoreForm=document.getElementById('mScoreForm');
const finalEl=document.getElementById('mFinal'),nameIn=document.getElementById('mName');
const submitBtn=document.getElementById('mSubmit'),submitRes=document.getElementById('mSubmitRes');

const EMOJIS=['🐶','🐱','🦊','🐸','🦄','🍕','🌈','⭐','🎯','🎸','🚀','🍭','🦋','🎃','🍩','💎'];
const TOTAL_PAIRS=8;
let cards=[],flipped=[],matched=0,moves=0,score=0,timer=60,timerInt=null,gameActive=false,lock=false;

function shuffle(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}return arr;}

function buildBoard(){
  board.innerHTML='';cards=[];flipped=[];matched=0;moves=0;score=0;
  const selected=shuffle([...EMOJIS]).slice(0,TOTAL_PAIRS);
  const deck=shuffle([...selected,...selected]);
  deck.forEach((emoji,i)=>{
    const card=document.createElement('button');
    card.className='mem-card';
    card.innerHTML=`<div class="mem-back"><span style="font-size:22px">❓</span></div><div class="mem-face">${emoji}</div>`;
    card.dataset.emoji=emoji;card.dataset.index=i;
    card.addEventListener('click',()=>flipCard(card));
    board.appendChild(card);cards.push(card);
  });
}

function flipCard(card){
  if(!gameActive||lock||card.classList.contains('flipped')||card.classList.contains('matched'))return;
  card.classList.add('flipped');flipped.push(card);
  if(flipped.length===2){
    moves++;mMoves.textContent=moves;
    lock=true;
    setTimeout(checkMatch,700);
  }
}

function checkMatch(){
  const[a,b]=flipped;
  if(a.dataset.emoji===b.dataset.emoji){
    a.classList.add('matched');b.classList.add('matched');
    matched++;score+=100;
    mPairs.textContent=`${matched}/${TOTAL_PAIRS}`;
    mScore.textContent=score;
    if(matched===TOTAL_PAIRS){
      score+=500+timer*10;mScore.textContent=score;
      clearInterval(timerInt);
      setTimeout(()=>endGame(true),400);
    }
  } else{
    setTimeout(()=>{a.classList.remove('flipped');b.classList.remove('flipped');},300);
  }
  flipped=[];lock=false;
}

function startTimer(){
  clearInterval(timerInt);timer=60;
  timerInt=setInterval(()=>{
    timer--;mTime.textContent=timer;
    mFill.style.width=(timer/60*100)+'%';
    if(timer<=0){clearInterval(timerInt);endGame(false);}
  },1000);
}

function previewCards(cb){
  lock=true;
  const banner=document.getElementById('mPreviewBanner');
  const countEl=document.getElementById('mPreviewCount');

  // Flip all cards face-up
  cards.forEach(c=>c.classList.add('flipped'));
  banner.style.display='block';
  countEl.textContent='3';

  let countdown=3;
  const tick=setInterval(()=>{
    countdown--;
    if(countdown>0){
      countEl.textContent=countdown;
    } else {
      clearInterval(tick);
      countEl.textContent='Go!';
      setTimeout(()=>{
        // Flip all cards back face-down
        cards.forEach(c=>c.classList.remove('flipped'));
        banner.style.display='none';
        lock=false;
        cb();
      },600);
    }
  },1000);
}

function startGame(){
  buildBoard();
  gameActive=false;lock=true;
  mScore.textContent=0;mMoves.textContent=0;mPairs.textContent=`0/${TOTAL_PAIRS}`;
  overlay.style.display='none';scoreForm.style.display='none';
  previewCards(()=>{
    gameActive=true;
    startTimer();
  });
}

function endGame(won){
  gameActive=false;clearInterval(timerInt);
  oTitle.textContent=won?'🎉 You Won!':'⏰ Time\'s Up!';oSub.textContent='';
  finalEl.textContent=`Score: ${score} — ${matched}/${TOTAL_PAIRS} pairs`;
  scoreForm.style.display='block';submitRes.textContent='';nameIn.value='';
  submitBtn.disabled=false;submitBtn.innerHTML='<i class="bi bi-send me-2"></i>Submit Score';
  submitBtn.style.display='';startLbl.textContent='Play Again';
  overlay.style.display='flex';
}

submitBtn.addEventListener('click',async()=>{
  const name=(nameIn.value.trim()||'Player').slice(0,20);
  submitBtn.disabled=true;submitBtn.innerHTML='<span class="spinner-border spinner-border-sm me-2"></span>Saving…';
  try{const res=await fetch('/api/save-score/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,score,level:1,game:'memory'})});
    const d=await res.json();if(d.success){submitRes.innerHTML=`<span style="color:#34d399"><i class="bi bi-check-circle-fill me-1"></i>Saved! Rank #${d.rank}</span>`;submitBtn.style.display='none';}
    else throw new Error(d.error);}
  catch(e){submitRes.innerHTML=`<span style="color:#f87171">${e.message}</span>`;submitBtn.disabled=false;submitBtn.innerHTML='<i class="bi bi-send me-2"></i>Submit Score';}
});

startBtn.addEventListener('click',startGame);
})();
