/* carrom_mp.js – Multiplayer Carrom Board */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 560; canvas.height = 560;
const W=canvas.width, H=canvas.height;
const BORDER=45, INNER=W-BORDER*2;
const CX=W/2, CY=H/2;
const POCKET_R=22, PIECE_R=14, STRIKER_R=18;
const FRICTION=0.985, MIN_V=0.08;

const COLORS={black:'#1a1a1a',white:'#f5f5f5',red:'#ef4444',striker:'#d97706',board:'#c8a96e',border:'#7c4f1e'};

let pieces, striker, dragging, dragStart, power, angle;
let currentPlayer, myTurn, gameActive, solving;
let scores=[0,0];
window.gameReady = false;

const POCKETS=[
  {x:BORDER,y:BORDER},
  {x:W-BORDER,y:BORDER},
  {x:BORDER,y:H-BORDER},
  {x:W-BORDER,y:H-BORDER},
];

function makePiece(id,x,y,color,pocketed=false){return{id,x,y,vx:0,vy:0,color,pocketed,r:PIECE_R};}
function makeStriker(){return{x:CX,y:H-BORDER-50,vx:0,vy:0,color:COLORS.striker,r:STRIKER_R,pocketed:false};}

function initPieces(){
  const p=[];let id=0;
  const N=9,rad=60;
  for(let i=0;i<N;i++){
    const a=i*(2*Math.PI/N);
    p.push(makePiece(id++,CX+rad*Math.cos(a),CY+rad*Math.sin(a),COLORS.black));
    p.push(makePiece(id++,CX+(rad-28)*Math.cos(a+Math.PI/N),CY+(rad-28)*Math.sin(a+Math.PI/N),COLORS.white));
  }
  p.push(makePiece(id++,CX,CY,COLORS.red));
  return p;
}

function initGame(){
  pieces=initPieces();
  striker=makeStriker();
  dragging=false; dragStart=null; power=0; angle=0;
  currentPlayer=0; myTurn=false;
  gameActive=true; solving=false; scores=[0,0];

  if (!window.gameReady) {
    draw();
    setStatus('⏳ Waiting for opponent to join…');
    return;
  }
  myTurn=PLAYER_INDEX===0;
  draw(); updateStatus();
}

function drawBoard(){
  ctx.fillStyle=COLORS.board;
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle=COLORS.border;
  ctx.fillRect(0,0,W,BORDER);
  ctx.fillRect(0,H-BORDER,W,BORDER);
  ctx.fillRect(0,0,BORDER,H);
  ctx.fillRect(W-BORDER,0,BORDER,H);
  ctx.fillStyle='#d4a96a';
  ctx.fillRect(BORDER,BORDER,INNER,INNER);
  ctx.strokeStyle='#a0723a';
  ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(CX,CY,80,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(CX,CY,6,0,Math.PI*2); ctx.stroke();
  [[BORDER,BORDER,BORDER+80,BORDER+80],[W-BORDER,BORDER,W-BORDER-80,BORDER+80],
   [BORDER,H-BORDER,BORDER+80,H-BORDER-80],[W-BORDER,H-BORDER,W-BORDER-80,H-BORDER-80]]
  .forEach(([x1,y1,x2,y2])=>{ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();});
  if(myTurn){
    ctx.strokeStyle='#7c3aed88';
    ctx.setLineDash([4,3]);
    const baseY=PLAYER_INDEX===0?H-BORDER-50:BORDER+50;
    ctx.beginPath();
    ctx.moveTo(CX-60,baseY); ctx.lineTo(CX+60,baseY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  POCKETS.forEach(p=>{
    ctx.fillStyle='#0008';
    ctx.beginPath(); ctx.arc(p.x,p.y,POCKET_R,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#0005'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(p.x,p.y,POCKET_R,0,Math.PI*2); ctx.stroke();
  });
}

function drawPieces(){
  pieces.forEach(p=>{
    if(p.pocketed) return;
    ctx.fillStyle='#0004';
    ctx.beginPath(); ctx.ellipse(p.x+2,p.y+2,p.r,p.r*.6,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#ffffff44'; ctx.lineWidth=1;
    ctx.stroke();
    ctx.fillStyle='#ffffff33';
    ctx.beginPath(); ctx.arc(p.x-3,p.y-3,p.r*.3,0,Math.PI*2); ctx.fill();
  });
}

function drawStriker(){
  if(striker.pocketed) return;
  ctx.fillStyle='#0004';
  ctx.beginPath(); ctx.ellipse(striker.x+2,striker.y+3,striker.r,striker.r*.6,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle=COLORS.striker;
  ctx.beginPath(); ctx.arc(striker.x,striker.y,striker.r,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle='#fff6';
  ctx.beginPath(); ctx.arc(striker.x-4,striker.y-4,striker.r*.3,0,Math.PI*2); ctx.fill();

  if(dragging&&dragStart){
    const dx=striker.x-dragStart.x, dy=striker.y-dragStart.y;
    const len=Math.hypot(dx,dy);
    if(len>5){
      ctx.save();
      ctx.strokeStyle='#ffffffaa'; ctx.lineWidth=2; ctx.setLineDash([5,3]);
      ctx.beginPath(); ctx.moveTo(striker.x,striker.y);
      ctx.lineTo(striker.x+dx*2,striker.y+dy*2); ctx.stroke();
      ctx.fillStyle='#ffffffcc';
      ctx.font='12px sans-serif'; ctx.textAlign='center';
      ctx.fillText(`Power: ${Math.round(Math.min(len,80)/80*100)}%`,striker.x,striker.y-striker.r-8);
      ctx.restore();
    }
  }
}

function drawHUD(){
  ctx.fillStyle='#1a0a2ecc';
  ctx.fillRect(BORDER,BORDER,120,36);
  ctx.fillRect(W-BORDER-120,BORDER,120,36);
  ctx.fillStyle='#fff'; ctx.font='bold 13px Orbitron,sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(`${PLAYER_LIST[0]}: ${scores[0]}`, BORDER+8, BORDER+18);
  ctx.textAlign='right';
  ctx.fillText(`${PLAYER_LIST[1]||'P2'}: ${scores[1]}`, W-BORDER-8, BORDER+18);
}

function draw(){drawBoard();drawPieces();drawStriker();drawHUD();}

function step(){
  [striker,...pieces].forEach(b=>{
    if(b.pocketed) return;
    b.x+=b.vx; b.y+=b.vy;
    b.vx*=FRICTION; b.vy*=FRICTION;
    if(Math.abs(b.vx)<MIN_V) b.vx=0;
    if(Math.abs(b.vy)<MIN_V) b.vy=0;
    if(b.x-b.r<BORDER){b.x=BORDER+b.r;b.vx=Math.abs(b.vx)*0.8;SFX.strike();}
    if(b.x+b.r>W-BORDER){b.x=W-BORDER-b.r;b.vx=-Math.abs(b.vx)*0.8;SFX.strike();}
    if(b.y-b.r<BORDER){b.y=BORDER+b.r;b.vy=Math.abs(b.vy)*0.8;SFX.strike();}
    if(b.y+b.r>H-BORDER){b.y=H-BORDER-b.r;b.vy=-Math.abs(b.vy)*0.8;SFX.strike();}
    POCKETS.forEach(p=>{
      if(Math.hypot(b.x-p.x,b.y-p.y)<POCKET_R+b.r*.5){
        if(b===striker){b.pocketed=true; setTimeout(resetStriker,1000);}
        else{b.pocketed=true; scorePiece(b);}
        b.vx=0; b.vy=0;
        SFX.pocket();
      }
    });
  });
  const all=[striker,...pieces].filter(b=>!b.pocketed);
  for(let i=0;i<all.length;i++) for(let j=i+1;j<all.length;j++){
    const a=all[i],b=all[j];
    const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy),min=a.r+b.r;
    if(dist<min&&dist>0){
      SFX.carrom_flick();
      const nx=dx/dist,ny=dy/dist,ov=min-dist;
      a.x-=nx*ov/2;a.y-=ny*ov/2;b.x+=nx*ov/2;b.y+=ny*ov/2;
      const dv=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
      if(dv>0){a.vx-=dv*nx;a.vy-=dv*ny;b.vx+=dv*nx;b.vy+=dv*ny;}
    }
  }
}

function scorePiece(p){
  if(p.color===COLORS.red) scores[currentPlayer]+=3;
  else if(p.color===COLORS.black) scores[currentPlayer]+=1;
  else if(p.color===COLORS.white) scores[1-currentPlayer]+=1;
  checkWin();
}

function checkWin(){
  const remaining=pieces.filter(p=>!p.pocketed);
  if(remaining.length===0){
    const winner=scores[0]>scores[1]?0:1;
    if(winner===PLAYER_INDEX){SFX.win();showOverlay('🪙 You Win!',`Score: ${scores[PLAYER_INDEX]}`);}
    else{SFX.lose();showOverlay('🪙 Game Over',`${PLAYER_LIST[winner]} wins with ${scores[winner]} pts`);}
    gameActive=false;
    sendGameEvent('win',{winner,scores});
  }
}

function resetStriker(){
  striker.pocketed=false;
  const baseY=PLAYER_INDEX===0?H-BORDER-50:BORDER+50;
  striker.x=CX; striker.y=baseY;
  striker.vx=0; striker.vy=0;
}

let animFrame;
function loop(){
  if(solving){
    step(); draw();
    const moving=[striker,...pieces].some(b=>!b.pocketed&&(Math.abs(b.vx)>MIN_V||Math.abs(b.vy)>MIN_V));
    if(!moving){
      solving=false;
      endTurn();
    }
  }
  animFrame=requestAnimationFrame(loop);
}

function flick(vx,vy){
  if(striker.pocketed) resetStriker();
  striker.vx=vx; striker.vy=vy;
  solving=true;
  SFX.carrom_flick();
}

function endTurn(){
  currentPlayer=(currentPlayer+1)%2;
  myTurn=currentPlayer===PLAYER_INDEX;
  if(!striker.pocketed){
    const baseY=currentPlayer===0?H-BORDER-50:BORDER+50;
    striker.y=baseY; striker.x=CX;
  }
  updateStatus(); draw();
}

function updateStatus(){
  if(!gameActive) return;
  const s=`Score: ${scores[0]}-${scores[1]}`;
  setStatus(myTurn?`🪙 Your flick! ${s}`:`⏳ ${PLAYER_LIST[currentPlayer]}'s turn  ${s}`,0);
}

canvas.addEventListener('mousedown',e=>{
  if(!window.gameReady||!myTurn||!gameActive||solving) return;
  const rect=canvas.getBoundingClientRect();
  const mx=(e.clientX-rect.left)*W/rect.width;
  const my=(e.clientY-rect.top)*H/rect.height;
  if(Math.hypot(mx-striker.x,my-striker.y)<striker.r+10){
    dragging=true; dragStart={x:mx,y:my};
  }
});
canvas.addEventListener('mousemove',e=>{
  if(!dragging) return;
  const rect=canvas.getBoundingClientRect();
  dragStart={x:(e.clientX-rect.left)*W/rect.width, y:(e.clientY-rect.top)*H/rect.height};
  draw();
});
canvas.addEventListener('mouseup',e=>{
  if(!dragging) return; dragging=false;
  const rect=canvas.getBoundingClientRect();
  const mx=(e.clientX-rect.left)*W/rect.width;
  const my=(e.clientY-rect.top)*H/rect.height;
  const dx=striker.x-mx, dy=striker.y-my;
  const len=Math.min(Math.hypot(dx,dy),80);
  if(len>5){
    const vx=(dx/len)*len*0.2, vy=(dy/len)*len*0.2;
    sendGameMove({action:'flick',vx,vy},{pieces:pieces.map(p=>({...p})),striker:{...striker}});
    flick(vx,vy);
  }
});

function onGameMove(data){
  if(data.username===CURRENT_USER) return; // ignore our own echo
  if(data.move.action==='flick'){
    pieces=data.state.pieces; striker=data.state.striker;
    flick(data.move.vx,data.move.vy);
  }
}
function onGameEvent(data){
  if(data.event==='win'){SFX.lose();showOverlay('🪙 Game Over',`${PLAYER_LIST[data.payload.winner]} wins!`);gameActive=false;}
  if(data.event==='new_game') initGame();
}
function onNewGame(){sendGameEvent('new_game');initGame();}

initGame();
loop();
