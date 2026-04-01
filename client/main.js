import { drawGrid, drawMinimap, drawMapBorder } from "./render.js";
import { loadSkins, getSkinImage, getSkinCanvas, setSkin, getSelectedSkin, getCustomSkinUrl, setSkinChangedHandler, createShopPage, updateCoins, openShop, closeShop, initializeCustomSkinCache } from "./skins.js";

const WORLD_SIZE = 5000;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const mapOverlay = document.getElementById("mapOverlay");
const mapCanvas = document.getElementById("mapCanvas");
const mapCtx = mapCanvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (showMap) updateMapView();
});

const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
const socket = new WebSocket(wsProtocol + "//" + location.host);

// Debug: log connection status
socket.onopen = () => {
  console.log("✅ WebSocket connected");
};

socket.onerror = (err) => {
  console.error("❌ WebSocket error:", err);
};

socket.onclose = () => {
  console.log("❌ WebSocket closed");
};

// Fade-in animation
let fadeInAlpha = 0;
let isFadingIn = false;
let fadeInStartTime = 0;

let myId = null;
let players = {};
let bullets = {};
let orbs = {};
let mouse = { x: 0, y: 0 };
let keys = {};
let camera = { x: 0, y: 0 };
let targetCamera = { x: 0, y: 0 };
let cameraLerpSpeed = 0.1;
let showMap = false;
let lastServerState = null;
let pendingInputs = [];
let lastInputSent = 0;
let myServerPos = null; // last server-authoritative position for local player
let joystick = { active: false, touchId: null, vx: 0, vy: 0 };
let leaderboard = [];
let queuePosition = 0;
let lastUpdateTime = 0;
let playerPrevPos = {}; // Track previous positions for interpolation
let playerLastLevel = 0; // Track level for coin rewards

function startFadeIn() {
  isFadingIn = true;
  fadeInStartTime = Date.now();
  fadeInAlpha = 0.3; // Start slightly transparent so game is visible
}

const startMenu = document.getElementById("startMenu");
const startBtn = document.getElementById("startBtn");
const shopBtn = document.getElementById("shopBtn");
const nameInput = document.getElementById("nameInput");
const colorInput = document.getElementById("colorInput");
const respawnMenu = document.getElementById("respawnMenu");
const respawnBtn = document.getElementById("respawnBtn");
const respawnShopBtn = document.getElementById("respawnShopBtn");
const upgradePanel = document.getElementById("upgradePanel");
const upgradePointsText = document.getElementById("upgradePoints");

console.log("🔍 Buttons found:", { startBtn, shopBtn, respawnBtn, respawnShopBtn });

// Initialize skins
(async () => {
  await loadSkins();
  await initializeCustomSkinCache();
})();

setSkinChangedHandler(({ skin, customSkinUrl }) => {
  if (socket.readyState !== WebSocket.OPEN || !myId) return;
  socket.send(JSON.stringify({ type: "skinUpdate", skin, customSkinUrl }));
});

function updateMapView() {
  if (!showMap) return;
  
  mapOverlay.style.display = "block";
  const mapSize = Math.min(innerWidth * 0.95, innerHeight * 0.95);
  mapCanvas.width = mapSize;
  mapCanvas.height = mapSize;
  mapCanvas.style.width = mapSize + "px";
  mapCanvas.style.height = mapSize + "px";
  
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
  const skin = getSelectedSkin();
  const customSkinUrl = getCustomSkinUrl();
  startMenu.style.display = "none";
  startMenu.classList.remove("show");
  showMap = false;
  mapOverlay.style.display = "none";
  socket.send(JSON.stringify({ type: "setup", name, color, skin, customSkinUrl }));
};

if (shopBtn) {
  console.log("✅ attaching shop button listener");
  shopBtn.onclick = () => {
    console.log("🛍️ shop button clicked");
    openShop();
  };
} else {
  console.log("❌ shopBtn not found!");
}

if (respawnShopBtn) {
  console.log("✅ attaching respawn shop button listener");
  respawnShopBtn.onclick = () => {
    console.log("🛍️ respawn shop button clicked");
    openShop();
  };
} else {
  console.log("❌ respawnShopBtn not found!");
}

respawnBtn.onclick = () => socket.send(JSON.stringify({ type: "respawn" }));

socket.onmessage = e => {
  const data = JSON.parse(e.data);

  if (data.type === "requestSetup") {
    console.log("📋 Server requesting setup");
    startMenu.style.display = "block";
    startMenu.classList.add("show");
    showMap = true;
    updateMapView();
  }

  if (data.type === "queued") {
    console.log("⏳ Queued at position:", data.position);
    queuePosition = data.position;
    startMenu.style.display = "block";
    startMenu.classList.add("show");

    // Hide inputs and show queue info
    document.querySelectorAll("#startMenu input").forEach(el => el.style.display = "none");
    document.querySelectorAll("#startMenu button").forEach(el => el.style.display = "none");

    let queueInfo = document.getElementById("queueInfo");
    if (!queueInfo) {
      queueInfo = document.createElement("div");
      queueInfo.id = "queueInfo";
      startMenu.appendChild(queueInfo);
    }
    queueInfo.innerHTML = `
      <p style="color:#ccc; margin: 20px 0; font-size: 18px;">You are #${data.position} in the queue</p>
      <p style="color:#999; font-size: 14px;">Waiting for a slot to open...</p>
    `;

    showMap = true;
    updateMapView();
  }

  if (data.type === "init") {
    console.log("✅ Player ID received:", data.id);
    myId = data.id;
    if (!players[myId]) {
      players[myId] = { x: 0, y: 0 };
    }
    // If player was queued, restore inputs for next attempt
    const queueInfo = document.getElementById("queueInfo");
    if (queueInfo) {
      queueInfo.remove();
      document.querySelectorAll("#startMenu input").forEach(el => el.style.display = "block");
      document.querySelectorAll("#startMenu button").forEach(el => el.style.display = "block");
    }
  }

  if (data.type === "error") {
    console.error("Server error:", data.message);
    alert("Error: " + data.message);
  }

  if (data.type === "state") {
    const serverPlayers = data.players;
    const serverBullets = data.bullets;
    const serverOrbs = data.orbs || {};

    if (!window.lastStateLog) window.lastStateLog = 0;
    if (Date.now() - window.lastStateLog > 1000) {
      console.log("🎮 State received - players:", Object.keys(serverPlayers).length);
      window.lastStateLog = Date.now();
    }

    // Update leaderboard
    if (data.leaderboard) {
      leaderboard = data.leaderboard;
    }

    // Store server time for interpolation
    const serverTime = Date.now();

    // Reconcile player position with gentle correction
    if (myId && serverPlayers[myId]) {
      if (!players[myId]) {
        players[myId] = {};
      }

      const serverPlayer = serverPlayers[myId];
      const clientPlayer = players[myId];

      // Check for level up and award coins
      if (clientPlayer.level && serverPlayer.level > clientPlayer.level) {
        const oldLevel = clientPlayer.level;
        const newLevel = serverPlayer.level;

        // Calculate coins: each level gives coins equal to the level number
        // Level 2 = 2 coins, Level 3 = 3 coins, etc.
        let coinsEarned = 0;
        for (let i = oldLevel + 1; i <= newLevel; i++) {
          coinsEarned += i;
        }

        updateCoins((players[myId]?.coinage || 0) + coinsEarned);
        if (!players[myId]) players[myId] = {};
        players[myId].coinage = (players[myId].coinage || 0) + coinsEarned;

        // Refresh shop if it's open
        const shopPage = document.getElementById('shopPage');
        if (shopPage) {
          const newShop = createShopPage();
          shopPage.replaceWith(newShop);
        }
      }

      // Copy all server data first, but keep client-predicted x/y to avoid snapping
      const predictedX = clientPlayer.x;
      const predictedY = clientPlayer.y;
      Object.assign(clientPlayer, serverPlayer);

      // Store authoritative server position for gentle correction
      myServerPos = { x: serverPlayer.x, y: serverPlayer.y };

      const errX = serverPlayer.x - predictedX;
      const errY = serverPlayer.y - predictedY;
      const err = Math.sqrt(errX * errX + errY * errY);

      if (err > 120) {
        // Large discrepancy (respawn, wall collision, etc.) — hard snap
        clientPlayer.x = serverPlayer.x;
        clientPlayer.y = serverPlayer.y;
      } else {
        // Restore predicted position; per-frame nudge in sendInput() will correct it
        clientPlayer.x = predictedX;
        clientPlayer.y = predictedY;
      }
    }

    // Update other players with interpolation data
    for (let id in serverPlayers) {
      if (id !== myId) {
        const serverPlayer = serverPlayers[id];

        // Store previous position if this player exists
        if (players[id]) {
          if (!playerPrevPos[id]) {
            playerPrevPos[id] = {};
          }
          playerPrevPos[id].x = players[id].x;
          playerPrevPos[id].y = players[id].y;
          playerPrevPos[id].time = serverTime;
        }

        // Update with new server data
        players[id] = serverPlayer;
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

function sendUpgrade(stat, multiplier = 1) {
  socket.send(JSON.stringify({ type: "upgrade", stat, multiplier }));
}

window.addEventListener("mousemove", e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

window.addEventListener("keydown", e => {
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

function sendInput(delta = 16) {
  if (!myId || !players[myId] || !players[myId].alive) return;

  // Aim angle from mouse (PC) or joystick direction (mobile)
  let angle;
  if (joystick.active && (joystick.vx !== 0 || joystick.vy !== 0)) {
    angle = Math.atan2(joystick.vy, joystick.vx);
  } else {
    const mdx = mouse.x - (canvas.width * 0.5);
    const mdy = mouse.y - (canvas.height * 0.5);
    angle = Math.atan2(mdy, mdx);
  }

  // WASD movement vector
  let vx = 0;
  let vy = 0;
  if (joystick.active) {
    vx = joystick.vx;
    vy = joystick.vy;
  } else {
    if (keys["w"] || keys["W"] || keys["ArrowUp"])    vy -= 1;
    if (keys["s"] || keys["S"] || keys["ArrowDown"])  vy += 1;
    if (keys["a"] || keys["A"] || keys["ArrowLeft"])  vx -= 1;
    if (keys["d"] || keys["D"] || keys["ArrowRight"]) vx += 1;
  }

  // Normalize diagonal movement
  const len = Math.sqrt(vx * vx + vy * vy);
  const nvx = len > 0 ? vx / len : 0;
  const nvy = len > 0 ? vy / len : 0;

  // Client-side prediction with smoother movement
  if (players[myId]) {
    players[myId].angle = angle;
    if (nvx !== 0 || nvy !== 0) {
      players[myId].x += nvx * players[myId].speed * (delta / 16);
      players[myId].y += nvy * players[myId].speed * (delta / 16);
      players[myId].x = Math.max(0, Math.min(WORLD_SIZE, players[myId].x));
      players[myId].y = Math.max(0, Math.min(WORLD_SIZE, players[myId].y));
    }

    // Gently nudge predicted position toward last server position (5% per frame)
    // This corrects accumulated drift without causing visible snaps
    if (myServerPos) {
      players[myId].x += (myServerPos.x - players[myId].x) * 0.05;
      players[myId].y += (myServerPos.y - players[myId].y) * 0.05;
    }
  }

  // Throttle network sends to ~20/sec to reduce bandwidth
  const now = Date.now();
  if (now - lastInputSent >= 50) {
    socket.send(JSON.stringify({ type: "input", angle, vx: nvx, vy: nvy, timestamp: now }));
    lastInputSent = now;
  }
}

// Helper function to get smooth render position for other players
function getPlayerRenderPos(id) {
  const p = players[id];
  if (!id || !p) return { x: p?.x || 0, y: p?.y || 0 };

  // My own player - no interpolation needed (client prediction handles it)
  if (id === myId) {
    return { x: p.x, y: p.y };
  }

  // Other players - interpolate between previous and current position
  const prevPos = playerPrevPos[id];
  if (!prevPos) {
    return { x: p.x, y: p.y };
  }

  // Interpolate over approximately 60ms (one frame at 60fps)
  const now = Date.now();
  const elapsed = now - prevPos.time;
  const interpDuration = 66; // ~15fps update rate, spread over frame time
  const progress = Math.min(1, elapsed / interpDuration);

  const x = prevPos.x + (p.x - prevPos.x) * progress;
  const y = prevPos.y + (p.y - prevPos.y) * progress;

  return { x, y };
}

// --- Mobile joystick ---
const joystickBase = document.getElementById("joystickBase");
const joystickKnob = document.getElementById("joystickKnob");
const shootBtn    = document.getElementById("shootBtn");

window.addEventListener("touchstart", () => {
  document.getElementById("joystickArea").style.display = "block";
  shootBtn.style.display = "block";
}, { once: true });

joystickBase.addEventListener("touchstart", e => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  joystick.active = true;
  joystick.touchId = touch.identifier;
  const rect = joystickBase.getBoundingClientRect();
  joystick.baseX = rect.left + rect.width / 2;
  joystick.baseY = rect.top  + rect.height / 2;
}, { passive: false });

joystickBase.addEventListener("touchmove", e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier !== joystick.touchId) continue;
    const dx = t.clientX - joystick.baseX;
    const dy = t.clientY - joystick.baseY;
    const maxR = 45;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, maxR);
    const a = Math.atan2(dy, dx);
    joystick.vx = Math.cos(a) * (clampedDist / maxR);
    joystick.vy = Math.sin(a) * (clampedDist / maxR);
    const kx = Math.cos(a) * clampedDist;
    const ky = Math.sin(a) * clampedDist;
    joystickKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
  }
}, { passive: false });

joystickBase.addEventListener("touchend", e => {
  for (const t of e.changedTouches) {
    if (t.identifier !== joystick.touchId) continue;
    joystick.active = false;
    joystick.vx = 0;
    joystick.vy = 0;
    joystickKnob.style.transform = "translate(-50%, -50%)";
  }
});

shootBtn.addEventListener("touchstart", e => {
  e.preventDefault();
  if (!myId || !players[myId] || !players[myId].alive) return;
  socket.send(JSON.stringify({ type: "shoot" }));
}, { passive: false });

function draw() {
  if (!myId) {
    // Show loading screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Connecting to server...", canvas.width / 2, canvas.height / 2);
    return;
  }

  if (!players[myId]) {
    // Game waiting for state
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Loading game...", canvas.width / 2, canvas.height / 2);
    return;
  }

  const me = players[myId];

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Paint background
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
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

    // Get interpolated position for smooth rendering
    const pos = getPlayerRenderPos(id);

    const radius = 20 + Math.sqrt(p.xp || 0) * 0.3;

    // Draw barrel/pipe behind the body
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(p.angle || 0);
    const barrelLength = radius * 1.5;
    const barrelWidth = radius * 0.45;
    ctx.fillStyle = '#7a7a7a';
    ctx.strokeStyle = '#555555';
    ctx.lineWidth = 2;
    ctx.fillRect(radius * 0.2, -barrelWidth / 2, barrelLength, barrelWidth);
    ctx.strokeRect(radius * 0.2, -barrelWidth / 2, barrelLength, barrelWidth);
    ctx.restore();

    // Try to render skin if available (clipped to circle via offscreen canvas)
    const skinCanvas = p.skin ? getSkinCanvas(p.skin, p.customSkinUrl) : null;
    if (skinCanvas) {
      ctx.drawImage(skinCanvas, pos.x - radius, pos.y - radius, radius * 2, radius * 2);
    } else {
      // Fallback to colored circle
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }

    ctx.strokeStyle = (id === myId ? p.color : "#ff0000");
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.strokeStyle = (id === myId ? p.color : "#ff0000");
    ctx.lineWidth = 2;
    ctx.strokeText(p.name, pos.x, pos.y - radius - 10);
    ctx.fillText(p.name, pos.x, pos.y - radius - 10);

    ctx.fillStyle = "#555";
    ctx.fillRect(pos.x - radius, pos.y - radius - 20, radius * 2, 5);
    ctx.fillStyle = "#fff";
    ctx.fillRect(pos.x - radius, pos.y - radius - 20, radius * 2 * (p.health / p.maxHealth), 5);
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
    const orbRadius = 30 * orb.size;
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, orbRadius, 0, Math.PI * 2);
    ctx.fillStyle = orb.color;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw health bar above orb
    if (orb.health && orb.maxHealth) {
      const barWidth = orbRadius * 2;
      const barHeight = 4;
      const healthPercent = orb.health / orb.maxHealth;

      // Background bar
      ctx.fillStyle = "#555";
      ctx.fillRect(orb.x - barWidth / 2, orb.y - orbRadius - 10, barWidth, barHeight);

      // Health bar
      ctx.fillStyle = healthPercent > 0.5 ? "#00ff00" : healthPercent > 0.25 ? "#ffff00" : "#ff0000";
      ctx.fillRect(orb.x - barWidth / 2, orb.y - orbRadius - 10, barWidth * healthPercent, barHeight);

      // Border
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.strokeRect(orb.x - barWidth / 2, orb.y - orbRadius - 10, barWidth, barHeight);
    }
  }

  ctx.restore();
  drawMinimap(ctx, players, myId, WORLD_SIZE);

  // Draw leaderboard
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(canvas.width - 250, 10, 240, Math.min(leaderboard.length * 20 + 30, 250));

  ctx.fillStyle = "#fff";
  ctx.font = "bold 16px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("TOP PLAYERS", canvas.width - 20, 30);

  ctx.font = "12px sans-serif";
  leaderboard.forEach((player, idx) => {
    const y = 50 + idx * 18;
    ctx.fillStyle = idx === 0 ? "#ffd700" : idx === 1 ? "#c0c0c0" : idx === 2 ? "#cd7f32" : "#ccc";
    ctx.fillText(`${idx + 1}. ${player.name} (Lvl ${player.level})`, canvas.width - 20, y);
  });
  ctx.restore();

  const p = players[myId];
  if (p) {
    const barWidth = 300;
    const barHeight = 20;
    const x = canvas.width / 2 - barWidth / 2;
    const y = canvas.height - barHeight - 20;
    const xpPercent = (p.xp % 100) / 100;
    const UpgradeAmount = p.CanUpgrade
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
  
  // Render fade-in overlay
  if (isFadingIn) {
    const fadeInDuration = 500; // 0.5 second fade-in (faster)
    const elapsed = Date.now() - fadeInStartTime;
    fadeInAlpha = Math.max(0, 0.5 - (elapsed / fadeInDuration * 0.5)); // Fade from 0.5 to 0
    
    if (fadeInAlpha > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${fadeInAlpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      isFadingIn = false;
      fadeInAlpha = 0;
    }
  }
}

let lastFrameTime = 0;
function loop(timestamp) {
  const delta = lastFrameTime ? Math.min(timestamp - lastFrameTime, 50) : 16;
  lastFrameTime = timestamp;
  sendInput(delta);
  draw();
  if (showMap) updateMapView();
  requestAnimationFrame(loop);
}

console.log("🎮 Game loop starting...");
requestAnimationFrame(loop);
