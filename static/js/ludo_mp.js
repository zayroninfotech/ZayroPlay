/* ludo_mp.js – Multiplayer Ludo */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 600; canvas.height = 600;

const N = 15; // grid cells
const SZ = canvas.width / N;

const PLAYER_COLORS = ['#ef4444','#22c55e','#3b82f6','#f59e0b'];
const PLAYER_NAMES  = ['Red','Green','Blue','Yellow'];

// Home positions (top-left corner of each home quadrant)
const HOMES = [
  {r:0,c:0},   // Red
  {r:0,c:9},   // Green
  {r:9,c:9},   // Blue
  {r:9,c:0},   // Yellow
];

// Safe cells on the path (board positions)
const SAFE = new Set([1,9,14,22,27,35,40,48]);

// 52-cell path for Red (others are offset by 13 each)
function buildPath() {
  const cells = [];
  // Red path starts at (6,1)
  const raw = [
    [6,1],[6,2],[6,3],[6,4],[6,5],
    [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
    [0,7],[0,8],
    [1,8],[2,8],[3,8],[4,8],[5,8],
    [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
    [7,14],[8,14],
    [8,13],[8,12],[8,11],[8,10],[8,9],
    [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
    [14,7],[14,6],
    [13,6],[12,6],[11,6],[10,6],[9,6],
    [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
    [7,0],[6,0],
  ];
  return raw;
}
const PATH = buildPath();

// Token start positions (off board = index -1)
// Each player has 4 tokens
let tokens; // tokens[player][token] = {pos: -1..51, finished:false}
let diceValue = null;
let myTurn = false;
let currentPlayer;
let gameActive = true;
let rolling = false;

function initGame() {
  tokens = PLAYER_LIST.map(() =>
    Array.from({length:4}, () => ({pos:-1, finished:false}))
  );
  currentPlayer = 0;
  diceValue = null; myTurn = false; gameActive = true; rolling = false;
  myTurn = currentPlayer === PLAYER_INDEX;
  draw();
  updateStatus();
}

function cellCenter(r, c) {
  return { x: c*SZ + SZ/2, y: r*SZ + SZ/2 };
}

function drawBoard() {
  // Background
  ctx.fillStyle = '#1a0a2e';
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // Draw grid squares colored by zone
  for(let r=0;r<N;r++) for(let c=0;c<N;c++) {
    let color = '#2d1b69';
    // Home zones
    if(r<6&&c<6) color='#ef444422';
    if(r<6&&c>8) color='#22c55e22';
    if(r>8&&c>8) color='#3b82f622';
    if(r>8&&c<6) color='#f59e0b22';
    // Center
    if(r>=6&&r<=8&&c>=6&&c<=8) color='#ffffff11';
    // Paths
    if((r===6||r===8)&&(c<6||c>8)) color='#ffffff08';
    if((c===6||c===8)&&(r<6||r>8)) color='#ffffff08';

    ctx.fillStyle=color;
    ctx.fillRect(c*SZ+1,r*SZ+1,SZ-2,SZ-2);
    ctx.strokeStyle='#ffffff0a';
    ctx.strokeRect(c*SZ,r*SZ,SZ,SZ);
  }

  // Color safe/start squares
  const coloredCells = [
    {r:6,c:1,p:0},{r:1,c:8,p:1},{r:8,c:13,p:2},{r:13,c:6,p:3}
  ];
  coloredCells.forEach(({r,c,p}) => {
    ctx.fillStyle = PLAYER_COLORS[p]+'55';
    ctx.fillRect(c*SZ+1,r*SZ+1,SZ-2,SZ-2);
  });

  // Home areas
  HOMES.forEach(({r,c},p) => {
    const rr = p<2?r:r; const cc = p%2===0&&p<2?c:p===1?c:c;
    const hr = p===0?0:p===1?0:9;
    const hc = p===0?0:p===1?9:p===2?9:0;
    ctx.fillStyle = PLAYER_COLORS[p]+'33';
    ctx.fillRect(hc*SZ, hr*SZ, 6*SZ, 6*SZ);
    // Inner white square
    ctx.fillStyle='#ffffff15';
    ctx.fillRect((hc+1)*SZ,(hr+1)*SZ,4*SZ,4*SZ);
  });

  // Center star
  ctx.save();
  ctx.translate(7.5*SZ,7.5*SZ);
  ctx.fillStyle='#ffffff22';
  ctx.beginPath();
  for(let i=0;i<4;i++){
    ctx.rotate(Math.PI/2);
    ctx.moveTo(0,0);
    ctx.lineTo(-SZ*1.4,SZ*0.5);
    ctx.lineTo(-SZ*1.4,-SZ*0.5);
  }
  ctx.fill();
  ctx.restore();
}

function pathCell(playerIdx, tokenPos) {
  const offset = playerIdx * 13;
  const idx = (tokenPos + offset) % 52;
  return PATH[idx];
}

function drawTokens() {
  const NUM = Math.min(PLAYER_LIST.length, 4);
  const homeSlots = [
    [{r:1,c:1},{r:1,c:3},{r:3,c:1},{r:3,c:3}],
    [{r:1,c:10},{r:1,c:12},{r:3,c:10},{r:3,c:12}],
    [{r:10,c:10},{r:10,c:12},{r:12,c:10},{r:12,c:12}],
    [{r:10,c:1},{r:10,c:3},{r:12,c:1},{r:12,c:3}],
  ];

  for(let p=0;p<NUM;p++) {
    tokens[p].forEach((tok, ti) => {
      let x,y;
      if(tok.finished) return;
      if(tok.pos === -1) {
        const slot = homeSlots[p][ti];
        const center = cellCenter(slot.r, slot.c);
        x=center.x; y=center.y;
      } else {
        const [r,c] = pathCell(p, tok.pos);
        const center = cellCenter(r,c);
        // Offset multiple tokens on same cell
        const off = (ti%2)*8-4;
        x=center.x+off; y=center.y+(ti>1?6:-6);
      }
      // Shadow
      ctx.fillStyle='#000000aa';
      ctx.beginPath();
      ctx.ellipse(x,y+10,SZ*.22,SZ*.1,0,0,Math.PI*2);
      ctx.fill();
      // Body
      ctx.fillStyle = PLAYER_COLORS[p];
      ctx.beginPath();
      ctx.arc(x,y,SZ*.22,0,Math.PI*2);
      ctx.fill();
      ctx.strokeStyle='#fff';
      ctx.lineWidth=1.5;
      ctx.stroke();
      // Number
      ctx.fillStyle='#fff';
      ctx.font=`bold ${SZ*.22}px sans-serif`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(ti+1,x,y);
    });
  }
}

function drawDice() {
  const x=canvas.width/2-30, y=canvas.height/2-30;
  ctx.fillStyle='#ffffffee';
  ctx.beginPath();
  ctx.roundRect(x,y,60,60,10);
  ctx.fill();
  ctx.fillStyle='#1a0a2e';
  if(diceValue) {
    const dots=[[.5,.5],
      [.3,.3],[.7,.7],
      [.3,.3],[.5,.5],[.7,.7],
      [.3,.3],[.3,.7],[.7,.3],[.7,.7],
      [.3,.3],[.3,.7],[.5,.5],[.7,.3],[.7,.7],
      [.3,.3],[.3,.5],[.3,.7],[.7,.3],[.7,.5],[.7,.7]
    ];
    const sets=[,[0],[1,2],[3,5],[1,2,3,4],[1,2,3,4,5],[6,7,8,9,10,11]];
    sets[diceValue].forEach(i=>{
      ctx.beginPath();
      ctx.arc(x+dots[i][0]*60,y+dots[i][1]*60,5,0,Math.PI*2);
      ctx.fill();
    });
  } else {
    ctx.font='bold 28px sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('?',x+30,y+30);
  }
}

function draw() {
  drawBoard();
  drawTokens();
  if(myTurn||currentPlayer===PLAYER_INDEX) drawDice();
}

function rollDice() {
  if (!myTurn || rolling || !gameActive) return;
  rolling = true;
  SFX.dice();
  let ticks = 0;
  const anim = setInterval(() => {
    diceValue = Math.floor(Math.random()*6)+1;
    draw();
    if(++ticks > 8) {
      clearInterval(anim);
      rolling = false;
      sendGameMove({action:'roll', value:diceValue}, {player:PLAYER_INDEX});
      checkMovable();
    }
  }, 80);
}

function checkMovable() {
  const myToks = tokens[PLAYER_INDEX];
  const canMove = myToks.some(t =>
    !t.finished && (t.pos === -1 ? diceValue===6 : t.pos+diceValue<=51)
  );
  if(!canMove) {
    setStatus('No moves available — passing turn', 2000);
    setTimeout(() => endTurn(), 1500);
  } else {
    setStatus('Click a token to move', 0);
  }
}

function clickToken(e) {
  if(!myTurn||!diceValue||rolling||!gameActive) return;
  const rect=canvas.getBoundingClientRect();
  const mx=(e.clientX-rect.left)*canvas.width/rect.width;
  const my=(e.clientY-rect.top)*canvas.height/rect.height;

  const myToks = tokens[PLAYER_INDEX];
  myToks.forEach((tok,ti) => {
    if(tok.finished) return;
    let tx,ty;
    if(tok.pos===-1) {
      if(diceValue!==6) return;
      const homeSlots=[[{r:1,c:1},{r:1,c:3},{r:3,c:1},{r:3,c:3}],[{r:1,c:10},{r:1,c:12},{r:3,c:10},{r:3,c:12}],[{r:10,c:10},{r:10,c:12},{r:12,c:10},{r:12,c:12}],[{r:10,c:1},{r:10,c:3},{r:12,c:1},{r:12,c:3}]];
      const slot=homeSlots[PLAYER_INDEX][ti];
      const center=cellCenter(slot.r,slot.c);
      tx=center.x; ty=center.y;
    } else {
      const [r,c]=pathCell(PLAYER_INDEX,tok.pos);
      const center=cellCenter(r,c);
      tx=center.x; ty=center.y;
    }
    if(Math.hypot(mx-tx,my-ty)<SZ*.3) {
      moveToken(PLAYER_INDEX, ti);
    }
  });
}

function moveToken(player, ti) {
  const tok = tokens[player][ti];
  SFX.move();
  if(tok.pos===-1) {
    tok.pos=0;
  } else {
    tok.pos += diceValue;
    if(tok.pos>=51) { tok.finished=true; tok.pos=51; SFX.climb(); }
  }
  sendGameMove({action:'move', player, token:ti, pos:tok.pos, finished:tok.finished}, {tokens});

  // Check win
  if(tokens[player].every(t=>t.finished)) {
    SFX.win();
    showOverlay('🎲 You Win!', `${PLAYER_NAMES[player]} wins Ludo!`);
    gameActive=false;
    sendGameEvent('win',{winner:PLAYER_INDEX});
    return;
  }

  if(diceValue===6) {
    setStatus('🎲 Rolled 6 — roll again!', 0);
    diceValue=null;
  } else {
    endTurn();
  }
  draw();
}

function endTurn() {
  diceValue=null;
  currentPlayer=(currentPlayer+1)%PLAYER_LIST.length;
  myTurn = currentPlayer===PLAYER_INDEX;
  sendGameMove({action:'turn'},{currentPlayer});
  updateStatus();
  draw();
}

function updateStatus() {
  if(!gameActive) return;
  if(myTurn) setStatus('🎲 Your turn — click the dice!',0);
  else setStatus(`⏳ ${PLAYER_LIST[currentPlayer]}'s turn`,0);
}

// WebSocket
function onGameMove(data) {
  const {action}=data.move;
  if(action==='roll') {
    diceValue=data.move.value;
    SFX.dice();
    draw();
  } else if(action==='move') {
    tokens=data.state.tokens;
    SFX.move();
    draw();
    if(tokens[data.move.player]?.every(t=>t.finished)) {
      SFX.lose();
      showOverlay('🎲 Game Over',`${PLAYER_NAMES[data.move.player]} wins!`);
      gameActive=false;
    }
  } else if(action==='turn') {
    currentPlayer=data.state.currentPlayer;
    myTurn=currentPlayer===PLAYER_INDEX;
    diceValue=null;
    updateStatus(); draw();
  }
}
function onGameEvent(data) {
  if(data.event==='new_game') initGame();
}
function onNewGame(){ sendGameEvent('new_game'); initGame(); }

canvas.addEventListener('click', e => {
  const rect=canvas.getBoundingClientRect();
  const mx=(e.clientX-rect.left)*canvas.width/rect.width;
  const my=(e.clientY-rect.top)*canvas.height/rect.height;
  // Click center area for dice
  if(Math.abs(mx-canvas.width/2)<40&&Math.abs(my-canvas.height/2)<40) rollDice();
  else clickToken(e);
});

initGame();
