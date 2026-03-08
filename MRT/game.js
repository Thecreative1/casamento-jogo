const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const ovosEl = document.getElementById("coins");
const vidasEl = document.getElementById("lives");
const mensagemEl = document.getElementById("message");

const tile = 48;
const gravity = 0.56;
const maxFall = 11.5;
const worldWidth = 5600;
const coyoteFrames = 7;
const jumpBufferFrames = 7;
const historicStart = 2140;
const historicEnd = 3560;

const keys = { left: false, right: false, jump: false };
const activePointers = { left: new Set(), right: new Set(), jump: new Set() };
const audio = {
  ctx: null,
  master: null,
  engineOsc: null,
  engineGain: null,
  muted: false,
  started: false
};

function rectsIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function grad(x1, y1, x2, y2, c1, c2) {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  return g;
}

function ensureAudio() {
  if (audio.started) {
    if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume();
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audio.ctx = new Ctx();
  audio.master = audio.ctx.createGain();
  audio.master.gain.value = 0.6;
  audio.master.connect(audio.ctx.destination);

  audio.engineOsc = audio.ctx.createOscillator();
  audio.engineGain = audio.ctx.createGain();
  audio.engineOsc.type = "sawtooth";
  audio.engineOsc.frequency.value = 80;
  audio.engineGain.gain.value = 0.0001;
  audio.engineOsc.connect(audio.engineGain);
  audio.engineGain.connect(audio.master);
  audio.engineOsc.start();

  audio.started = true;
}

function setMuted(nextMuted) {
  audio.muted = nextMuted;
  if (!audio.started) return;
  const now = audio.ctx.currentTime;
  audio.master.gain.cancelScheduledValues(now);
  audio.master.gain.linearRampToValueAtTime(audio.muted ? 0 : 0.6, now + 0.03);
}

function beep(freq, dur, type, vol, endFreq) {
  if (!audio.started || audio.muted) return;
  const now = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (typeof endFreq === "number") osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(vol, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

function sfxSalto() {
  beep(220, 0.11, "square", 0.08, 360);
}

function sfxOvo() {
  beep(680, 0.06, "triangle", 0.06, 940);
}

function sfxDano() {
  beep(190, 0.18, "sawtooth", 0.09, 90);
}

function sfxVitoria() {
  beep(520, 0.09, "triangle", 0.06, 700);
  beep(700, 0.11, "triangle", 0.06, 980);
}

function sfxExplosao() {
  beep(170, 0.18, "sawtooth", 0.14, 70);
  beep(420, 0.12, "square", 0.08, 160);
}

function sfxSquish() {
  beep(240, 0.06, "square", 0.09, 130);
  beep(130, 0.07, "triangle", 0.06, 90);
}

function updateEngineSound() {
  if (!audio.started || audio.muted) return;
  const speed = Math.abs(player.vx);
  const active = gameState === "playing" && player.onGround && speed > 0.15;
  const targetGain = active ? Math.min(0.05 + speed * 0.013, 0.14) : 0.0001;
  const targetFreq = 78 + speed * 26;
  const now = audio.ctx.currentTime;
  audio.engineGain.gain.setTargetAtTime(targetGain, now, 0.04);
  audio.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.06);
}

function buildLevel() {
  const grounds = [{ x: 0, y: 468, w: worldWidth, h: 72 }];

  const blocks = [
    { x: 360, y: 380, w: tile * 2, h: tile / 2 },
    { x: 680, y: 330, w: tile * 2, h: tile / 2 },
    { x: 1050, y: 300, w: tile * 2, h: tile / 2 },
    { x: 1560, y: 340, w: tile * 3, h: tile / 2 },
    { x: 2160, y: 300, w: tile * 2, h: tile / 2 },
    { x: 2660, y: 360, w: tile * 3, h: tile / 2 },
    { x: 3300, y: 320, w: tile * 2, h: tile / 2 },
    { x: 3700, y: 350, w: Math.round(tile * 1.35), h: tile / 2 },
    { x: 3920, y: 280, w: tile * 2, h: tile / 2 },
    { x: 4500, y: 340, w: tile * 3, h: tile / 2 }
  ];

  const ovos = [];
  const ovosPos = [
    [410, 330], [460, 330], [720, 280], [770, 280], [1110, 250], [1160, 250],
    [1620, 290], [1670, 290], [1720, 290], [2220, 250], [2270, 250],
    [2730, 310], [2780, 310], [2830, 310], [3360, 270], [3410, 270],
    [3980, 230], [4030, 230], [4560, 290], [4610, 290], [4660, 290]
  ];
  for (const [x, y] of ovosPos) ovos.push({ x, y, w: 24, h: 30, taken: false });

  const inimigos = [
    { x: 860, y: 432, w: 38, h: 36, vx: -1.2, minX: 760, maxX: 1040, alive: true },
    { x: 1820, y: 432, w: 38, h: 36, vx: 1.4, minX: 1660, maxX: 2000, alive: true },
    { x: 3060, y: 432, w: 38, h: 36, vx: -1.6, minX: 2860, maxX: 3240, alive: true },
    { x: 4320, y: 432, w: 38, h: 36, vx: 1.5, minX: 4140, maxX: 4480, alive: true }
  ];

  const objetivo = { x: 5280, y: 280, w: 46, h: 188 };
  const perigos = [
    { x: 1380, y: 456, w: 96, h: 12 },
    { x: 3860, y: 456, w: 96, h: 12 }
  ];

  return { grounds, blocks, ovos, inimigos, objetivo, perigos };
}

function createPlayer() {
  return {
    x: 80,
    y: 360,
    w: 56,
    h: 46,
    vx: 0,
    vy: 0,
    speed: 3.9,
    jump: -12.2,
    onGround: false,
    facing: 1,
    vidas: 3,
    ovos: 0,
    coyoteTimer: 0,
    jumpBufferTimer: 0
  };
}

let level = buildLevel();
let player = createPlayer();
let cameraX = 0;
let gameState = "playing";
let tick = 0;
let explosao = null;

function reset(total) {
  if (total) {
    level = buildLevel();
    player = createPlayer();
  } else {
    player.x = Math.max(60, player.x - 250);
    player.y = 360;
    player.vx = 0;
    player.vy = 0;
  }
  cameraX = Math.max(0, player.x - 260);
  gameState = "playing";
  explosao = null;
  mensagemEl.textContent = "";
}

function iniciarExplosao(causa, isGameOver) {
  explosao = {
    x: player.x + player.w / 2,
    y: player.y + player.h / 2,
    frame: 0,
    duracao: 78,
    causa,
    isGameOver
  };
  gameState = "dying";
  sfxExplosao();
}

function perderVida(causa = "normal") {
  if (gameState !== "playing") return;
  player.vidas -= 1;
  sfxDano();
  const isGameOver = player.vidas <= 0;

  if (causa === "explosao") {
    iniciarExplosao(causa, isGameOver);
    return;
  }

  if (isGameOver) {
    gameState = "lost";
    mensagemEl.textContent = "Fim de jogo. Pressiona R para recomecar.";
  } else {
    mensagemEl.textContent = "Bateste! Tenta de novo.";
    reset(false);
  }
}

function applyMovement() {
  const direction = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const isGround = player.onGround;
  const accel = isGround ? 0.62 : 0.32;
  const friction = isGround ? 0.76 : 0.95;

  if (direction !== 0) {
    player.vx += direction * accel;
    player.vx = Math.max(-player.speed, Math.min(player.speed, player.vx));
  } else {
    player.vx *= friction;
  }

  if (Math.abs(player.vx) < 0.08) player.vx = 0;
  if (player.vx > 0) player.facing = 1;
  if (player.vx < 0) player.facing = -1;

  if (player.jumpBufferTimer > 0) player.jumpBufferTimer -= 1;
  if (player.onGround) player.coyoteTimer = coyoteFrames;
  else if (player.coyoteTimer > 0) player.coyoteTimer -= 1;

  if (player.jumpBufferTimer > 0 && player.coyoteTimer > 0) {
    player.vy = player.jump;
    player.onGround = false;
    player.jumpBufferTimer = 0;
    player.coyoteTimer = 0;
    sfxSalto();
  }

  let frameGravity = gravity;
  if (player.vy < 0 && keys.jump) frameGravity = 0.4;
  if (Math.abs(player.vy) < 1.15) frameGravity *= 0.72;
  if (player.vy < 0 && !keys.jump) player.vy += 0.38;
  player.vy = Math.min(player.vy + frameGravity, maxFall);
}

function collideAxisX(solids) {
  player.x += player.vx;
  for (const s of solids) {
    if (!rectsIntersect(player, s)) continue;
    if (player.vx > 0) player.x = s.x - player.w;
    if (player.vx < 0) player.x = s.x + s.w;
    player.vx = 0;
  }
}

function collideAxisY(solids) {
  player.y += player.vy;
  player.onGround = false;
  for (const s of solids) {
    if (!rectsIntersect(player, s)) continue;
    if (player.vy > 0) {
      player.y = s.y - player.h;
      player.vy = 0;
      player.onGround = true;
    } else if (player.vy < 0) {
      player.y = s.y + s.h;
      player.vy = 0;
    }
  }
}

function update() {
  if (gameState === "dying") {
    explosao.frame += 1;
    if (explosao.frame >= explosao.duracao) {
      if (explosao.isGameOver) {
        gameState = "lost";
        mensagemEl.textContent = "Fim de jogo. Pressiona R para recomecar.";
      } else {
        reset(false);
        mensagemEl.textContent = "BOOM! Tenta outra vez.";
      }
    }
    return;
  }

  if (gameState !== "playing") return;
  tick += 1;

  applyMovement();
  const solids = [...level.grounds, ...level.blocks];
  collideAxisX(solids);
  collideAxisY(solids);

  if (player.y > canvas.height + 140) perderVida();

  for (const p of level.perigos) if (rectsIntersect(player, p)) perderVida("explosao");

  for (const ovo of level.ovos) {
    if (!ovo.taken && rectsIntersect(player, ovo)) {
      ovo.taken = true;
      player.ovos += 1;
      sfxOvo();
    }
  }

  for (const inimigo of level.inimigos) {
    if (!inimigo.alive) continue;
    inimigo.x += inimigo.vx;
    if (inimigo.x < inimigo.minX || inimigo.x + inimigo.w > inimigo.maxX) inimigo.vx *= -1;

    if (rectsIntersect(player, inimigo)) {
      const porCima = player.vy > 0 && player.y + player.h - inimigo.y < 18;
      if (porCima) {
        inimigo.alive = false;
        player.vy = -8;
        sfxSquish();
      } else {
        perderVida("explosao");
      }
    }
  }

  if (rectsIntersect(player, level.objetivo)) {
    gameState = "won";
    mensagemEl.textContent = "Vitoria! Missao concluida.";
    sfxVitoria();
  }

  player.x = Math.max(0, Math.min(player.x, worldWidth - player.w));
  cameraX = Math.max(0, Math.min(player.x - canvas.width * 0.36, worldWidth - canvas.width));
}

function drawBackground() {
  ctx.fillStyle = grad(0, 0, 0, canvas.height, "#cfe5f2", "#f9fcff");
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Haze layer to push monuments into the distance.
  ctx.fillStyle = "#ffffff40";
  ctx.fillRect(0, 160, canvas.width, 230);

  const penhaBaseX = 210 - cameraX * 0.1;
  const penhaBaseY = 378;
  ctx.fillStyle = grad(0, 220, 0, penhaBaseY, "#a5b696", "#829572");
  ctx.beginPath();
  ctx.moveTo(penhaBaseX - 460, penhaBaseY);
  ctx.quadraticCurveTo(penhaBaseX - 260, 250, penhaBaseX - 70, penhaBaseY);
  ctx.quadraticCurveTo(penhaBaseX + 80, 218, penhaBaseX + 258, penhaBaseY);
  ctx.quadraticCurveTo(penhaBaseX + 430, 276, penhaBaseX + 590, penhaBaseY);
  ctx.lineTo(penhaBaseX - 380, penhaBaseY);
  ctx.fill();
  drawPenhaSantuarios(penhaBaseX - cameraX * 0.03, penhaBaseY - 58);
  drawTelefericoPenha(penhaBaseX);

  for (let i = 0; i < 8; i += 1) {
    const baseX = ((i * 300 - cameraX * 0.18) % (canvas.width + 520)) - 230;
    ctx.fillStyle = "#96aa83";
    ctx.beginPath();
    ctx.moveTo(baseX, 382);
    ctx.lineTo(baseX + 150, 258);
    ctx.lineTo(baseX + 300, 382);
    ctx.closePath();
    ctx.fill();
  }

  drawPerfilCidade();
  drawCasteloGuimaraes();
  drawPacoDosDuques();

  for (let i = 0; i < 10; i += 1) {
    const x = ((i * 230 - cameraX * 0.42) % (canvas.width + 300)) - 90;
    const y = 70 + (i % 3) * 28;
    ctx.fillStyle = "#ffffffcc";
    ctx.beginPath();
    ctx.roundRect(x, y, 96, 26, 14);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(x + 24, y - 12, 48, 22, 11);
    ctx.fill();
  }
}

function drawPenhaSantuarios(x, y) {
  ctx.fillStyle = "#6f756c";
  ctx.fillRect(x - 18, y, 58, 22);
  ctx.fillRect(x + 2, y - 20, 18, 20);
  ctx.fillRect(x + 26, y - 14, 11, 14);
  ctx.fillStyle = "#5f665c";
  ctx.fillRect(x + 8, y - 30, 5, 10);
  ctx.fillRect(x + 31, y - 24, 4, 10);
}

function drawTelefericoPenha(penhaBaseX) {
  const cityX = -30 - cameraX * 0.2;
  const cityY = 365;
  const mountX = penhaBaseX + 212;
  const mountY = 258;

  ctx.strokeStyle = "#56605a";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cityX, cityY);
  ctx.lineTo(mountX, mountY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cityX, cityY + 7);
  ctx.lineTo(mountX, mountY + 7);
  ctx.stroke();

  const towers = [0.26, 0.52, 0.78];
  for (const t of towers) {
    const tx = cityX + (mountX - cityX) * t;
    const ty = cityY + (mountY - cityY) * t + 8;
    ctx.fillStyle = "#6c756f";
    ctx.fillRect(tx - 3, ty - 32, 6, 34);
    ctx.strokeStyle = "#4f5752";
    ctx.strokeRect(tx - 3, ty - 32, 6, 34);
  }

  ctx.fillStyle = "#7f887f";
  ctx.fillRect(cityX - 24, cityY - 8, 22, 14);
  ctx.fillRect(mountX + 2, mountY - 9, 22, 14);

  const t1 = (Math.sin(tick * 0.007) + 1) * 0.5;
  const t2 = (t1 + 0.45) % 1;
  drawCabinaTeleferico(cityX, cityY, mountX, mountY, t1);
  drawCabinaTeleferico(cityX, cityY + 7, mountX, mountY + 7, t2);
}

function drawPerfilCidade() {
  const baseY = 412;
  const startX = -120 - cameraX * 0.3;
  for (let i = 0; i < 15; i += 1) {
    const x = startX + i * 92;
    const subida = Math.max(0, i - 6) * 6;
    const h = 36 + (i % 4) * 8 + subida;
    ctx.fillStyle = "#8a8a85";
    ctx.fillRect(x, baseY - h, 74, h);
    if (i % 3 === 1) {
      ctx.fillStyle = "#6c6b65";
      ctx.beginPath();
      ctx.moveTo(x + 8, baseY - h);
      ctx.lineTo(x + 20, baseY - h - 18);
      ctx.lineTo(x + 32, baseY - h);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawCabinaTeleferico(x1, y1, x2, y2, t) {
  const cx = x1 + (x2 - x1) * t;
  const cy = y1 + (y2 - y1) * t;
  ctx.fillStyle = "#8b938a";
  ctx.fillRect(cx - 10, cy - 6, 20, 12);
  ctx.strokeStyle = "#4b504b";
  ctx.strokeRect(cx - 10, cy - 6, 20, 12);
  ctx.beginPath();
  ctx.moveTo(cx, cy - 6);
  ctx.lineTo(cx, cy - 11);
  ctx.stroke();
}

function drawCasteloGuimaraes() {
  const x = 628 - cameraX * 0.24;
  const y = 300;
  ctx.fillStyle = grad(x, y - 40, x, y + 84, "#888b83", "#666962");
  ctx.fillRect(x, y, 198, 84);
  ctx.strokeStyle = "#60625c";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, 198, 84);

  const torres = [0, 42, 86, 130, 170];
  for (const t of torres) {
    const tw = t === 170 ? 28 : 31;
    ctx.fillStyle = "#767a73";
    ctx.fillRect(x + t, y - 40, tw, 124);
    ctx.strokeRect(x + t, y - 40, tw, 124);
    for (let c = 0; c < 4; c += 1) {
      const cx = x + t + c * 8 + 1;
      ctx.beginPath();
      ctx.moveTo(cx, y - 40);
      ctx.lineTo(cx + 4, y - 50);
      ctx.lineTo(cx + 8, y - 40);
      ctx.closePath();
      ctx.fillStyle = "#6a6d66";
      ctx.fill();
    }
  }

  ctx.fillStyle = "#50524d";
  ctx.fillRect(x + 89, y + 38, 24, 46);

  // Fore wall for a more recognizable fortress profile.
  ctx.fillStyle = "#636760";
  ctx.fillRect(x - 22, y + 24, 42, 60);
  ctx.strokeRect(x - 22, y + 24, 42, 60);
}

function drawPacoDosDuques() {
  const x = 326 - cameraX * 0.2;
  const y = 312;
  ctx.fillStyle = grad(x, y, x, y + 84, "#c1b59f", "#a4937d");
  ctx.fillRect(x, y, 238, 84);
  ctx.strokeStyle = "#8d816f";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, 238, 84);

  for (let i = 0; i < 6; i += 1) {
    ctx.fillStyle = "#8b6a48";
    ctx.beginPath();
    ctx.moveTo(x + 16 + i * 37, y);
    ctx.lineTo(x + 30 + i * 37, y - 34);
    ctx.lineTo(x + 44 + i * 37, y);
    ctx.closePath();
    ctx.fill();
  }

  // Iconic conic chimneys inspired by Paco dos Duques.
  for (let c = 0; c < 4; c += 1) {
    const cx = x + 34 + c * 52;
    ctx.fillStyle = "#7b5b3f";
    ctx.beginPath();
    ctx.moveTo(cx - 10, y - 18);
    ctx.quadraticCurveTo(cx, y - 52, cx + 10, y - 18);
    ctx.lineTo(cx + 6, y);
    ctx.lineTo(cx - 6, y);
    ctx.closePath();
    ctx.fill();
  }

  for (let j = 0; j < 5; j += 1) {
    ctx.fillStyle = "#5b4f41";
    ctx.fillRect(x + 18 + j * 44, y + 28, 22, 28);
  }
}

function drawTerreno() {
  for (const g of level.grounds) {
    const x = g.x - cameraX;
    ctx.fillStyle = grad(0, g.y, 0, g.y + g.h, "#7f5a34", "#51351e");
    ctx.fillRect(x, g.y, g.w, g.h);
    ctx.fillStyle = grad(0, g.y, 0, g.y + 12, "#86a357", "#62803e");
    ctx.fillRect(x, g.y, g.w, 12);
  }

  for (const b of level.blocks) {
    const x = b.x - cameraX;
    // Granite-inspired Guimaraes jumping platforms.
    ctx.fillStyle = grad(0, b.y, 0, b.y + b.h, "#b7b8b5", "#8f918d");
    ctx.fillRect(x, b.y, b.w, b.h);
    ctx.strokeStyle = "#6f716d";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, b.y, b.w, b.h);
    for (let j = 8; j < b.w; j += 14) {
      ctx.strokeStyle = "#73757066";
      ctx.beginPath();
      ctx.moveTo(x + j, b.y + 4);
      ctx.lineTo(x + j, b.y + b.h - 4);
      ctx.stroke();
    }
    for (let k = 0; k < b.w; k += 10) {
      ctx.fillStyle = (k / 10) % 2 === 0 ? "#d4d5d2aa" : "#7f827caa";
      ctx.fillRect(x + k + 1, b.y + 2 + ((k / 10) % 3), 2, 2);
    }
  }

  for (const p of level.perigos) {
    const x = p.x - cameraX;
    ctx.fillStyle = "#7f1d1d";
    ctx.fillRect(x, p.y, p.w, p.h);
    for (let px = 0; px < p.w; px += 12) {
      ctx.beginPath();
      ctx.moveTo(x + px, p.y + p.h);
      ctx.lineTo(x + px + 6, p.y - 10);
      ctx.lineTo(x + px + 12, p.y + p.h);
      ctx.fillStyle = "#ce483a";
      ctx.fill();
    }
  }

  drawCentroHistoricoForeground();
  drawPlacasGuimaraes();
}

function drawCalcadaPortuguesa() {
  const y = 468;
  const h = 20;
  const x1 = Math.max(historicStart, cameraX - 40);
  const x2 = Math.min(historicEnd, cameraX + canvas.width + 40);
  if (x2 <= x1) return;

  ctx.fillStyle = "#d7d9d7";
  ctx.fillRect(x1 - cameraX, y, x2 - x1, h);

  for (let wx = x1; wx < x2; wx += 12) {
    for (let wy = y; wy < y + h; wy += 5) {
      const sx = wx - cameraX;
      const onda = Math.sin((wx + wy * 8) * 0.028);
      const alt = ((Math.floor(wx / 12) + Math.floor(wy / 5)) % 2) === 0;
      ctx.fillStyle = alt ? "#f4f4f2" : "#9ea39f";
      ctx.beginPath();
      ctx.moveTo(sx + 1, wy + 2.5 + onda);
      ctx.lineTo(sx + 6, wy + 1 + onda);
      ctx.lineTo(sx + 11, wy + 2.5 + onda);
      ctx.lineTo(sx + 6, wy + 4.5 + onda);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawPlacasGuimaraes() {
  const placas = [
    { x: 520, y: 392, texto: "GUIMARAES" },
    { x: 1180, y: 356, texto: "CASTELO" },
    { x: 1760, y: 386, texto: "PACO DOS DUQUES" },
    { x: 2410, y: 344, texto: "CENTRO HISTORICO" },
    { x: 3060, y: 392, texto: "BERCO DE PORTUGAL" },
    { x: 3810, y: 340, texto: "PENHA" },
    { x: 4560, y: 352, texto: "TELEFERICO" }
  ];

  for (const placa of placas) {
    const sx = placa.x - cameraX;
    if (sx < -220 || sx > canvas.width + 220) continue;

    drawTemaDaPlaca(placa.texto, sx + 74, placa.y + 16);

    ctx.fillStyle = "#6a4f35";
    ctx.fillRect(sx + 8, placa.y + 24, 6, 46);
    ctx.fillRect(sx + 134, placa.y + 24, 6, 46);

    ctx.fillStyle = "#f6efe3";
    ctx.fillRect(sx, placa.y, 148, 36);
    ctx.strokeStyle = "#5f4a36";
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, placa.y, 148, 36);
    ctx.fillStyle = "#3b2f22";
    ctx.font = "700 10px Montserrat";
    ctx.textAlign = "center";
    ctx.fillText(placa.texto, sx + 74, placa.y + 22);
  }
}

function drawTemaDaPlaca(texto, cx, cy) {
  ctx.save();
  ctx.globalAlpha = 0.55;

  if (texto === "TELEFERICO") {
    ctx.strokeStyle = "#5f6761";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 72, cy - 38);
    ctx.lineTo(cx + 72, cy - 62);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 72, cy - 31);
    ctx.lineTo(cx + 72, cy - 55);
    ctx.stroke();
    ctx.fillStyle = "#7e867f";
    ctx.fillRect(cx - 10, cy - 53, 20, 12);
  } else if (texto === "PENHA") {
    ctx.fillStyle = "#8ea17d";
    ctx.beginPath();
    ctx.moveTo(cx - 90, cy + 14);
    ctx.lineTo(cx - 24, cy - 34);
    ctx.lineTo(cx + 20, cy + 14);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy + 14);
    ctx.lineTo(cx + 44, cy - 26);
    ctx.lineTo(cx + 90, cy + 14);
    ctx.closePath();
    ctx.fill();
  } else if (texto === "CASTELO") {
    ctx.fillStyle = "#7b7e77";
    ctx.fillRect(cx - 60, cy - 34, 120, 36);
    for (let i = 0; i < 5; i += 1) ctx.fillRect(cx - 58 + i * 24, cy - 44, 14, 10);
  } else if (texto === "PACO DOS DUQUES") {
    ctx.fillStyle = "#a89a84";
    ctx.fillRect(cx - 62, cy - 28, 124, 30);
    ctx.fillStyle = "#7b5c40";
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(cx - 48 + i * 30, cy - 28);
      ctx.lineTo(cx - 38 + i * 30, cy - 48);
      ctx.lineTo(cx - 28 + i * 30, cy - 28);
      ctx.closePath();
      ctx.fill();
    }
  } else if (texto === "CENTRO HISTORICO") {
    ctx.fillStyle = "#8b8b85";
    ctx.fillRect(cx - 72, cy - 22, 40, 24);
    ctx.fillRect(cx - 24, cy - 30, 38, 32);
    ctx.fillRect(cx + 20, cy - 26, 46, 28);
  } else if (texto === "BERCO DE PORTUGAL") {
    ctx.fillStyle = "#8e918a";
    ctx.fillRect(cx - 54, cy - 34, 108, 36);
    for (let i = 0; i < 6; i += 1) ctx.fillRect(cx - 52 + i * 18, cy - 42, 10, 8);
  } else if (texto === "GUIMARAES") {
    ctx.fillStyle = "#8f8f89";
    ctx.fillRect(cx - 56, cy - 20, 112, 22);
    ctx.fillStyle = "#6d6d66";
    ctx.beginPath();
    ctx.moveTo(cx - 36, cy - 20);
    ctx.lineTo(cx - 26, cy - 34);
    ctx.lineTo(cx - 16, cy - 20);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawCentroHistoricoForeground() {
  const baseY = 468;
  const blocos = [
    { x: 2360, w: 62, h: 66, roof: "#845f3f", wall: "#c5b59a" },
    { x: 2440, w: 74, h: 78, roof: "#6f4b31", wall: "#d4c4ac" },
    { x: 2528, w: 64, h: 60, roof: "#8d6744", wall: "#bead92" },
    { x: 3340, w: 70, h: 72, roof: "#7a5538", wall: "#cabaa0" },
    { x: 3428, w: 68, h: 68, roof: "#6a4a31", wall: "#d0c1aa" }
  ];

  for (const b of blocos) {
    const sx = b.x - cameraX;
    if (sx < -180 || sx > canvas.width + 180) continue;
    const y = baseY - b.h;

    ctx.fillStyle = b.wall;
    ctx.fillRect(sx, y, b.w, b.h);
    ctx.strokeStyle = "#705c49";
    ctx.lineWidth = 1.6;
    ctx.strokeRect(sx, y, b.w, b.h);

    ctx.fillStyle = b.roof;
    ctx.beginPath();
    ctx.moveTo(sx - 6, y);
    ctx.lineTo(sx + b.w / 2, y - 20);
    ctx.lineTo(sx + b.w + 6, y);
    ctx.closePath();
    ctx.fill();

    for (let wx = 10; wx < b.w - 12; wx += 20) {
      ctx.fillStyle = "#5e4a37";
      ctx.fillRect(sx + wx, y + 18, 10, 14);
      if (b.h > 70) ctx.fillRect(sx + wx, y + 42, 10, 14);
    }
  }

  drawArcoMedieval(2620, 468);
  drawArcoMedieval(3200, 468);
  drawMuralhaPortugal(3520, 468);
  drawEstandarte(2460, 468, "#7f1d1d");
  drawEstandarte(3360, 468, "#6b3f14");
}

function drawMuralhaPortugal(worldX, groundY) {
  const sx = worldX - cameraX;
  if (sx < -260 || sx > canvas.width + 260) return;
  const y = groundY - 96;
  const w = 180;
  const h = 96;

  ctx.fillStyle = grad(sx, y, sx, y + h, "#9c9a93", "#74736c");
  ctx.fillRect(sx, y, w, h);
  ctx.strokeStyle = "#5f5e59";
  ctx.lineWidth = 2;
  ctx.strokeRect(sx, y, w, h);

  // Ameias da muralha.
  for (let i = 0; i < 9; i += 1) {
    ctx.fillStyle = "#8b8982";
    ctx.fillRect(sx + 4 + i * 20, y - 10, 12, 10);
    ctx.strokeRect(sx + 4 + i * 20, y - 10, 12, 10);
  }

  // Porta central.
  ctx.fillStyle = "#4b4a45";
  ctx.beginPath();
  ctx.moveTo(sx + 78, y + h);
  ctx.lineTo(sx + 78, y + 54);
  ctx.quadraticCurveTo(sx + 90, y + 34, sx + 102, y + 54);
  ctx.lineTo(sx + 102, y + h);
  ctx.closePath();
  ctx.fill();

  // Placa "Aqui nasceu Portugal".
  ctx.fillStyle = "#efe5d1";
  ctx.fillRect(sx + 28, y + 12, 124, 24);
  ctx.strokeStyle = "#7a6a4f";
  ctx.strokeRect(sx + 28, y + 12, 124, 24);
  ctx.fillStyle = "#3f3527";
  ctx.font = "700 9px Montserrat";
  ctx.textAlign = "center";
  ctx.fillText("AQUI NASCEU PORTUGAL", sx + 90, y + 28);
}

function drawArcoMedieval(worldX, groundY) {
  const sx = worldX - cameraX;
  if (sx < -180 || sx > canvas.width + 180) return;
  const w = 110;
  const h = 108;
  const y = groundY - h;

  ctx.fillStyle = "#a79a86";
  ctx.fillRect(sx, y, w, h);
  ctx.strokeStyle = "#6f6558";
  ctx.lineWidth = 2;
  ctx.strokeRect(sx, y, w, h);

  ctx.fillStyle = "#7f7467";
  ctx.beginPath();
  ctx.moveTo(sx + 26, y + h);
  ctx.lineTo(sx + 26, y + 58);
  ctx.quadraticCurveTo(sx + w / 2, y + 18, sx + w - 26, y + 58);
  ctx.lineTo(sx + w - 26, y + h);
  ctx.closePath();
  ctx.fill();

  for (let i = 0; i < 7; i += 1) {
    ctx.strokeStyle = "#8f8475";
    ctx.beginPath();
    ctx.moveTo(sx + 5 + i * 15, y + 5);
    ctx.lineTo(sx + 5 + i * 15, y + h - 5);
    ctx.stroke();
  }
}

function drawEstandarte(worldX, groundY, cor) {
  const sx = worldX - cameraX;
  if (sx < -120 || sx > canvas.width + 120) return;
  const y = groundY - 88;

  ctx.fillStyle = "#654a2f";
  ctx.fillRect(sx, y, 4, 82);
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.moveTo(sx + 4, y + 6);
  ctx.lineTo(sx + 44, y + 12);
  ctx.lineTo(sx + 30, y + 28);
  ctx.lineTo(sx + 44, y + 42);
  ctx.lineTo(sx + 6, y + 48);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#d9c7a7";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawOvo(ovo) {
  if (ovo.taken) return;
  const flutuar = Math.sin((tick + ovo.x) * 0.06) * 3;
  const cx = ovo.x - cameraX + ovo.w / 2;
  const cy = ovo.y + ovo.h / 2 + flutuar;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.ellipse(0, 0, ovo.w * 0.45, ovo.h * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = grad(-10, -12, 8, 14, "#fff8ea", "#f6e7c9");
  ctx.fill();
  ctx.strokeStyle = "#6e5638";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.strokeStyle = "#d5972c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, -2);
  ctx.lineTo(8, -2);
  ctx.moveTo(-7, 5);
  ctx.lineTo(7, 5);
  ctx.stroke();

  ctx.fillStyle = "#6f8a45";
  ctx.beginPath();
  ctx.arc(-4, -8, 2.2, 0, Math.PI * 2);
  ctx.arc(5, 2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawInimigo(i) {
  if (!i.alive) return;
  const x = i.x - cameraX;
  const y = i.y;

  // Gambuzino: criatura pequena de monte, com pelo e olhos grandes.
  ctx.fillStyle = grad(x, y, x, y + i.h, "#7b5b3e", "#4b3525");
  ctx.beginPath();
  ctx.roundRect(x, y, i.w, i.h, 10);
  ctx.fill();
  ctx.strokeStyle = "#3a2a1e";
  ctx.stroke();

  // Orelhas
  ctx.fillStyle = "#5d422f";
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 5);
  ctx.lineTo(x + 10, y - 7);
  ctx.lineTo(x + 14, y + 7);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 24, y + 7);
  ctx.lineTo(x + 28, y - 7);
  ctx.lineTo(x + 32, y + 5);
  ctx.closePath();
  ctx.fill();

  // Olhos
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(x + 12, y + 12, 4, 0, Math.PI * 2);
  ctx.arc(x + 26, y + 12, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1f2937";
  ctx.beginPath();
  ctx.arc(x + 13, y + 13, 2, 0, Math.PI * 2);
  ctx.arc(x + 27, y + 13, 2, 0, Math.PI * 2);
  ctx.fill();

  // Focinho
  ctx.fillStyle = "#d6b998";
  ctx.beginPath();
  ctx.roundRect(x + 13, y + 19, 12, 8, 4);
  ctx.fill();
  ctx.fillStyle = "#3f2a1b";
  ctx.fillRect(x + 18, y + 21, 2, 2);
}

function drawEscavadora() {
  const x = player.x - cameraX;
  const y = player.y;
  const d = player.facing;

  ctx.fillStyle = "#00000026";
  ctx.beginPath();
  ctx.ellipse(x + 28, y + 48, 30, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = grad(x, y + 30, x, y + 45, "#2f2f2f", "#141414");
  ctx.beginPath();
  ctx.roundRect(x + 5, y + 28, 46, 16, 6);
  ctx.fill();
  for (let t = 0; t < 6; t += 1) {
    ctx.fillStyle = "#4a4a4a";
    ctx.beginPath();
    ctx.arc(x + 10 + t * 7.5, y + 36, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = grad(x, y + 10, x + 35, y + 28, "#f1b13f", "#c88520");
  ctx.beginPath();
  ctx.roundRect(x + 9, y + 10, 34, 20, 5);
  ctx.fill();
  ctx.strokeStyle = "#6a4514";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = grad(x, y, x, y + 18, "#9ec1d6", "#62839b");
  ctx.beginPath();
  ctx.roundRect(x + 16, y - 2, 18, 14, 3);
  ctx.fill();
  ctx.strokeStyle = "#1f3240";
  ctx.stroke();

  const baseX = x + (d > 0 ? 40 : 16);
  const baseY = y + 8;
  const ombroX = baseX + d * 12;
  const ombroY = y - 3;
  const maoX = ombroX + d * 14;
  const maoY = y - 12;
  const paX = maoX + d * 9;
  const paY = y - 8;

  ctx.strokeStyle = "#8a5a15";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.lineTo(ombroX, ombroY);
  ctx.lineTo(maoX, maoY);
  ctx.stroke();

  ctx.fillStyle = "#5d6871";
  ctx.beginPath();
  ctx.moveTo(paX, paY);
  ctx.lineTo(paX + d * 10, paY + 4);
  ctx.lineTo(paX + d * 6, paY + 13);
  ctx.lineTo(paX - d * 4, paY + 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#30363b";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Branding on the machine body.
  ctx.font = "700 8px Montserrat";
  ctx.textAlign = "center";
  ctx.fillStyle = "#2d1f11";
  ctx.fillText("MTR", x + 26, y + 24);
  ctx.fillStyle = "#f3e4ca88";
  ctx.fillRect(x + 14, y + 12, 24, 2);
}

function drawObjetivo() {
  const g = level.objetivo;
  const x = g.x - cameraX;
  ctx.fillStyle = grad(x, g.y, x, g.y + g.h, "#6b5b49", "#4a3c2f");
  ctx.fillRect(x, g.y, g.w, g.h);

  ctx.fillStyle = "#d5972c";
  ctx.beginPath();
  ctx.moveTo(x + g.w, g.y + 12);
  ctx.lineTo(x + g.w + 34, g.y + 24);
  ctx.lineTo(x + g.w, g.y + 38);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#5f3a0d";
  ctx.stroke();
}

function drawPainelFinal() {
  if (gameState === "playing") return;
  if (gameState === "dying") return;
  ctx.fillStyle = "#0000008f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "700 34px Playfair Display";
  ctx.fillText(gameState === "won" ? "VITORIA!" : "FIM DE JOGO", canvas.width / 2, 235);
  ctx.font = "700 18px Montserrat";
  ctx.fillText("Pressiona R para recomecar", canvas.width / 2, 276);
}

function drawExplosao() {
  if (!explosao || gameState !== "dying") return;
  const t = explosao.frame / explosao.duracao;
  const x = explosao.x - cameraX;
  const y = explosao.y;
  const easeOut = 1 - (1 - t) * (1 - t);
  const r1 = 12 + easeOut * 74;
  const r2 = 8 + easeOut * 54;
  const flash = Math.max(0, 1 - t * 5.4);

  ctx.save();
  ctx.globalAlpha = 1 - t * 0.55;

  // Flash inicial dramático.
  if (flash > 0) {
    ctx.globalAlpha = flash * 0.85;
    ctx.fillStyle = "#fff7da";
    ctx.beginPath();
    ctx.arc(x, y, 22 + flash * 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1 - t * 0.55;
  }

  ctx.fillStyle = "#ffef99";
  ctx.beginPath();
  ctx.arc(x, y, r1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff9f1a";
  ctx.beginPath();
  ctx.arc(x - 8, y + 2, r2, 0, Math.PI * 2);
  ctx.arc(x + 10, y - 3, r2 * 0.75, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#d7261e";
  for (let i = 0; i < 14; i += 1) {
    const ang = (Math.PI * 2 * i) / 14 + t * 2.2;
    const px = x + Math.cos(ang) * (18 + easeOut * 60);
    const py = y + Math.sin(ang) * (18 + easeOut * 60);
    ctx.beginPath();
    ctx.arc(px, py, 3 + (1 - t) * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fumo escuro a subir para dar mais drama.
  ctx.globalAlpha = Math.max(0, 0.55 - t * 0.45);
  ctx.fillStyle = "#2d2d2dcc";
  for (let s = 0; s < 6; s += 1) {
    const drift = (s - 2.5) * 9;
    const sy = y - 8 - easeOut * (24 + s * 14);
    ctx.beginPath();
    ctx.arc(x + drift, sy, 10 + s * 2 + t * 12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw() {
  drawBackground();
  drawTerreno();
  for (const ovo of level.ovos) drawOvo(ovo);
  for (const inimigo of level.inimigos) drawInimigo(inimigo);
  drawObjetivo();
  if (gameState !== "dying") drawEscavadora();
  drawExplosao();
  drawPainelFinal();
}

function updateHud() {
  ovosEl.textContent = `Ovos da Pascoa: ${player.ovos}/${level.ovos.length}`;
  vidasEl.textContent = `Vidas: ${player.vidas}`;
}

function limparInputs() {
  keys.left = false;
  keys.right = false;
  keys.jump = false;
  activePointers.left.clear();
  activePointers.right.clear();
  activePointers.jump.clear();
}

function toggleSom() {
  setMuted(!audio.muted);
  mensagemEl.textContent = audio.muted ? "Som desligado." : "Som ligado.";
}

function gameLoop() {
  update();
  updateEngineSound();
  draw();
  updateHud();
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (e) => {
  ensureAudio();
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
  if (e.code === "ArrowUp" || e.code === "Space" || e.code === "KeyW") {
    if (!keys.jump) player.jumpBufferTimer = jumpBufferFrames;
    keys.jump = true;
    e.preventDefault();
  }
  if (e.code === "KeyR") reset(true);
  if (e.code === "KeyM") toggleSom();
});

window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
  if (e.code === "ArrowUp" || e.code === "Space" || e.code === "KeyW") keys.jump = false;
});

function bindTouch(buttonId, keyName) {
  const btn = document.getElementById(buttonId);
  const press = (e) => {
    ensureAudio();
    e.preventDefault();
    const pointerId = e.pointerId ?? 0;
    const wasPressed = activePointers[keyName].size > 0;
    activePointers[keyName].add(pointerId);
    if (keyName === "jump" && !wasPressed) player.jumpBufferTimer = jumpBufferFrames;
    keys[keyName] = true;
  };
  const release = (e) => {
    e.preventDefault();
    const pointerId = e.pointerId ?? 0;
    activePointers[keyName].delete(pointerId);
    keys[keyName] = activePointers[keyName].size > 0;
  };
  btn.addEventListener("pointerdown", press, { passive: false });
  btn.addEventListener("pointerup", release, { passive: false });
  btn.addEventListener("pointercancel", release, { passive: false });
  btn.addEventListener("lostpointercapture", release, { passive: false });
  btn.addEventListener("contextmenu", (e) => e.preventDefault());
}

bindTouch("leftBtn", "left");
bindTouch("rightBtn", "right");
bindTouch("jumpBtn", "jump");

document.getElementById("restartBtn").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  reset(true);
});

document.getElementById("muteBtn").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  ensureAudio();
  toggleSom();
});

document.getElementById("fsBtn").addEventListener("pointerdown", async (e) => {
  e.preventDefault();
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (_) {
    mensagemEl.textContent = "Tela cheia nao suportada neste dispositivo.";
  }
});

window.addEventListener("blur", limparInputs);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) limparInputs();
});

gameLoop();
