/* pool_mp.js – Multiplayer 8 Ball Pool */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 700; canvas.height = 400;

const W = canvas.width, H = canvas.height;
const POCKET_R = 18;
const BALL_R = 11;
const TABLE_PAD = 40;

// Table bounds
const TL = {x:TABLE_PAD, y:TABLE_PAD};
const TR = {x:W-TABLE_PAD, y:TABLE_PAD};
const BL = {x:TABLE_PAD, y:H-TABLE_PAD};
const BR = {x:W-TABLE_PAD, y:H-TABLE_PAD};

const POCKETS = [
  TL, {x:W/2, y:TABLE_PAD-10}, TR,
  BL, {x:W/2, y:H-TABLE_PAD+10}, BR,
];

const BALL_COLORS = [
  '#f5f5f5', // 0 = cue
  '#f59e0b','#3b82f6','#ef4444','#7c3aed','#f97316','#16a34a','#991b1b','#1a1a1a', // 1-8 solids
  '#fde68a','#93c5fd','#fca5a5','#c4b5fd','#fdba74','#86efac','#fee2e2','#000' // 9-15 stripes
];

let balls, cue, dragging, dragStart, gameActive, myTurn, currentPlayer, solving;
let pocketed = [];
let playerGroups = [null, null]; // 'solid','stripe' or null
let shotHistory = [];

function makeBall(id, x, y) {
  return {id, x, y, vx:0, vy:0, pocketed:false, color:BALL_COLORS[id]};
}

function rackBalls() {
  const cx = W*0.65, cy = H/2, sp = BALL_R*2.1;
  const order = [1,9,2,10,3,11,8,12,4,13,5,14,6,15,7];
  const positions = [];
  let idx=0;
  for(let row=0;row<5;row++) {
    for(let col=0;col<=row;col++) {
      positions.push({
        x: cx + row*sp*Math.cos(Math.PI/6),
        y: cy + (col - row/2)*sp,
      });
    }
  }
  return [
    makeBall(0, W*0.25, H/2),
    ...order.map((id,i) => makeBall(id, positions[i].x, positions[i].y))
  ];
}

function initGame() {
  balls = rackBalls();
  cue = balls[0];
  dragging = false; dragStart = null;
  gameActive = true; solving = false;
  pocketed = []; playerGroups = [null,null];
  currentPlayer = 0;
  myTurn = PLAYER_INDEX === 0;
  draw(); updateStatus();
}

// Physics
function stepPhysics() {
  const FRICTION = 0.988;
  const MIN_V = 0.05;

  balls.forEach(b => {
    if(b.pocketed) return;
    b.x += b.vx; b.y += b.vy;
    b.vx *= FRICTION; b.vy *= FRICTION;
    if(Math.abs(b.vx)<MIN_V) b.vx=0;
    if(Math.abs(b.vy)<MIN_V) b.vy=0;

    // Wall bounce
    if(b.x-BALL_R < TL.x) { b.x=TL.x+BALL_R; b.vx=Math.abs(b.vx); SFX.strike(); }
    if(b.x+BALL_R > TR.x) { b.x=TR.x-BALL_R; b.vx=-Math.abs(b.vx); SFX.strike(); }
    if(b.y-BALL_R < TL.y) { b.y=TL.y+BALL_R; b.vy=Math.abs(b.vy); SFX.strike(); }
    if(b.y+BALL_R > BL.y) { b.y=BL.y-BALL_R; b.vy=-Math.abs(b.vy); SFX.strike(); }

    // Pockets
    POCKETS.forEach(p => {
      if(Math.hypot(b.x-p.x, b.y-p.y) < POCKET_R) {
        b.pocketed=true; b.vx=0; b.vy=0;
        SFX.pocket();
        pocketed.push(b.id);
      }
    });
  });

  // Ball-ball collisions
  for(let i=0;i<balls.length;i++) {
    for(let j=i+1;j<balls.length;j++) {
      const a=balls[i], b=balls[j];
      if(a.pocketed||b.pocketed) continue;
      const dx=b.x-a.x, dy=b.y-a.y;
      const dist=Math.hypot(dx,dy);
      if(dist<BALL_R*2&&dist>0) {
        SFX.strike();
        const nx=dx/dist, ny=dy/dist;
        const overlap=BALL_R*2-dist;
        a.x-=nx*overlap/2; a.y-=ny*overlap/2;
        b.x+=nx*overlap/2; b.y+=ny*overlap/2;
        const dvx=a.vx-b.vx, dvy=a.vy-b.vy;
        const dot=dvx*nx+dvy*ny;
        if(dot>0){a.vx-=dot*nx;a.vy-=dot*ny;b.vx+=dot*nx;b.vy+=dot*ny;}
      }
    }
  }
}

function isMoving() {
  return balls.some(b=>!b.pocketed&&(Math.abs(b.vx)>0.05||Math.abs(b.vy)>0.05));
}

function draw() {
  // Table felt
  ctx.fillStyle='#16613a';
  ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#1a7a45';
  ctx.fillRect(TL.x,TL.y,TR.x-TL.x,BL.y-TL.y);

  // Rails
  ctx.fillStyle='#78350f';
  ctx.fillRect(0,0,W,TABLE_PAD);
  ctx.fillRect(0,H-TABLE_PAD,W,TABLE_PAD);
  ctx.fillRect(0,0,TABLE_PAD,H);
  ctx.fillRect(W-TABLE_PAD,0,TABLE_PAD,H);

  // Pockets
  POCKETS.forEach(p=>{
    ctx.fillStyle='#000';
    ctx.beginPath(); ctx.arc(p.x,p.y,POCKET_R,0,Math.PI*2); ctx.fill();
  });

  // Cue line while dragging
  if(dragging&&myTurn&&cue&&!cue.pocketed) {
    const dx=cue.x-dragStart.x, dy=cue.y-dragStart.y;
    const len=Math.hypot(dx,dy);
    if(len>5){
      ctx.save();
      ctx.strokeStyle='#ffffffaa';
      ctx.lineWidth=2;
      ctx.setLineDash([6,4]);
      ctx.beginPath();
      ctx.moveTo(cue.x,cue.y);
      ctx.lineTo(cue.x+dx*3,cue.y+dy*3);
      ctx.stroke();
      // Cue stick
      ctx.strokeStyle='#d97706';
      ctx.lineWidth=4;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(dragStart.x,dragStart.y);
      ctx.lineTo(dragStart.x-dx*1.5,dragStart.y-dy*1.5);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Balls
  balls.forEach(b=>{
    if(b.pocketed) return;
    // Shadow
    ctx.fillStyle='#00000044';
    ctx.beginPath(); ctx.ellipse(b.x+3,b.y+3,BALL_R,BALL_R*.6,0,0,Math.PI*2); ctx.fill();
    // Ball
    ctx.fillStyle=b.color;
    ctx.beginPath(); ctx.arc(b.x,b.y,BALL_R,0,Math.PI*2); ctx.fill();
    // Stripe (9-15)
    if(b.id>=9&&b.id<=15){
      ctx.save();
      ctx.beginPath(); ctx.arc(b.x,b.y,BALL_R,0,Math.PI*2); ctx.clip();
      ctx.fillStyle='#f5f5f5';
      ctx.fillRect(b.x-BALL_R,b.y-BALL_R*.5,BALL_R*2,BALL_R);
      ctx.restore();
    }
    // Number
    ctx.fillStyle=b.id===0?'transparent':(b.id===8||b.id>=9)?'#fff':'#1a1a1a';
    ctx.font=`bold ${BALL_R*.9}px sans-serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    if(b.id>0) ctx.fillText(b.id,b.x,b.y);
    // Shine
    ctx.fillStyle='#ffffff55';
    ctx.beginPath(); ctx.arc(b.x-3,b.y-3,BALL_R*.35,0,Math.PI*2); ctx.fill();
  });

  // HUD
  ctx.fillStyle='#ffffffcc';
  ctx.font='bold 14px Orbitron,sans-serif';
  ctx.textAlign='left'; ctx.textBaseline='top';
  const g0=playerGroups[0]?playerGroups[0]==='solid'?'●':'○':'?';
  const g1=playerGroups[1]?playerGroups[1]==='solid'?'●':'○':'?';
  ctx.fillText(`P1: ${PLAYER_LIST[0]} ${g0}`, TL.x+5, TL.y+5);
  ctx.textAlign='right';
  ctx.fillText(`P2: ${PLAYER_LIST[1]||'P2'} ${g1}`, TR.x-5, TL.y+5);
}

let animFrame;
function gameLoop() {
  if(solving) {
    stepPhysics();
    draw();
    if(!isMoving()) {
      solving=false;
      if(checkWin()) return;
      endTurn();
    }
  }
  animFrame = requestAnimationFrame(gameLoop);
}

function shoot(vx, vy) {
  if(!cue||cue.pocketed) return;
  cue.vx=vx; cue.vy=vy;
  solving=true;
  SFX.strike();
}

function checkWin() {
  const eight=balls.find(b=>b.id===8);
  if(eight&&eight.pocketed) {
    const myGroup=playerGroups[PLAYER_INDEX];
    const myBalls=balls.filter(b=>b.id>0&&b.id!==8&&(myGroup==='solid'?b.id<=7:b.id>=9));
    const allMine=myBalls.every(b=>b.pocketed);
    if(allMine) {
      SFX.win();
      showOverlay('🎱 8 Ball Pocketed!','You win!');
      sendGameEvent('win',{winner:PLAYER_INDEX});
    } else {
      SFX.lose();
      showOverlay('🎱 Scratch!','You pocketed the 8 ball too early. You lose!');
      sendGameEvent('win',{winner:1-PLAYER_INDEX});
    }
    gameActive=false;
    return true;
  }
  return false;
}

function endTurn() {
  currentPlayer=(currentPlayer+1)%2;
  myTurn=currentPlayer===PLAYER_INDEX;
  updateStatus();
}

function updateStatus() {
  const myG=playerGroups[PLAYER_INDEX];
  const gStr=myG?`(${myG})`:'';
  setStatus(myTurn?`🎱 Your shot ${gStr}`:`⏳ ${PLAYER_LIST[currentPlayer]}'s turn`,0);
}

// Mouse / touch
let mousePos={x:0,y:0};
canvas.addEventListener('mousedown',e=>{
  if(!myTurn||!gameActive||solving) return;
  const rect=canvas.getBoundingClientRect();
  const mx=(e.clientX-rect.left)*W/rect.width;
  const my=(e.clientY-rect.top)*H/rect.height;
  if(cue&&!cue.pocketed&&Math.hypot(mx-cue.x,my-cue.y)<40){
    dragging=true;
    dragStart={x:mx,y:my};
  }
});
canvas.addEventListener('mousemove',e=>{
  const rect=canvas.getBoundingClientRect();
  mousePos.x=(e.clientX-rect.left)*W/rect.width;
  mousePos.y=(e.clientY-rect.top)*H/rect.height;
  if(dragging) dragStart={x:mousePos.x,y:mousePos.y};
});
canvas.addEventListener('mouseup',e=>{
  if(!dragging) return;
  dragging=false;
  const rect=canvas.getBoundingClientRect();
  const mx=(e.clientX-rect.left)*W/rect.width;
  const my=(e.clientY-rect.top)*H/rect.height;
  if(cue){
    const dx=cue.x-mx, dy=cue.y-my;
    const power=Math.min(Math.hypot(dx,dy),120)/120;
    const vx=dx*power*0.35, vy=dy*power*0.35;
    sendGameMove({action:'shoot',vx,vy},{balls:balls.map(b=>({...b}))});
    shoot(vx,vy);
  }
});

// WebSocket
function onGameMove(data) {
  if(data.move.action==='shoot'&&data.username!==CURRENT_USER){
    balls=data.state.balls;
    cue=balls[0];
    shoot(data.move.vx, data.move.vy);
  }
}
function onGameEvent(data){
  if(data.event==='win'){SFX.lose();showOverlay('🎱 Game Over',`${PLAYER_LIST[data.payload.winner]} wins!`);gameActive=false;}
  if(data.event==='new_game') initGame();
}
function onNewGame(){ sendGameEvent('new_game'); initGame(); }

initGame();
gameLoop();
