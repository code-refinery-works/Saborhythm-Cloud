// ===================== GLOBAL STATE =====================
const state = {
  currentTab: 'typing',
  typingActive: false,
  typingInterval: null,
  typingAudioCtx: null,
  slackAutoMode: false,
  slackAutoInterval: null,
  slackReplyCount: 0,
  bsodMode: 'win',
  bsodActive: false,
  bsodCountVal: 0,
  zoomFilterActive: false,
  zoomInterval: null,
  zoomFpsInterval: null,
  nodCount: 0,
  zoomStartTime: null,
  zoomUptimeInterval: null,
  analyticsChart: null,
  animFrameId: null,
  saboScore: 847,
  macDotInterval: null,
};

// ===================== TAB SWITCHING =====================
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tabName).classList.add('active');
  document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');
  state.currentTab = tabName;
  if (tabName === 'analytics') initAnalyticsChart();
  if (tabName === 'zoom') initZoomCanvas();
  if (tabName === 'bsod') updateBSODPreview();
}

// ===================== SLIDER HELPER =====================
function updateSlider(id, valId) {
  const val = document.getElementById(id).value;
  document.getElementById(valId).textContent = val;
}

// ===================== TYPING SIMULATOR =====================
function selectSoundType(type, el) {
  document.querySelectorAll('#tab-typing .sound-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  el.closest('.card').dataset.soundType = type;
}

let typingAudioCtx = null;

function getTypingAudioCtx() {
  if (!typingAudioCtx) {
    typingAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return typingAudioCtx;
}

function playKeyClick(type) {
  try {
    const ctx = getTypingAudioCtx();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const data = buf.getChannelData(0);
    const vol = parseFloat(document.getElementById('typing-vol').value) / 10;
    const enterFreq = parseInt(document.getElementById('enter-freq').value);

    let isEnter = Math.random() < (enterFreq / 100);

    for (let i = 0; i < data.length; i++) {
      let t = i / ctx.sampleRate;
      let env = Math.exp(-t * (isEnter ? 20 : 40));
      let freq = type === 'blue' ? 800 : type === 'hhkb' ? 600 : 500;
      if (isEnter) freq *= 0.7;
      data[i] = env * vol * (Math.random() * 2 - 1) * (isEnter ? 1.5 : 0.8);
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const gainNode = ctx.createGain();
    gainNode.gain.value = vol;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = type === 'blue' ? 3000 : type === 'hhkb' ? 2000 : 1500;
    filter.Q.value = 1;

    src.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    src.start();
  } catch(e) {}
}

function playSigh() {
  try {
    const ctx = getTypingAudioCtx();
    const duration = 1.5;
    const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      let t = i / ctx.sampleRate;
      let env = Math.sin(Math.PI * t / duration) * Math.exp(-t * 1.5);
      data[i] = env * 0.15 * (Math.random() * 2 - 1);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = parseFloat(document.getElementById('typing-vol').value) / 10;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    showStatus('💨 ため息：「はぁ…マジかよ…」');
  } catch(e) {}
}

function toggleTyping() {
  const btn = document.getElementById('typing-btn');
  state.typingActive = !state.typingActive;

  if (state.typingActive) {
    btn.textContent = '⏹ 停止';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-danger');
    showStatus('⌨ タイピングシミュレーター稼働中...');
    startTypingLoop();
    updateSaboScore(5);
  } else {
    btn.textContent = '▶ 開始';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-primary');
    clearInterval(state.typingInterval);
    showStatus('⌨ タイピングシミュレーター停止');
  }
}

function startTypingLoop() {
  const activeSoundBtn = document.querySelector('#tab-typing .sound-btn.active');
  const soundType = activeSoundBtn ? activeSoundBtn.dataset.type || 'blue' : 'blue';

  let sighTimer = 0;
  const sighInterval = 180000; // 3 min

  state.typingInterval = setInterval(() => {
    if (!state.typingActive) return;

    const speed = parseInt(document.getElementById('typing-speed').value);
    const clicks = Math.floor(Math.random() * speed) + 1;

    for (let i = 0; i < clicks; i++) {
      setTimeout(() => playKeyClick(soundType), i * (100 / clicks));
    }

    sighTimer += 300;
    if (sighTimer >= sighInterval) {
      sighTimer = 0;
      playSigh();
    }

    document.getElementById('keystroke-count').textContent =
      parseInt(document.getElementById('keystroke-count').textContent) + clicks;
  }, 300);
}

// ===================== SLACK BOT =====================
const slackReplies = [
  { weight: 1, text: 'なるほど、アグリーです。一旦持ち帰ってシナジー確認します 🙏' },
  { weight: 2, text: '本質的なイシューはそこではない気がしています。追って壁打ちさせてください 💡' },
  { weight: 3, text: '通信環境が極めて悪いため、テキストでROMります 📡' },
];

const slackMentions = [
  { name: '田中部長', emoji: '👔', text: '昨日の件、進捗どうなってますか？', time: () => getNow() },
  { name: '鈴木PM', emoji: '📋', text: '例のタスク、本日中にお願いできますか？', time: () => getNow() },
  { name: '山田さん', emoji: '💻', text: 'ちょっと今お時間ありますか？', time: () => getNow() },
  { name: '人事部', emoji: '📊', text: '月次レポートの提出期限、本日です！', time: () => getNow() },
];

function getNow() {
  const now = new Date();
  return `本日 ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

function getWeightedReply() {
  const w1 = parseInt(document.getElementById('w1').value);
  const w2 = parseInt(document.getElementById('w2').value);
  const w3 = parseInt(document.getElementById('w3').value);
  const total = w1 + w2 + w3;
  const rand = Math.random() * total;
  if (rand < w1) return slackReplies[0].text;
  if (rand < w1 + w2) return slackReplies[1].text;
  return slackReplies[2].text;
}

function triggerSl
ackMention() {
  const mention = slackMentions[Math.floor(Math.random() * slackMentions.length)];
  const feed = document.getElementById('slack-feed');
  const delay = Math.floor(Math.random() * (8 - 3 + 1) + 3);

  const msgEl = document.createElement('div');
  msgEl.className = 'slack-msg incoming';
  msgEl.innerHTML = `
    <span class="slack-avatar">${mention.emoji}</span>
    <div class="slack-bubble">
      <div class="slack-name">${mention.name} <span class="slack-time">${mention.time()}</span></div>
      <div class="slack-text">${mention.text}</div>
    </div>`;
  feed.appendChild(msgEl);
  feed.scrollTop = feed.scrollHeight;

  showStatus(`📨 ${mention.name}からメンション受信。${delay}分後に自動返信予定...`);
  updateSaboScore(3);

  setTimeout(() => {
    const reply = getWeightedReply();
    const replyEl = document.createElement('div');
    replyEl.className = 'slack-msg outgoing';
    replyEl.innerHTML = `
      <div class="slack-bubble outgoing-bubble">
        <div class="slack-name">あなた <span class="slack-time">${getNow()} ✅ 自動返信</span></div>
        <div class="slack-text">${reply}</div>
      </div>
      <span class="slack-avatar">🧑‍💻</span>`;
    feed.appendChild(replyEl);
    feed.scrollTop = feed.scrollHeight;
    showStatus(`✅ Synergy-AI が自動返信しました！`);
    updateSaboScore(5);

    document.getElementById('auto-reply-count').textContent =
      parseInt(document.getElementById('auto-reply-count').textContent) + 1;
  }, delay * 1000);
}

function startSlackBot() {
  const btn = document.getElementById('slack-btn');
  state.slackActive = !state.slackActive;

  if (state.slackActive) {
    btn.textContent = '⏹ Bot停止';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-danger');
    showStatus('🤖 Synergy-AI 起動中...');
    state.slackInterval = setInterval(triggerSlackMention, 15000);
    triggerSlackMention();
  } else {
    btn.textContent = '🤖 Bot起動';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-primary');
    clearInterval(state.slackInterval);
    showStatus('🤖 Synergy-AI 停止');
  }
}

// ===================== BSOD =====================
function showBSOD() {
  const os = document.getElementById('bsod-os').value;
  const overlay = document.getElementById('bsod-overlay');
  const content = document.getElementById('bsod-content');

  state.bsodActive = true;
  overlay.style.display = 'flex';

  if (os === 'windows') {
    content.innerHTML = `
      <div class="bsod-win">
        <div class="bsod-emoji">:(</div>
        <h2>PCの問題が発生したため、再起動が必要です。</h2>
        <div class="bsod-progress-wrap">
          <p>問題についての情報を収集しています: <span id="bsod-pct">0</span>% 完了</p>
          <div class="bsod-bar-outer"><div class="bsod-bar-inner" id="bsod-bar"></div></div>
        </div>
        <p style="margin-top:32px;font-size:0.85rem;">エラーコード: SABORO_SYSTEM_EXCEPTION_0x000000SA</p>
        <p style="font-size:0.8rem;opacity:0.7;">詳細については、次のWebサイトにアクセスしてください: <u>https://saborrhythm.cloud/bsod</u></p>
      </div>`;
  } else {
    content.innerHTML = `
      <div class="bsod-mac">
        <div class="bsod-mac-icon">💻</div>
        <p>再起動するには、電源ボタンを押し続けてください。</p>
        <p>Redémarrez en maintenant le bouton d'alimentation.</p>
        <p>Halten Sie den Einschaltknopf gedrückt um den Computer neu zu starten.</p>
        <p>Tenere premuto il pulsante di accensione per riavviare il computer.</p>
        <p style="margin-top:24px;font-size:0.75rem;opacity:0.6;">Kernel Panic: CPU 0 caller 0xffffff80 0x0000SABO: Saborhythm kernel trap</p>
      </div>`;
  }

  updateSaboScore(10);
  showStatus('🚨 緊急回避発動！偽BSOD表示中...');
  startBSODProgress();

  const duration = parseInt(document.getElementById('bsod-duration').value);
  state.bsodTimeout = setTimeout(hideBSOD, duration * 60000);
}

function startBSODProgress() {
  let pct = 0;
  const pctEl = document.getElementById('bsod-pct');
  const barEl = document.getElementById('bsod-bar');
  if (!pctEl) return;

  state.bsodProgress = setInterval(() => {
    if (pct < 89) {
      pct += Math.random() * 2;
      if (pct > 89) pct = 89;
      if (pctEl) pctEl.textContent = Math.floor(pct);
      if (barEl) barEl.style.width = pct + '%';
    }
  }, 500);
}

function hideBSOD() {
  document.getElementById('bsod-overlay').style.display = 'none';
  state.bsodActive = false;
  clearTimeout(state.bsodTimeout);
  clearInterval(state.bsodProgress);
  showStatus('✅ BSOD解除。お疲れ様でした（サボり成功）');
  document.getElementById('bsod-count').textContent =
    parseInt(document.getElementById('bsod-count').textContent) + 1;
}

// ===================== ZOOM FILTER =====================
let faceDetectInterval = null;
let canvas2dCtx = null;

function startZoomFilter() {
  const btn = document.getElementById('zoom-btn');
  state.zoomActive = !state.zoomActive;

  if (state.zoomActive) {
    btn.textContent = '⏹ フィルター停止';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-danger');
    initZoomFilter();
    showStatus('👁 死んだ魚の目フィルター稼働中...');
    updateSaboScore(8);
  } else {
    btn.textContent = '🎥 フィルター起動';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-primary');
    stopZoomFilter();
    showStatus('👁 Zoomフィルター停止');
  }
}

function initZoomFilter() {
  const video = document.getElementById('zoom-video');
  const canvas = document.getElementById('zoom-canvas');
  canvas2dCtx = canvas.getContext('2d');

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        video.srcObject = stream;
        video.play();
        state.zoomStream = stream;
        startFaceRender(video, canvas, canvas2dCtx);
      })
      .catch(() => {
        startDemoFaceRender(canvas, canvas2dCtx);
      });
  } else {
    startDemoFaceRender(canvas, canvas2dCtx);
  }
  startNodMacro();
}

function startFaceRender(video, canvas, ctx) {
  faceDetectInterval = setInterval(() => {
    if (!state.zoomActive) return;
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    drawFakeEyes(ctx, canvas.width, canvas.height);
  }, 100);
}

function startDemoFaceRender(canvas, ctx) {
  canvas.width = 320;
  canvas.height = 240;
  faceDetectInterval = setInterval(() => {
    if (!state.zoomActive) return;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 320, 240);
    // Draw simple face silhouette
    ctx.fillStyle = '#f5cba7';
    ctx.beginPath();
    ctx.ellipse(160, 110, 65, 80, 0, 0, Math.PI * 2);
    ctx.fill();
    drawFakeEyes(ctx, 320, 240);
    // Demo label
    ctx.fillStyle = 'rgba(0,255,128,0.7)';
    ctx.font = '11px monospace';
    ctx.fillText('📷 カメラなし: デモモード', 10, 230);
  }, 100);
}

function drawFakeEyes(ctx, w, h) {
  const leftX = w * 0.38, rightX = w * 0.62, eyeY = h * 0.42;
  const eyeR = w * 0.055;

  // White of eyes
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(leftX, eyeY, eyeR, eyeR * 0.72, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(rightX, eyeY, eyeR, eyeR * 0.72, 0, 0, Math.PI * 2); ctx.fill();

  // Iris - slightly bloodshot look
  const irisR = eyeR * 0.62;
  ctx.fillStyle = '#3d2b1f';
  ctx.beginPath(); ctx.arc(leftX, eyeY, irisR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(rightX, eyeY, irisR, 0, Math.PI * 2); ctx.fill();

  // Pupil
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(leftX, eyeY, irisR * 0.45, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(rightX, eyeY, irisR * 0.45, 0, Math.PI * 2); ctx.fill();

  // Bloodshot lines
  ctx.strokeStyle = 'rgba(220,50,50,0.5)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI * 2 / 4) * i + Math.random() * 0.3;
    ctx.beginPath();
    ctx.moveTo(leftX + Math.cos(angle) * irisR, eyeY + Math.sin(angle) * irisR * 0.7);
    ctx.lineTo(leftX + Math.cos(angle) * eyeR * 0.9, eyeY + Math.sin(angle) * eyeR * 0.65);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rightX + Math.cos(angle) * irisR, eyeY + Math.sin(angle) * irisR * 0.7);
    ctx.lineTo(rightX + Math.cos(angle) * eyeR * 0.9, eyeY + Math.sin(angle) * eyeR * 0.65);
    ctx.stroke();
  }

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath(); ctx.arc(leftX - irisR * 0.25, eyeY - irisR * 0.3, irisR * 0.18, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(rightX - irisR * 0.25, eyeY - irisR * 0.3, irisR * 0.18, 0, Math.PI * 2); ctx.fill();

  // AR label
  ctx.fillStyle = 'rgba(0,255,128,0.8)';
  ctx.font = `${Math.max(10, w * 0.035)}px monospace`;
  ctx.fillText('👁 AR: 真剣モード ON', w * 0.03, h * 0.95);
}

function startNodMacro() {
  state.nodInterval = setInterval(() => {
    if (!state.zoomActive) return;
    const avatar = document.getElementById('zoom-avatar');
    avatar.style.transform = 'translateY(8px)';
    setTimeout(() => { avatar.style.transform = 'translateY(0)'; }, 400);
    setTimeout(() => { avatar.style.transform = 'translateY(5px)'; }, 700);
    setTimeout(() => { avatar.style.transform = 'translateY(0)'; }, 1000);
    document.getElementById('nod-count').textContent =
      parseInt(document.getElementById('nod-count').textContent) + 1;
    showStatus('🤝 うなずきマクロ実行中...');
  }, 15000);
}

function stopZoomFilter() {
  clearInterval(faceDetectInterval);
  clearInterval(state.nodInterval);
  if (state.zoomStream) {
    state.zoomStream.getTracks().forEach(t => t.stop());
    state.zoomStream = null;
  }
  const canvas = document.getElementById('zoom-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ===================== GRAPH ANIMATION =====================
function initGraph() {
  const canvas = document.getElementById('graph-canvas');
  const ctx = canvas.getContext('2d');
  let offset = 0;
  let dataPoints = Array.from({length: 80}, () => Math.random() * 60 + 20);

  function drawGraph() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const w = canvas.width, h = canvas.height;

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'rgba(0,255,128,0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Multiple data series
    const colors = ['#00ff80', '#ff6b35', '#4ecdc4', '#ffe66d', '#a29bfe'];
    const phases = [0, 0.5, 1.2, 2.1, 3.0];

    colors.forEach((color, ci) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = ci === 0 ? 2 : 1;
      ctx.globalAlpha = ci === 0 ? 0.9 : 0.4;
      for (let i = 0; i < w; i++) {
        const idx = (i + offset) % dataPoints.length;
        const noise = Math.sin((i + offset * 0.5 + phases[ci]) * 0.08) * 20
          + Math.sin((i + offset * 0.3 + phases[ci]) * 0.2) * 10
          + (dataPoints[idx % dataPoints.length] - 50) * 0.4;
        const y = h * 0.5 - noise;
        if (i === 0) ctx.moveTo(i, y);
        else ctx.lineTo(i, y);
      }
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // Labels
    ctx.fillStyle = 'rgba(0,255,128,0.6)';
    ctx.font = '10px monospace';
    ctx.fillText('SYNERGY INDEX', 8, 16);
    ctx.fillStyle = 'rgba(255,107,53,0.6)';
    ctx.fillText('SABO EFFICIENCY', 8, 30);
    ctx.fillStyle = 'rgba(78,205,196,0.6)';
    ctx.fillText('STAKEHOLDER MGMT', 8, 44);

    ctx.fillStyle = 'rgba(0,255,128,0.4)';
    ctx.font = '9px monospace';
    ctx.fillText(`LIVE | ${new Date().toLocaleTimeString('ja-JP')}`, w - 100, 14);

    offset = (offset + 1) % dataPoints.length;
    dataPoints.push(Math.random() * 60 + 20);
    if (dataPoints.length > 200) dataPoints.shift();
  }

  state.graphInterval = setInterval(drawGraph, 50);
  drawGraph();
}

// ===================== KEYBOARD SHORTCUT =====================
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.altKey && e.shiftKey && e.key === 'S') {
    e.preventDefault();
    showBSOD();
  }
});

// ===================== SABOT SCORE =====================
function updateSaboScore(pts) {
  state.saboScore += pts;
  document.getElementById('sabo-score').textContent = state.saboScore;
  updateSaboRank();
}

function updateSaboRank() {
  const s = state.saboScore;
  let rank = '', color = '';
  if (s < 20)       { rank = '🥚 ひよっこサボリスト';   color = '#aaa'; }
  else if (s < 60)  { rank = '🐥 見習いサボリスト';      color = '#ffe66d'; }
  else if (s < 120) { rank = '🦊 中級サボリスト';        color = '#ff6b35'; }
  else if (s < 200) { rank = '🦁 上級サボリスト';        color = '#4ecdc4'; }
  else if (s < 300) { rank = '🐉 エキスパートサボリスト'; color = '#a29bfe'; }
  else              { rank = '👑 神話級サボリスト';       color = '#ffd700'; }

  const el = document.getElementById('sabo-rank');
  el.textContent = rank;
  el.style.color = color;
}

// ===================== STATUS =====================
function showStatus(msg) {
  const el = document.getElementById('status-msg');
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(state.statusTimeout);
  state.statusTimeout = setTimeout(() => {
    el.style.opacity = '0.5';
  }, 3000);
}

// ===================== INIT =====================
window.addEventListener('load', () => {
  initAudio();
  initGraph();
  updateSaboRank();

  // Sound type buttons
  document.querySelectorAll('.sound-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.sound-options').querySelectorAll('.sound-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // Enter frequency slider label
  const enterSlider = document.getElementById('enter-freq');
  if (enterSlider) {
    enterSlider.addEventListener('input', () => {
      document.getElementById('enter-freq-val').textContent = enterSlider.value;
    });
  }

  // Volume slider label
  const volSlider = document.getElementById('typing-vol');
  if (volSlider) {
    volSlider.addEventListener('input', () => {
      document.getElementById('vol-val').textContent = volSlider.value;
    });
  }

  // Speed slider label
  const speedSlider = document.getElementById('typing-speed');
  if (speedSlider) {
    speedSlider.addEventListener('input', () => {
      document.getElementById('speed-val').textContent = speedSlider.value;
    });
  }

  // Clock
  setInterval(() => {
    const now = new Date();
    document.getElementById('clock').textContent =
      now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, 1000);

  showStatus('🚀 サボリズム Cloud 起動完了。本日も最高のサボりを。');
});