/* chess_mp.js – Multiplayer Chess (chess.com style) */
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
canvas.width = 560; canvas.height = 560;
const SQ = 70;
const COLS = ['a','b','c','d','e','f','g','h'];

const PIECES = {
  wK:'♔',wQ:'♕',wR:'♖',wB:'♗',wN:'♘',wP:'♙',
  bK:'♚',bQ:'♛',bR:'♜',bB:'♝',bN:'♞',bP:'♟'
};

const PIECE_VALUES = { P:1, N:3, B:3, R:5, Q:9, K:0 };

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
let lastMove   = null;          // {from:[r,c], to:[r,c]}
let capturedW  = [];            // pieces white captured (black pieces taken)
let capturedB  = [];            // pieces black captured (white pieces taken)
let moveHistory = [];           // [{w:'e4', b:'e5'}, ...]
let inCheck    = false;
window.gameReady = false;

// ── Board orientation ──────────────────────────────────────────────
// Black player sees board flipped 180°
function toVisual(r, c) {
  return myColor === 'b' ? [7 - r, 7 - c] : [r, c];
}
function toBoard(vr, vc) {
  return myColor === 'b' ? [7 - vr, 7 - vc] : [vr, vc];
}

// ── Init ───────────────────────────────────────────────────────────
function initGame() {
  board       = INIT_BOARD.map(r => [...r]);
  selected    = null;
  legalMoves  = [];
  lastMove    = null;
  capturedW   = [];
  capturedB   = [];
  moveHistory = [];
  inCheck     = false;
  currentTurn = 'w';
  gameActive  = true;

  if (!window.gameReady) {
    drawBoard();
    setStatus('⏳ Waiting for opponent to join…');
    return;
  }
  myColor = PLAYER_INDEX === 0 ? 'w' : 'b';
  buildPanels();
  drawBoard();
  updateTurnStatus();
}

// ── HTML player panels ────────────────────────────────────────────
function buildPanels() {
  const gameArea = document.getElementById('game-area');
  // Remove old panels
  ['chess-top','chess-bot','chess-moves-wrap'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });

  const oppIdx  = myColor === 'w' ? 1 : 0;
  const meIdx   = myColor === 'w' ? 0 : 1;
  const oppName = PLAYER_LIST[oppIdx] || 'Opponent';
  const meName  = PLAYER_LIST[meIdx]  || 'Me';
  const oppCol  = myColor === 'w' ? '⬛ Black' : '⬜ White';
  const meCol   = myColor === 'w' ? '⬜ White' : '⬛ Black';

  // Top panel = opponent
  const top = document.createElement('div');
  top.id = 'chess-top';
  top.className = 'chess-panel';
  top.innerHTML = `
    <span class="chess-panel-av">🎮</span>
    <span class="chess-panel-name" id="opp-name">${oppName}</span>
    <span class="chess-panel-color">${oppCol}</span>
    <span id="chess-check-opp" style="display:none" class="chess-check-badge">CHECK</span>
    <span class="chess-panel-caps" id="caps-opp"></span>
    <span class="chess-panel-score" id="score-opp"></span>`;

  // Bottom panel = me
  const bot = document.createElement('div');
  bot.id = 'chess-bot';
  bot.className = 'chess-panel me';
  bot.innerHTML = `
    <span class="chess-panel-av">🎮</span>
    <span class="chess-panel-name" id="my-name">${meName}</span>
    <span class="chess-panel-color">${meCol}</span>
    <span id="chess-check-me" style="display:none" class="chess-check-badge">CHECK</span>
    <span class="chess-panel-caps" id="caps-me"></span>
    <span class="chess-panel-score" id="score-me"></span>`;

  // Move history
  const movesWrap = document.createElement('div');
  movesWrap.id = 'chess-moves-wrap';
  movesWrap.innerHTML = '<div class="chess-moves" id="chess-moves"></div>';

  gameArea.insertBefore(top, canvas);
  gameArea.appendChild(bot);
  gameArea.appendChild(movesWrap);
}

function updatePanels() {
  // Material advantage
  const scoreW = capturedW.reduce((s, p) => s + (PIECE_VALUES[p[1]] || 0), 0);
  const scoreB = capturedB.reduce((s, p) => s + (PIECE_VALUES[p[1]] || 0), 0);
  const diff   = scoreW - scoreB;

  const capsOppEl  = document.getElementById('caps-opp');
  const capsMeEl   = document.getElementById('caps-me');
  const scoreOppEl = document.getElementById('score-opp');
  const scoreMeEl  = document.getElementById('score-me');
  if (!capsOppEl) return;

  if (myColor === 'w') {
    // I'm white: I capture black pieces (capturedW), opp captures white pieces (capturedB)
    capsOppEl.textContent = capturedB.map(p => PIECES[p]).join('');
    capsMeEl.textContent  = capturedW.map(p => PIECES[p]).join('');
    if (diff > 0) { scoreMeEl.textContent = `+${diff}`; scoreOppEl.textContent = ''; }
    else if (diff < 0) { scoreOppEl.textContent = `+${-diff}`; scoreMeEl.textContent = ''; }
    else { scoreMeEl.textContent = ''; scoreOppEl.textContent = ''; }
  } else {
    // I'm black: I capture white pieces (capturedB), opp captures black pieces (capturedW)
    capsOppEl.textContent = capturedW.map(p => PIECES[p]).join('');
    capsMeEl.textContent  = capturedB.map(p => PIECES[p]).join('');
    if (diff < 0) { scoreMeEl.textContent = `+${-diff}`; scoreOppEl.textContent = ''; }
    else if (diff > 0) { scoreOppEl.textContent = `+${diff}`; scoreMeEl.textContent = ''; }
    else { scoreMeEl.textContent = ''; scoreOppEl.textContent = ''; }
  }

  // Check badge
  const checkMe  = document.getElementById('chess-check-me');
  const checkOpp = document.getElementById('chess-check-opp');
  if (checkMe && checkOpp) {
    const myCheck  = inCheck && currentTurn === myColor;
    const oppCheck = inCheck && currentTurn !== myColor;
    checkMe.style.display  = myCheck  ? '' : 'none';
    checkOpp.style.display = oppCheck ? '' : 'none';
  }
}

function addMoveHistory(notation, color) {
  const box = document.getElementById('chess-moves');
  if (!box) return;

  if (color === 'w') {
    const row = document.createElement('div');
    row.className = 'chess-move-row';
    const num = Math.ceil(moveHistory.length / 2) + 1;
    row.innerHTML = `
      <span class="chess-move-num">${num}.</span>
      <span class="chess-move-w chess-move-latest" id="mv-w-${num}">${notation}</span>
      <span class="chess-move-b" id="mv-b-${num}"></span>`;
    // Remove latest highlight from previous
    box.querySelectorAll('.chess-move-latest').forEach(el => el.classList.remove('chess-move-latest'));
    box.appendChild(row);
  } else {
    const rows = box.querySelectorAll('.chess-move-row');
    const last = rows[rows.length - 1];
    if (last) {
      const bCell = last.querySelector('.chess-move-b');
      if (bCell) {
        box.querySelectorAll('.chess-move-latest').forEach(el => el.classList.remove('chess-move-latest'));
        bCell.textContent = notation;
        bCell.classList.add('chess-move-latest');
      }
    }
  }
  box.scrollTop = box.scrollHeight;
  moveHistory.push({ notation, color });
}

// ── Check detection ────────────────────────────────────────────────
function isKingInCheck(color, boardState) {
  let kr = -1, kc = -1;
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (boardState[r][c] === color + 'K') { kr = r; kc = c; }
  if (kr < 0) return false;

  const opp = color === 'w' ? 'b' : 'w';
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (boardState[r][c] && boardState[r][c][0] === opp)
        if (getRawMoves(r, c, boardState).some(m => m[0] === kr && m[1] === kc))
          return true;
  return false;
}

// ── Raw moves (no check filtering) ────────────────────────────────
function getRawMoves(r, c, b = board) {
  const piece = b[r][c];
  if (!piece) return [];
  const color = piece[0], type = piece[1];
  const moves = [];
  const inB  = (rr, cc) => rr >= 0 && rr < 8 && cc >= 0 && cc < 8;
  const enmy = (rr, cc) => b[rr][cc] && b[rr][cc][0] !== color;
  const empt = (rr, cc) => !b[rr][cc];

  const slide = (dr, dc) => {
    let rr = r + dr, cc = c + dc;
    while (inB(rr, cc)) {
      if (empt(rr, cc)) moves.push([rr, cc]);
      else { if (enmy(rr, cc)) moves.push([rr, cc]); break; }
      rr += dr; cc += dc;
    }
  };

  if (type === 'P') {
    const dir = color === 'w' ? -1 : 1, start = color === 'w' ? 6 : 1;
    if (inB(r+dir,c) && empt(r+dir,c)) {
      moves.push([r+dir,c]);
      if (r===start && empt(r+2*dir,c)) moves.push([r+2*dir,c]);
    }
    [-1,1].forEach(dc => { if (inB(r+dir,c+dc) && enmy(r+dir,c+dc)) moves.push([r+dir,c+dc]); });
  }
  if (type === 'N')
    [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]
      .forEach(([dr,dc]) => { if (inB(r+dr,c+dc) && (empt(r+dr,c+dc)||enmy(r+dr,c+dc))) moves.push([r+dr,c+dc]); });
  if (type==='B'||type==='Q') { slide(-1,-1);slide(-1,1);slide(1,-1);slide(1,1); }
  if (type==='R'||type==='Q') { slide(-1,0);slide(1,0);slide(0,-1);slide(0,1); }
  if (type==='K')
    [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
      .forEach(([dr,dc]) => { if (inB(r+dr,c+dc) && (empt(r+dr,c+dc)||enmy(r+dr,c+dc))) moves.push([r+dr,c+dc]); });

  return moves;
}

// Legal moves = raw moves that don't leave own king in check
function getLegalMoves(r, c) {
  const raw   = getRawMoves(r, c);
  const color = board[r][c][0];
  return raw.filter(([tr, tc]) => {
    const copy = board.map(row => [...row]);
    copy[tr][tc] = copy[r][c];
    copy[r][c]   = null;
    return !isKingInCheck(color, copy);
  });
}

// Algebraic notation (basic)
function toAlgebraic(piece, from, to, cap, promo) {
  const fileFrom = COLS[from[1]];
  const fileTo   = COLS[to[1]];
  const rankTo   = 8 - to[0];
  const type     = piece[1];
  const capture  = cap ? 'x' : '';
  if (type === 'P') return `${cap ? fileFrom : ''}${capture}${fileTo}${rankTo}${promo ? '=Q' : ''}`;
  return `${type}${capture}${fileTo}${rankTo}`;
}

// ── Draw board ────────────────────────────────────────────────────
function drawBoard() {
  for (let vr = 0; vr < 8; vr++) {
    for (let vc = 0; vc < 8; vc++) {
      const [r, c] = toBoard(vr, vc);
      const light  = (vr + vc) % 2 === 0;

      // Base square color
      let sqColor = light ? '#f0d9b5' : '#b58863';

      // Last move highlight
      if (lastMove) {
        const [fr,fc] = lastMove.from, [tr,tc] = lastMove.to;
        if ((r===fr&&c===fc)||(r===tr&&c===tc))
          sqColor = light ? '#cdd26a' : '#aaa23a';
      }

      ctx.fillStyle = sqColor;
      ctx.fillRect(vc*SQ, vr*SQ, SQ, SQ);

      // Selected highlight
      if (selected && selected[0]===r && selected[1]===c) {
        ctx.fillStyle = '#f6f669cc';
        ctx.fillRect(vc*SQ, vr*SQ, SQ, SQ);
      }

      // Check highlight on king
      if (inCheck) {
        const kingColor = currentTurn;
        if (board[r][c] === kingColor+'K') {
          ctx.fillStyle = '#ef444455';
          ctx.fillRect(vc*SQ, vr*SQ, SQ, SQ);
        }
      }

      // Legal move dots / capture rings
      if (legalMoves.some(m => m[0]===r && m[1]===c)) {
        if (board[r][c]) {
          ctx.strokeStyle = '#00000055';
          ctx.lineWidth   = 4;
          ctx.strokeRect(vc*SQ+2, vr*SQ+2, SQ-4, SQ-4);
        } else {
          ctx.fillStyle = '#00000033';
          ctx.beginPath();
          ctx.arc(vc*SQ+SQ/2, vr*SQ+SQ/2, SQ*0.16, 0, Math.PI*2);
          ctx.fill();
        }
      }

      // Draw piece
      const piece = board[r][c];
      if (piece) {
        ctx.save();
        ctx.font          = `${SQ*0.78}px serif`;
        ctx.textAlign     = 'center';
        ctx.textBaseline  = 'middle';
        // Shadow for depth
        ctx.shadowColor   = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur    = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle  = piece[0]==='w' ? '#ffffff' : '#1a1a1a';
        ctx.strokeStyle= piece[0]==='w' ? '#666'    : '#ccc';
        ctx.lineWidth  = 1.5;
        ctx.strokeText(PIECES[piece], vc*SQ+SQ/2, vr*SQ+SQ/2+2);
        ctx.fillText(PIECES[piece],   vc*SQ+SQ/2, vr*SQ+SQ/2+2);
        ctx.restore();
      }
    }
  }

  // Coordinates
  ctx.font = 'bold 11px sans-serif';
  for (let i = 0; i < 8; i++) {
    const light     = i % 2 === 0;
    const rankLabel = myColor==='b' ? String(i+1)      : String(8-i);
    const fileLabel = myColor==='b' ? COLS[7-i]        : COLS[i];
    ctx.fillStyle   = light ? '#b58863' : '#f0d9b5';
    ctx.textAlign   = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(rankLabel, 2, i*SQ+2);
    ctx.textAlign   = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText(fileLabel, (i+1)*SQ-2, 8*SQ-2);
  }
}

// ── Click handler ─────────────────────────────────────────────────
function handleClick(e) {
  if (!window.gameReady || !gameActive || currentTurn !== myColor) return;
  const rect = canvas.getBoundingClientRect();
  const vc   = Math.floor((e.clientX - rect.left) * (canvas.width  / rect.width)  / SQ);
  const vr   = Math.floor((e.clientY - rect.top)  * (canvas.height / rect.height) / SQ);
  if (vc < 0 || vc > 7 || vr < 0 || vr > 7) return;
  const [r, c] = toBoard(vr, vc);

  if (selected) {
    const isLegal = legalMoves.some(m => m[0]===r && m[1]===c);
    if (isLegal) {
      makeMove(selected[0], selected[1], r, c, true);
    } else if (board[r][c] && board[r][c][0] === myColor) {
      selected   = [r, c];
      legalMoves = getLegalMoves(r, c);
      SFX.click();
      drawBoard();
    } else {
      selected = null; legalMoves = [];
      drawBoard();
    }
  } else {
    if (board[r][c] && board[r][c][0] === myColor) {
      selected   = [r, c];
      legalMoves = getLegalMoves(r, c);
      SFX.click();
      drawBoard();
    }
  }
}

function makeMove(fr, fc, tr, tc, sendToServer) {
  const piece    = board[fr][fc];
  const captured = board[tr][tc];
  const promo    = piece[1]==='P' && (tr===0||tr===7);

  board[tr][tc] = promo ? piece[0]+'Q' : piece;
  board[fr][fc] = null;

  lastMove = { from:[fr,fc], to:[tr,tc] };

  // Track captures
  if (captured) {
    if (myColor==='w'||!sendToServer) {
      if (piece[0]==='w') capturedW.push(captured);
      else                capturedB.push(captured);
    }
    SFX.capture();
  } else {
    SFX.move();
  }

  // Algebraic notation
  const notation = toAlgebraic(piece, [fr,fc], [tr,tc], captured, promo);
  addMoveHistory(notation, piece[0]);

  const nextTurn = piece[0]==='w' ? 'b' : 'w';

  // Check detection
  inCheck = isKingInCheck(nextTurn, board);

  if (sendToServer) {
    sendGameMove(
      { from:[fr,fc], to:[tr,tc], piece, captured, promo },
      { board, turn: nextTurn, capturedW, capturedB, inCheck }
    );
  }

  currentTurn = nextTurn;
  selected    = null;
  legalMoves  = [];

  drawBoard();
  updateTurnStatus();
  updatePanels();

  // Win: king captured / checkmate (simplified)
  if (captured && captured[1]==='K') {
    const winner = piece[0]==='w' ? 'White' : 'Black';
    SFX.win();
    showOverlay('♟ Checkmate!', `${winner} wins!`);
    gameActive = false;
    if (sendToServer) sendGameEvent('win', { winner });
    return;
  }

  // Check if opponent has no legal moves (stalemate / checkmate)
  if (sendToServer) {
    const hasLegal = hasAnyLegalMove(nextTurn);
    if (!hasLegal) {
      const result = inCheck ? 'Checkmate' : 'Stalemate';
      const winner = inCheck ? (piece[0]==='w'?'White':'Black') : null;
      SFX.win();
      if (winner) {
        showOverlay(`♟ ${result}!`, `${winner} wins!`);
        sendGameEvent('win', { winner });
      } else {
        showOverlay('♟ Stalemate!', "It's a draw!");
        sendGameEvent('draw', {});
      }
      gameActive = false;
    } else if (inCheck) {
      setStatus('⚠️ Check!', 2500);
    }
  }
}

function hasAnyLegalMove(color) {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c] && board[r][c][0]===color)
        if (getLegalMoves(r, c).length > 0) return true;
  return false;
}

// ── Status ────────────────────────────────────────────────────────
function updateTurnStatus() {
  if (!gameActive) return;
  const mine     = currentTurn === myColor;
  const oppName  = PLAYER_LIST[myColor==='w'?1:0] || 'Opponent';
  if (mine) {
    setStatus(inCheck ? '⚠️ You are in CHECK — move your king!' : '♟ Your turn', 0);
  } else {
    setStatus(`⏳ ${oppName}'s turn`, 0);
  }
}

// ── WebSocket handlers ────────────────────────────────────────────
function onGameMove(data) {
  if (data.username === CURRENT_USER) return;
  const { board: nb, turn, capturedW: cw, capturedB: cb, inCheck: ic } = data.state;
  const mv = data.move;
  if (!nb) return;

  board       = nb;
  currentTurn = turn;
  capturedW   = cw || capturedW;
  capturedB   = cb || capturedB;
  inCheck     = ic || false;
  lastMove    = mv ? { from: mv.from, to: mv.to } : lastMove;

  if (mv) {
    if (mv.captured) SFX.capture(); else SFX.move();
    const notation = toAlgebraic(mv.piece, mv.from, mv.to, mv.captured, mv.promo);
    addMoveHistory(notation, mv.piece[0]);
  }

  drawBoard();
  updateTurnStatus();
  updatePanels();

  // Opponent wins
  if (mv && mv.captured && mv.captured[1]==='K') {
    SFX.lose();
    const loser  = mv.piece[0]==='w' ? 'Black' : 'White';
    showOverlay('♟ Game Over', `${mv.piece[0]==='w'?'White':'Black'} wins! You lost.`);
    gameActive = false;
  }
}

function onGameEvent(data) {
  if (data.event === 'win') {
    SFX.lose();
    showOverlay('♟ Game Over', `${data.payload.winner} wins! You lost.`);
    gameActive = false;
  }
  if (data.event === 'draw') {
    showOverlay('♟ Draw!', "Game is a draw.");
    gameActive = false;
  }
  if (data.event === 'new_game') initGame();
}

function onNewGame() { sendGameEvent('new_game'); initGame(); }

canvas.addEventListener('click', handleClick);
initGame();
