/* snake_ladder_mp.js – Multiplayer Snake & Ladder */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 560; canvas.height = 560;

const GRID = 10;
const SZ = canvas.width / GRID;

// Snakes: head → tail
const SNAKES = {97:78,95:56,88:24,76:37,74:53,62:19,49:11,46:25,16:6};
// Ladders: bottom → top
const LADDERS = {2:38,7:14,8:31,15:26,21:42,28:84,36:44,51:67,71:91,78:98,87:94};

const PLAYER_COLORS = ['#ef4444','#22c55e','#3b82f6','#f59e0b'];

let positions, currentPlayer, myTurn, diceVal, gameActive, rolling;

function initGame() {
  positions = PLAYER_LIST.map(() => 0);
  currentPlayer = 0;
  myTurn = PLAYER_INDEX === 0;
  diceVal = null; gameActive = true; rolling = false;
  draw(); updateStatus();
}

function cellRect(cell) {
  // cell 1 = bottom-left, 100 = top-right
  const idx = cell - 1;
  const row = GRID - 1 - Math.floor(idx / GRID);
  const rowFromBottom = Math.floor(idx / GRID);
  const col = rowFromBottom % 2 === 0 ? idx % GRID : GRID - 1 - (idx % GRID);
  return { x: col * SZ, y: row * SZ };
}

function cellCenter(cell) {
  const {x,y} = cellRect(cell);
  return { x: x + SZ/2, y: y + SZ/2 };
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Board squares
  for(let r=0;r<GRID;r++) for(let c=0;c<GRID;c++) {
    const even=(r+c)%2===0;
    ctx.fillStyle = even ? '#1e1b4b' : '#2d1b69';
    ctx.fillRect(c*SZ,r*SZ,SZ,SZ);
    ctx.strokeStyle='#ffffff0a';
    ctx.strokeRect(c*SZ,r*SZ,SZ,SZ);
  }

  // Cell numbers
  ctx.font=`bold ${SZ*.22}px sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='top';
  for(let cell=1;cell<=100;cell++) {
    const {x,y}=cellRect(cell);
    ctx.fillStyle='#ffffff33';
    ctx.fillText(cell, x+SZ/2, y+2);
  }

  // Draw snakes
  Object.entries(SNAKES).forEach(([head,tail]) => {
    const h=cellCenter(+head), t=cellCenter(+tail);
    ctx.save();
    ctx.strokeStyle='#ef4444';
    ctx.lineWidth=6;
    ctx.lineCap='round';
    ctx.setLineDash([8,4]);
    ctx.beginPath();
    const mx=(h.x+t.x)/2+40, my=(h.y+t.y)/2-20;
    ctx.moveTo(h.x,h.y);
    ctx.quadraticCurveTo(mx,my,t.x,t.y);
    ctx.stroke();
    // Snake head
    ctx.fillStyle='#ef4444';
    ctx.beginPath(); ctx.arc(h.x,h.y,10,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff'; ctx.font='14px serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🐍',h.x,h.y);
    ctx.restore();
  });

  // Draw ladders
  Object.entries(LADDERS).forEach(([bot,top]) => {
    const b=cellCenter(+bot), t=cellCenter(+top);
    ctx.save();
    ctx.strokeStyle='#22c55e';
    ctx.lineWidth=5;
    ctx.lineCap='round';
    ctx.setLineDash([]);
    // Two rails
    const dx=12,dy=0;
    ctx.beginPath(); ctx.moveTo(b.x-dx,b.y); ctx.lineTo(t.x-dx,t.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.x+dx,b.y); ctx.lineTo(t.x+dx,t.y); ctx.stroke();
    // Rungs
    const steps=5;
    for(let i=0;i<=steps;i++){
      const pct=i/steps;
      const rx=b.x+(t.x-b.x)*pct, ry=b.y+(t.y-b.y)*pct;
      ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(rx-dx,ry); ctx.lineTo(rx+dx,ry); ctx.stroke();
    }
    ctx.fillStyle='#fff'; ctx.font='14px serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🪜',b.x,b.y+12);
    ctx.restore();
  });

  // Draw player tokens
  PLAYER_LIST.forEach((name, pi) => {
    const pos = positions[pi];
    if(pos===0) return;
    const {x,y} = cellCenter(pos);
    const off = (pi%2)*16-8;
    const tx=x+off, ty=y+(pi>1?8:-8);
    ctx.fillStyle='#000a';
    ctx.beginPath(); ctx.ellipse(tx,ty+8,10,4,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=PLAYER_COLORS[pi];
    ctx.beginPath(); ctx.arc(tx,ty,11,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#fff'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='#fff'; ctx.font='bold 9px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(pi+1,tx,ty);
  });

  // Dice
  if(myTurn && currentPlayer===PLAYER_INDEX) drawDice();
}

function drawDice() {
  const x=canvas.width-70, y=canvas.height-70;
  ctx.fillStyle='#ffffffee';
  ctx.beginPath(); ctx.roundRect(x,y,55,55,8); ctx.fill();
  ctx.fillStyle='#1a0a2e';
  if(diceVal) {
    const dotPos=[
      [],[[.5,.5]],
      [[.3,.3],[.7,.7]],
      [[.3,.3],[.5,.5],[.7,.7]],
      [[.3,.3],[.3,.7],[.7,.3],[.7,.7]],
      [[.3,.3],[.3,.7],[.5,.5],[.7,.3],[.7,.7]],
      [[.3,.3],[.3,.5],[.3,.7],[.7,.3],[.7,.5],[.7,.7]]
    ];
    dotPos[diceVal].forEach(([dx,dy]) => {
      ctx.beginPath(); ctx.arc(x+dx*55,y+dy*55,4,0,Math.PI*2); ctx.fill();
    });
  } else {
    ctx.font='bold 22px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('🎲',x+27,y+27);
  }
}

function rollDice() {
  if(!myTurn||rolling||!gameActive||diceVal) return;
  rolling=true;
  SFX.dice();
  let t=0;
  const anim=setInterval(()=>{
    diceVal=Math.floor(Math.random()*6)+1;
    draw();
    if(++t>8){
      clearInterval(anim);
      rolling=false;
      sendGameMove({action:'roll',value:diceVal},{player:PLAYER_INDEX});
      setTimeout(()=>movePlayer(PLAYER_INDEX, diceVal), 600);
    }
  },80);
}

function movePlayer(pi, val) {
  let newPos = positions[pi] + val;
  if(newPos > 100) { endTurn(); return; }

  positions[pi] = newPos;
  draw();

  if(SNAKES[newPos]) {
    SFX.slide();
    setTimeout(()=>{ positions[pi]=SNAKES[newPos]; draw(); endTurn(); }, 600);
    setStatus('🐍 Snake! Sliding down…', 2000);
  } else if(LADDERS[newPos]) {
    SFX.climb();
    setTimeout(()=>{ positions[pi]=LADDERS[newPos]; draw(); endTurn(); }, 600);
    setStatus('🪜 Ladder! Climbing up!', 2000);
  } else if(newPos===100) {
    SFX.win();
    showOverlay('🎉 You Win!',`${PLAYER_LIST[pi]} reaches 100 first!`);
    gameActive=false;
    sendGameEvent('win',{winner:pi});
  } else {
    endTurn();
  }
}

function endTurn() {
  diceVal=null;
  currentPlayer=(currentPlayer+1)%PLAYER_LIST.length;
  myTurn=currentPlayer===PLAYER_INDEX;
  sendGameMove({action:'turn'},{currentPlayer,positions});
  updateStatus(); draw();
}

function updateStatus() {
  if(!gameActive) return;
  setStatus(myTurn?'🎲 Your turn — click to roll!':
    `⏳ ${PLAYER_LIST[currentPlayer]}'s turn`,0);
}

function onGameMove(data) {
  const {action}=data.move;
  if(action==='roll'){
    diceVal=data.move.value;
    SFX.dice();
    draw();
    setTimeout(()=>applyMove(data.move.player||data.state.player, diceVal),600);
  } else if(action==='turn'){
    positions=data.state.positions||positions;
    currentPlayer=data.state.currentPlayer;
    myTurn=currentPlayer===PLAYER_INDEX;
    diceVal=null; updateStatus(); draw();
  }
}

function applyMove(pi, val) {
  let np=positions[pi]+val;
  if(np>100) return;
  positions[pi]=np;
  if(SNAKES[np]) { SFX.slide(); setTimeout(()=>{positions[pi]=SNAKES[np];draw();},400); }
  else if(LADDERS[np]) { SFX.climb(); setTimeout(()=>{positions[pi]=LADDERS[np];draw();},400); }
  else if(np===100){ SFX.lose(); showOverlay('🎲 Game Over',`${PLAYER_LIST[pi]} wins!`); gameActive=false; }
  draw();
}

function onGameEvent(data) {
  if(data.event==='win'&&data.username!==CURRENT_USER){ SFX.lose(); showOverlay('🎲 Game Over',`${PLAYER_LIST[data.payload.winner]} wins!`); gameActive=false; }
  if(data.event==='new_game') initGame();
}
function onNewGame(){ sendGameEvent('new_game'); initGame(); }

canvas.addEventListener('click', rollDice);
initGame();
