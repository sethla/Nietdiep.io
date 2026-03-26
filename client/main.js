import { drawGrid, drawMinimap, drawMapBorder } from "./render.js";

const WORLD_SIZE = 5000;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const mapOverlay = document.getElementById("mapOverlay");
const mapCanvas = document.getElementById("mapCanvas");
const mapCtx = mapCanvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;

const socket = new WebSocket("wss://" + location.host);

let myId = null;
let players = {};
let bullets = {};
let orbs = {};
let mouse = { x: 0, y: 0 };
let keys = {};
let camera = { x: 0, y: 0 };
let targetCamera = { x: 0, y: 0 };
let cameraLerpSpeed = 0.05;
let showMap = false;
let lastServerState = null;
let pendingInputs = [];

const startMenu = document.getElementById("startMenu");
const startBtn = document.getElementById("startBtn");
const nameInput = document.getElementById("nameInput");
const colorInput = document.getElementById("colorInput");
const respawnMenu = document.getElementById("respawnMenu");
const respawnBtn = document.getElementById("respawnBtn");
const upgradePanel = document.getElementById("upgradePanel");
const upgradePointsText = document.getElementById("upgradePoints");

function updateMapView() {
  if (!showMap) return;
  
  mapOverlay.style.display = "block";
  const mapSize = Math.min(innerWidth * 0.8, innerHeight * 0.8);
  mapCanvas.width = mapSize;
  mapCanvas.height = mapSize;
  
  mapCtx.clearRect(0, 0, mapSize, mapSize);
  
  // Draw map background
  mapCtx.fillStyle = "#111";
  mapCtx.fillRect(0, 0, mapSize, mapSize);
  
  // Draw grid
  mapCtx.strokeStyle = "#333";
  mapCtx.lineWidth = 1;
  const gridSize = 50;
  const scale = mapSize / WORLD_SIZE;
  
  for (let x = 0; x < WORLD_SIZE; x += gridSize) {
    mapCtx.beginPath();
    mapCtx.moveTo(x * scale, 0);
    mapCtx.lineTo(x * scale, mapSize);
    mapCtx.stroke();
  }
  
  for (let y = 0; y < WORLD_SIZE; y += gridSize) {
    mapCtx.beginPath();
    mapCtx.moveTo(0, y * scale);
    mapCtx.lineTo(mapSize, y * scale);
    mapCtx.stroke();
  }
  
  // Draw orbs
  for (let id in orbs) {
    const orb = orbs[id];
    mapCtx.beginPath();
    mapCtx.arc(orb.x * scale, orb.y * scale, 3 * orb.size, 0, Math.PI * 2);
    mapCtx.fillStyle = orb.color;
    mapCtx.fill();
  }
  
  // Draw players
  for (let id in players) {
    const p = players[id];
    if (!p.alive) continue;
    
    const px = p.x * scale;
    const py = p.y * scale;
    
    mapCtx.beginPath();
    mapCtx.arc(px, py, 4, 0, Math.PI * 2);
    mapCtx.fillStyle = id === myId ? p.color : "#f44336";
    mapCtx.fill();
    
    if (id === myId) {
      mapCtx.strokeStyle = "#fff";
      mapCtx.lineWidth = 2;
      mapCtx.stroke();
    }
  }
}

upgradePanel.querySelectorAll("button[data-stat]").forEach(btn => {
  const multi = btn.dataset.multi ? parseInt(btn.dataset.multi) : 1;
  btn.addEventListener("click", () => {
    sendUpgrade(btn.dataset.stat, multi);
  });
});

startBtn.onclick = () => {
  const name = nameInput.value || "Player";
  const color = colorInput.value || "#4caf50";
  startMenu.style.display = "none";
  socket.send(JSON.stringify({ type: "setup", name, color }));
};

respawnBtn.onclick = () => socket.send(JSON.stringify({ type: "respawn" }));

socket.onmessage = e => {
  const data = JSON.parse(e.data);
  if (data.type === "requestSetup") {
    startMenu.style.display = "block";
    startMenu.classList.add("show");
    showMap = true;
    updateMapView();
  }
  if (data.type === "init") myId = data.id;
  if (data.type === "state") {
    const serverPlayers = data.players;
    const serverBullets = data.bullets;
    const serverOrbs = data.orbs || {};
    
    // Store last server state for reconciliation
    lastServerState = { players: { ...serverPlayers }, bullets: { ...serverBullets }, orbs: { ...serverOrbs } };
    
    // Reconcile player position
    if (myId && serverPlayers[myId] && players[myId]) {
      const serverPlayer = serverPlayers[myId];
      const clientPlayer = players[myId];
      
      // If server position differs significantly from client prediction, snap to server
      const dx = serverPlayer.x - clientPlayer.x;
      const dy = serverPlayer.y - clientPlayer.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 50) { // If difference is too large, snap to server position
        clientPlayer.x = serverPlayer.x;
        clientPlayer.y = serverPlayer.y;
      }
      
      // Update other server-controlled properties
      clientPlayer.health = serverPlayer.health;
      clientPlayer.xp = serverPlayer.xp;
      clientPlayer.level = serverPlayer.level;
      clientPlayer.CanUpgrade = serverPlayer.CanUpgrade;
      clientPlayer.alive = serverPlayer.alive;
      clientPlayer.upgradeCounts = serverPlayer.upgradeCounts || {};
    }
    
    // Update other players and bullets/orbs directly
    for (let id in serverPlayers) {
      if (id !== myId) {
        players[id] = serverPlayers[id];
      }
    }
    
    bullets = serverBullets;
    orbs = serverOrbs;

    if (myId && players[myId]) {
      const me = players[myId];
      if (!me.alive) {
        respawnMenu.style.display = "block";
        respawnMenu.classList.add("show");
        showMap = true;
        updateMapView();
      } else {
        respawnMenu.style.display = "none";
        respawnMenu.classList.remove("show");
        startMenu.style.display = "none";
        startMenu.classList.remove("show");
        showMap = false;
        mapOverlay.style.display = "none";
        
        // Set target camera to follow player
        targetCamera.x = me.x - canvas.width / 2;
        targetCamera.y = me.y - canvas.height / 2;
      }
    }

    if (myId && players[myId] && players[myId].CanUpgrade > 0 && players[myId].alive) {
      upgradePanel.style.display = "block";
      upgradePointsText.textContent = players[myId].CanUpgrade;
      // Update counts
      const counts = players[myId].upgradeCounts || {};
      document.getElementById("count-damage").textContent = counts.damage || 0;
      document.getElementById("count-power").textContent = counts.power || 0;
      document.getElementById("count-bulletSpeed").textContent = counts.bulletSpeed || 0;
      document.getElementById("count-fireRate").textContent = counts.fireRate || 0;
      document.getElementById("count-bodyDamage").textContent = counts.bodyDamage || 0;
      document.getElementById("count-regenerationRate").textContent = counts.regenerationRate || 0;
      document.getElementById("count-speed").textContent = counts.speed || 0;
      document.getElementById("count-maxHealth").textContent = counts.maxHealth || 0;
    } else {
      upgradePanel.style.display = "none";
    }
  }
};

window.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});window.addEventListener("keydown", e => {
  keys[e.key] = true;
  if (upgradePanel.style.display !== "none") {
    const stats = ["damage", "power", "bulletSpeed", "fireRate", "bodyDamage", "regenerationRate", "speed", "maxHealth"];
    const num = parseInt(e.key);
    if (num >= 1 && num <= 8) {
      sendUpgrade(stats[num - 1]);
    }
  }
});
window.addEventListener("keyup", e => keys[e.key] = false);
window.addEventListener("mousedown", () => {
  if (!myId || !players[myId] || !players[myId].alive) return;
  socket.send(JSON.stringify({ type: "shoot" }));
});

function sendInput() {
  if (!myId || !players[myId] || !players[myId].alive) return;

  const dx = mouse.x - (canvas.width * 0.5);
  const dy = mouse.y - (canvas.height * 0.5);
  const angle = Math.atan2(dy, dx);
  const input = { angle, up: keys["w"], timestamp: Date.now() };
  
  // Add to pending inputs for reconciliation
  pendingInputs.push(input);
  
  // Client-side prediction
  if (players[myId]) {
    players[myId].angle = angle;
    if (input.up) {
      const delta = 16; // Assume 60fps
      players[myId].x += Math.cos(angle) * players[myId].speed * (delta / 16);
      players[myId].y += Math.sin(angle) * players[myId].speed * (delta / 16);
      
      // Keep within bounds
      players[myId].x = Math.max(0, Math.min(WORLD_SIZE, players[myId].x));
      players[myId].y = Math.max(0, Math.min(WORLD_SIZE, players[myId].y));
    }
  }

  socket.send(JSON.stringify({ type: "input", ...input }));
}

function draw() {
  if (!myId || !players[myId]) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const me = players[myId];
  
  // Update camera with lerping
  if (!showMap) {
    camera.x += (targetCamera.x - camera.x) * cameraLerpSpeed;
    camera.y += (targetCamera.y - camera.y) * cameraLerpSpeed;
  }

  drawGrid(ctx, camera, canvas);
  drawMapBorder(ctx, WORLD_SIZE, camera, canvas);

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  for (let id in players) {
    const p = players[id];
    if (!p.alive) continue;

    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();

    ctx.strokeStyle = (id === myId ? p.color : "#ff0000");
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.strokeStyle = (id === myId ? p.color : "#ff0000");
    ctx.lineWidth = 2;
    ctx.strokeText(p.name, p.x, p.y - 30);
    ctx.fillText(p.name, p.x, p.y - 30);

    ctx.fillStyle = "#555";
    ctx.fillRect(p.x - 20, p.y - 25, 40, 5);
    ctx.fillStyle = "#fff";
    ctx.fillRect(p.x - 20, p.y - 25, 40 * (p.health / p.maxHealth), 5);
  }

  bullets.forEach(b => {
    const now = Date.now();
    const age = now - b.startTime;
    const distance = (age / 1000) * b.speed;
    const x = b.startX + Math.cos(b.angle) * distance;
    const y = b.startY + Math.sin(b.angle) * distance;
    
    // Only render if within world bounds
    if (x >= 0 && x <= WORLD_SIZE && y >= 0 && y <= WORLD_SIZE) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    }
  });

  // Render orbs
  for (let id in orbs) {
    const orb = orbs[id];
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, 10 * orb.size, 0, Math.PI * 2);
    ctx.fillStyle = orb.color;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.restore();
  drawMinimap(ctx, players, myId, WORLD_SIZE);

  const p = players[myId];
  if (p) {
    const barWidth = 300;
    const barHeight = 20;
    const x = canvas.width / 2 - barWidth / 2;
    const y = canvas.height - barHeight - 20;
    const xpPercent = (p.xp % 100) / 100;
    const UpgradeAmount =  p.CanUpgrade
    //bar
    ctx.fillStyle = "#555";
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, barWidth * xpPercent, barHeight);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, barWidth, barHeight);
    ctx.fillStyle = "#00000098";
    ctx.textAlign = "center";
    ctx.font = "16px sans-serif";
    ctx.fillText(`Level ${p.level} | XP: ${p.xp}`, canvas.width / 2, y + barHeight - 5);
  }
}

function loop() {
  sendInput();
  draw();
  if (showMap) updateMapView();
}

setInterval(loop, 1000 / 15);
