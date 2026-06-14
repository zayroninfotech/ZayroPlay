/* chess_mp.js – Multiplayer Chess */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 560; canvas.height = 560;

const SQ = 70;
const COLS = ['a','b','c','d','e','f','g','h'];

// Piece unicode
const PIECES = {
  wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',
  bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟'
};

const INIT_BOARD = [
  ['bR','bN','bB','bQ','bK','bB','bN','bR'],
  ['bP','bP','bP','bP','bP','bP','bP','bP'],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  [null,null,null,null,null,null,null,null],
  ['wP','wP','wP','wP','wP','wP','wP','wP'],
  ['wR','wN','wB','wQ','wK','wB','wN','wR'],
];

let board, selected, currentTurn, myColor, gameActive;
let legalMoves = [];

function initGame() {
  board = INIT_BOARD.map(r => [...r]);
  selected = null; legalMoves = [];
  currentTurn = 'w';
  gameActive = true;
  // Player 0 = white, Player 1 = black
  myColor = PLAYER_INDEX === 0 ? 'w' : 'b';
  drawBoard();
  updateTurnStatus();
}

function drawBoard() {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const light = (r+c)%2===0;
      ctx.fillStyle = light ? '#f0d9b5' : '#b58863';
      ctx.fillRect(c*SQ, r*SQ, SQ, SQ);

      // Highlight selected
      if (selected && selected[0]===r && selected[1]===c) {
        ctx.fillStyle = '#f6f669aa';
        ctx.fillRect(c*SQ, r*SQ, SQ, SQ);
      }
      // Legal move dots
      if (legalMoves.some(m=>m[0]===r&&m[1]===c)) {
        const target = board[r][c];
        if (target) {
          ctx.strokeStyle = '#f6f669aa';
          ctx.lineWidth = 4;
          ctx.strokeRect(c*SQ+2, r*SQ+2, SQ-4, SQ-4);
        } else {
          ctx.fillStyle = '#00000030';
          ctx.beginPath();
          ctx.arc(c*SQ+SQ/2, r*SQ+SQ/2, SQ/6, 0, Math.PI*2);
          ctx.fill();
        }
      }

      // Draw piece
      const piece = board[r][c];
      if (piece) {
        ctx.font = `${SQ*0.75}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = piece[0]==='w' ? '#fff' : '#1a1a1a';
        ctx.strokeStyle = piece[0]==='w' ? '#555' : '#ddd';
        ctx.lineWidth = 1;
        ctx.strokeText(PIECES[piece], c*SQ+SQ/2, r*SQ+SQ/2+2);
        ctx.fillText(PIECES[piece], c*SQ+SQ/2, r*SQ+SQ/2+2);
      }
    }
  }

  // Coordinates
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  for (let i=0;i<8;i++) {
    ctx.fillStyle = i%2===0?'#b58863':'#f0d9b5';
    ctx.fillText(8-i, 2, i*SQ+2);
    ctx.textAlign='right'; ctx.textBaseline='bottom';
    ctx.fillStyle = i%2===0?'#f0d9b5':'#b58863';
    ctx.fillText(COLS[i], (i+1)*SQ-2, 8*SQ-2);
    ctx.textAlign='left'; ctx.textBaseline='top';
  }
}

function getLegalMoves(r, c) {
  const piece = board[r][c];
  if (!piece) return [];
  const color = piece[0], type = piece[1];
  const moves = [];
  const inBounds = (rr,cc) => rr>=0&&rr<8&&cc>=0&&cc<8;
  const enemy = (rr,cc) => board[rr][cc] && board[rr][cc][0]!==color;
  const empty = (rr,cc) => !board[rr][cc];

  const slide = (dr,dc) => {
    let rr=r+dr,cc=c+dc;
    while(inBounds(rr,cc)){
      if(empty(rr,cc)) moves.push([rr,cc]);
      else { if(enemy(rr,cc)) moves.push([rr,cc]); break; }
      rr+=dr; cc+=dc;
    }
  };

  if(type==='P'){
    const dir = color==='w'?-1:1;
    const start = color==='w'?6:1;
    if(inBounds(r+dir,c)&&empty(r+dir,c)){
      moves.push([r+dir,c]);
      if(r===start&&empty(r+2*dir,c)) moves.push([r+2*dir,c]);
    }
    [-1,1].forEach(dc=>{ if(inBounds(r+dir,c+dc)&&enemy(r+dir,c+dc)) moves.push([r+dir,c+dc]); });
  }
  if(type==='N'){
    [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>{
      if(inBounds(r+dr,c+dc)&&(empty(r+dr,c+dc)||enemy(r+dr,c+dc))) moves.push([r+dr,c+dc]);
    });
  }
  if(type==='B'||type==='Q') { slide(-1,-1);slide(-1,1);slide(1,-1);slide(1,1); }
  if(type==='R'||type==='Q') { slide(-1,0);slide(1,0);slide(0,-1);slide(0,1); }
  if(type==='K'){
    [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc])=>{
      if(inBounds(r+dr,c+dc)&&(empty(r+dr,c+dc)||enemy(r+dr,c+dc))) moves.push([r+dr,c+dc]);
    });
  }
  return moves;
}

function handleClick(e) {
  if (!gameActive || currentTurn !== myColor) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const c = Math.floor((e.clientX - rect.left) * scaleX / SQ);
  const r = Math.floor((e.clientY - rect.top) * scaleY / SQ);
  if (c<0||c>7||r<0||r>7) return;

  if (selected) {
    const isLegal = legalMoves.some(m=>m[0]===r&&m[1]===c);
    if (isLegal) {
      const captured = board[r][c];
      const piece = board[selected[0]][selected[1]];
      board[r][c] = piece;
      board[selected[0]][selected[1]] = null;
      // Pawn promotion
      if (piece[1]==='P'&&(r===0||r===7)) board[r][c] = piece[0]+'Q';

      if (captured) SFX.capture(); else SFX.move();

      const move = { from:[selected[0],selected[1]], to:[r,c], piece, captured };
      sendGameMove(move, { board, turn: myColor==='w'?'b':'w' });
      currentTurn = myColor==='w'?'b':'w';
      selected = null; legalMoves = [];
      drawBoard(); updateTurnStatus();

      // Check king captured
      if (captured && captured[1]==='K') {
        const winner = myColor==='w'?'White':'Black';
        SFX.win();
        showOverlay('♟ Checkmate!', `${winner} wins!`);
        gameActive = false;
        sendGameEvent('win', { winner });
      }
    } else if (board[r][c]&&board[r][c][0]===myColor) {
      selected = [r,c];
      legalMoves = getLegalMoves(r,c);
      SFX.click();
      drawBoard();
    } else {
      selected = null; legalMoves = [];
      drawBoard();
    }
  } else {
    if (board[r][c]&&board[r][c][0]===myColor) {
      selected = [r,c];
      legalMoves = getLegalMoves(r,c);
      SFX.click();
      drawBoard();
    }
  }
}

function updateTurnStatus() {
  const mine = currentTurn === myColor;
  setStatus(mine ? '♟ Your turn' : `⏳ ${PLAYER_LIST[currentTurn==='w'?0:1]}'s turn`, 0);
}

// WebSocket handlers
function onGameMove(data) {
  const { board: newBoard, turn } = data.state;
  if (newBoard) {
    board = newBoard;
    currentTurn = turn;
    const { captured } = data.move;
    if (captured) SFX.capture(); else SFX.move();
    drawBoard(); updateTurnStatus();
  }
}

function onGameEvent(data) {
  if (data.event === 'win') {
    const loser = data.payload.winner === 'White' ? 'Black' : 'White';
    SFX.lose();
    showOverlay('♟ Game Over', `${data.payload.winner} wins! You lost.`);
    gameActive = false;
  }
  if (data.event === 'new_game') initGame();
}

function onNewGame() { sendGameEvent('new_game'); initGame(); }

canvas.addEventListener('click', handleClick);
initGame();
