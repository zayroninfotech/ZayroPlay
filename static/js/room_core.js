/* room_core.js – WebSocket + chat wiring shared by all multiplayer game rooms */

// ── Sound Engine ──────────────────────────────────────────────────────────────
const SFX = (() => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  function tone(freq, type, dur, vol=0.3, delay=0) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = type; o.frequency.value = freq;
    const t = ctx.currentTime + delay;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t); o.stop(t + dur);
  }

  function noise(dur, vol=0.15) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random()*2-1;
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buf; src.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.start();
  }

  return {
    click:   () => tone(600,  'sine',   .06, .2),
    move:    () => tone(440,  'square', .08, .15),
    capture: () => { tone(220,'sawtooth',.15,.2); tone(180,'sawtooth',.2,.1,.05); },
    dice:    () => { for(let i=0;i<6;i++) tone(300+Math.random()*400,'square',.04,.1,i*.04); },
    climb:   () => { tone(523,'sine',.1,.2); tone(659,'sine',.1,.2,.1); tone(784,'sine',.15,.2,.2); },
    slide:   () => { tone(400,'sawtooth',.08,.2); tone(200,'sawtooth',.15,.15,.06); },
    pocket:  () => { tone(150,'sine',.3,.3); noise(.15,.1); },
    strike:  () => { noise(.05,.3); tone(300,'sine',.2,.1,.03); },
    win:     () => { [523,659,784,1047].forEach((f,i)=>tone(f,'sine',.2,.3,i*.12)); },
    lose:    () => { [400,350,300,250].forEach((f,i)=>tone(f,'sawtooth',.2,.2,i*.1)); },
    chat:    () => tone(800, 'sine', .08, .1),
    join:    () => { tone(440,'sine',.1,.2); tone(550,'sine',.12,.15,.08); },
    leave:   () => { tone(440,'sine',.1,.15); tone(330,'sine',.12,.1,.08); },
    carrom_flick: () => { noise(.04,.4); tone(250,'sine',.25,.2,.02); },
  };
})();

// ── WebSocket Core ─────────────────────────────────────────────────────────────
let ws, wsReady = false;
const msgQueue = [];

function wsConnect() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    wsReady = true;
    msgQueue.forEach(m => ws.send(JSON.stringify(m)));
    msgQueue.length = 0;
    setStatus('Connected ✓', 3000);
  };

  ws.onclose = () => {
    wsReady = false;
    setStatus('Reconnecting…');
    setTimeout(wsConnect, 2500);
  };

  ws.onerror = () => ws.close();

  ws.onmessage = e => {
    const data = JSON.parse(e.data);
    switch (data.type) {
      case 'chat':         handleChatMsg(data);    break;
      case 'player_event': handlePlayerEvent(data); break;
      case 'game_start':   handleGameStart(data);  break;
      case 'game_move':    if(typeof onGameMove  ==='function') onGameMove(data);  break;
      case 'game_event':   if(typeof onGameEvent ==='function') onGameEvent(data); break;
    }
  };
}

function wsSend(obj) {
  if (wsReady) ws.send(JSON.stringify(obj));
  else msgQueue.push(obj);
}

function sendGameMove(move, state={}) {
  wsSend({ type:'game_move', move, state });
}

function sendGameEvent(event, payload={}) {
  wsSend({ type:'game_event', event, payload });
}

// ── Status bar ─────────────────────────────────────────────────────────────────
let statusTimer;
function setStatus(msg, clearAfter=0) {
  const el = document.getElementById('game-status');
  if (!el) return;
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(statusTimer);
  if (clearAfter) statusTimer = setTimeout(() => el.style.opacity='0', clearAfter);
}

// ── Game Overlay ───────────────────────────────────────────────────────────────
function showOverlay(title, msg, btnLabel='Play Again') {
  document.getElementById('go-title').textContent = title;
  document.getElementById('go-msg').textContent   = msg;
  document.getElementById('go-btn').textContent   = btnLabel;
  document.getElementById('game-overlay').classList.remove('hidden');
}
function hideOverlay() {
  document.getElementById('game-overlay').classList.add('hidden');
}
function gameOverlayAction() {
  hideOverlay();
  if (typeof onNewGame === 'function') onNewGame();
  else sendGameEvent('new_game');
}

// ── Chat ───────────────────────────────────────────────────────────────────────
function handleChatMsg(data) {
  if (data.username !== CURRENT_USER) SFX.chat();
  appendChat(data.avatar, data.username, data.content, data.timestamp);
}

function appendChat(avatar, username, content, time='') {
  const box = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `<span class="cm-av">${avatar}</span>
    <div class="cm-body">
      <span class="cm-user">${escHtml(username)}</span>
      <span class="cm-time">${time}</span>
      <div class="cm-text">${escHtml(content)}</div>
    </div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function appendSysMsg(text) {
  const box = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-sys';
  div.textContent = text;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// Called by server when 2+ players are connected — re-inits game with correct player list
function handleGameStart(data) {
  window.PLAYER_LIST  = data.players.map(p => p.username);
  const myIdx = PLAYER_LIST.indexOf(CURRENT_USER);
  window.PLAYER_INDEX = myIdx >= 0 ? myIdx : 0;
  window.gameReady    = true;
  appendSysMsg(`🎮 Game started! ${PLAYER_LIST.join(' vs ')}`);
  if (typeof initGame === 'function') initGame();
}

function handlePlayerEvent(data) {
  if (data.event === 'join') { SFX.join(); appendSysMsg(`${data.avatar} ${data.username} joined`); }
  if (data.event === 'leave'){ SFX.leave(); appendSysMsg(`${data.username} left`); }
  if (typeof onPlayerEvent === 'function') onPlayerEvent(data);
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Chat UI wiring ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('chat-input');
  const send  = document.getElementById('chat-send');

  function doSend() {
    const v = input.value.trim();
    if (!v) return;
    wsSend({ type:'chat', content: v });
    input.value = '';
  }

  send.addEventListener('click', doSend);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSend(); });

  // Scroll existing chat to bottom
  const box = document.getElementById('chat-messages');
  box.scrollTop = box.scrollHeight;

  wsConnect();
});
